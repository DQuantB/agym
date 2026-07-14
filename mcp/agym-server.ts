import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const contextInputSchema = {
  from_date: dateSchema.optional(),
  to_date: dateSchema.optional(),
  limit: z.number().int().min(1).max(50).default(14),
  include_raw_notes: z.boolean().default(true),
};

const planStatusSchema = z.enum(['proposed', 'active', 'superseded', 'archived']);
const gymSetSchema = z.object({ reps: z.number().int().min(1).max(100), weight_kg: z.number().min(0).max(1000).nullable().optional(), rest_seconds: z.number().int().min(0).max(3600).default(120) });
const gymPlanSchema = z.object({
  kind: z.literal('gym_workout'), schema_version: z.literal(1), scheduled_for: dateSchema,
  title: z.string().trim().min(1).max(160),
  exercises: z.array(z.object({ client_id: z.string().trim().min(1).max(100), name: z.string().trim().min(1).max(120), sets: z.array(gymSetSchema).min(1).max(20) })).min(1).max(30),
  notes: z.string().trim().max(2000).optional(),
});
const planInputSchema = {
  raw_plan_text: z.string().trim().min(1).max(12000),
  plan_data: z.union([gymPlanSchema, z.record(z.string(), z.unknown()).refine((value) => value.kind !== 'gym_workout', 'Gym plans must use the formatted gym_workout schema')]).default({}),
};
const listPlansInputSchema = {
  status: planStatusSchema.optional(),
  limit: z.number().int().min(1).max(50).default(20),
};

export interface AgymMcpConfiguration {
  supabaseUrl: string;
  serviceRoleKey: string;
  userId: string;
  agentIdentifier: string;
}

interface AuthorizationRow {
  id: string;
}

function jsonContent(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] };
}

function errorContent(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true };
}

async function requireAuthorization(
  client: SupabaseClient,
  configuration: AgymMcpConfiguration,
  action: 'read_context' | 'write_proposed_plan',
): Promise<AuthorizationRow> {
  const { data, error } = await client
    .from('agent_authorizations')
    .select('id')
    .eq('user_id', configuration.userId)
    .eq('agent_identifier', configuration.agentIdentifier)
    .eq('action', action)
    .is('revoked_at', null)
    .maybeSingle();

  if (error) throw new Error(`Could not verify AGym read authorization: ${error.message}`);
  if (!data) throw new Error(`No active read_context authorization exists for ${configuration.agentIdentifier}.`);
  return data as AuthorizationRow;
}

async function appendAuditLog(client: SupabaseClient, configuration: AgymMcpConfiguration, authorizationId: string, action: string, metadata: Record<string, unknown>) {
  const { error } = await client.from('agent_audit_log').insert({
    user_id: configuration.userId,
    authorization_id: authorizationId,
    agent_identifier: configuration.agentIdentifier,
    action,
    resource_type: 'context',
    metadata,
  });
  if (error) throw new Error(`Could not write AGym audit record: ${error.message}`);
}

export function createAgymMcpServer(client: SupabaseClient, configuration: AgymMcpConfiguration): McpServer {
  const server = new McpServer({ name: 'agym', version: '0.1.0' });

  server.registerTool(
    'get_context',
    {
      description: 'Read a bounded, user-authorized AGym context: user-confirmed events and optionally immutable raw self-report notes. Raw notes remain unparsed evidence, not confirmed facts.',
      inputSchema: contextInputSchema,
    },
    async ({ from_date: fromDate, to_date: toDate, limit, include_raw_notes: includeRawNotes }) => {
      try {
        const authorization = await requireAuthorization(client, configuration, 'read_context');

        let eventsQuery = client
          .from('canonical_events')
          .select('client_id, event_type, final_fields, confirmed_at')
          .eq('user_id', configuration.userId)
          .is('deleted_at', null)
          .order('confirmed_at', { ascending: false })
          .limit(limit);
        if (fromDate) eventsQuery = eventsQuery.gte('confirmed_at', `${fromDate}T00:00:00.000Z`);
        if (toDate) eventsQuery = eventsQuery.lte('confirmed_at', `${toDate}T23:59:59.999Z`);

        const eventsResult = await eventsQuery;
        if (eventsResult.error) throw new Error(`Could not load confirmed events: ${eventsResult.error.message}`);

        let rawNotes: unknown[] = [];
        if (includeRawNotes) {
          let rawLogsQuery = client
            .from('raw_logs')
            .select('client_id, raw_text, logged_for_date, client_meta, created_at')
            .eq('user_id', configuration.userId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(limit);
          if (fromDate) rawLogsQuery = rawLogsQuery.gte('logged_for_date', fromDate);
          if (toDate) rawLogsQuery = rawLogsQuery.lte('logged_for_date', toDate);

          const rawLogsResult = await rawLogsQuery;
          if (rawLogsResult.error) throw new Error(`Could not load raw notes: ${rawLogsResult.error.message}`);
          rawNotes = (rawLogsResult.data ?? []).map((log) => ({
            id: log.client_id,
            logged_at: log.created_at,
            logged_for_date: log.logged_for_date,
            text: log.raw_text,
            provenance: 'raw_self_report',
            interpretation_status: 'unparsed',
          }));
        }

        const confirmedEvents = (eventsResult.data ?? []).map((event) => ({
          id: event.client_id,
          confirmed_at: event.confirmed_at,
          event_type: event.event_type,
          provenance: 'user_confirmed',
          data: event.final_fields,
        }));

        await appendAuditLog(client, configuration, authorization.id, 'get_context', {
          from_date: fromDate ?? null,
          to_date: toDate ?? null,
          raw_notes_included: includeRawNotes,
          raw_note_count: rawNotes.length,
          confirmed_event_count: confirmedEvents.length,
        });

        return jsonContent({
          user_id: configuration.userId,
          query: { from_date: fromDate ?? null, to_date: toDate ?? null, limit, include_raw_notes: includeRawNotes },
          confirmed_events: confirmedEvents,
          raw_notes: rawNotes,
          caveat: 'Raw notes are immutable user self-reports. They are unparsed evidence, not user-confirmed structured facts.',
        });
      } catch (error) {
        return errorContent(error instanceof Error ? error.message : 'AGym context request failed.');
      }
    },
  );

  server.registerTool(
    'list_plans',
    {
      description: 'List bounded agent-authored plan proposals for the authorized AGym account. Plans are not confirmed outcomes or user acceptance.',
      inputSchema: listPlansInputSchema,
    },
    async ({ status, limit }) => {
      try {
        const authorization = await requireAuthorization(client, configuration, 'read_context');
        let query = client.from('plans').select('id, raw_plan_text, plan_data, provenance, status, source_client, scheduled_for, created_at, updated_at')
          .eq('user_id', configuration.userId).is('deleted_at', null).order('created_at', { ascending: false }).limit(limit);
        if (status) query = query.eq('status', status);
        const { data, error } = await query;
        if (error) throw new Error(`Could not load plans: ${error.message}`);
        await appendAuditLog(client, configuration, authorization.id, 'list_plans', { status: status ?? null, plan_count: data?.length ?? 0 });
        return jsonContent({ plans: data ?? [], caveat: 'Plans are agent-authored proposals, not confirmed outcomes or user acceptance.' });
      } catch (error) {
        return errorContent(error instanceof Error ? error.message : 'AGym plan request failed.');
      }
    },
  );

  server.registerTool(
    'create_proposed_plan',
    {
      description: 'Create an agent-authored proposed plan after explicit write authorization. This never confirms an outcome or activates a plan.',
      inputSchema: planInputSchema,
    },
    async ({ raw_plan_text: rawPlanText, plan_data: planData }) => {
      try {
        const authorization = await requireAuthorization(client, configuration, 'write_proposed_plan');
        const { data, error } = await client.rpc('create_mcp_proposed_plan', {
          p_user_id: configuration.userId,
          p_authorization_id: authorization.id,
          p_agent_identifier: configuration.agentIdentifier,
          p_raw_plan_text: rawPlanText,
          p_plan_data: planData,
        });
        if (error) throw new Error(`Could not create proposed plan: ${error.message}`);
        return jsonContent({ plan: data, caveat: 'This is an agent-authored proposal awaiting user review. It is not a confirmed outcome or active plan.' });
      } catch (error) {
        return errorContent(error instanceof Error ? error.message : 'AGym plan creation failed.');
      }
    },
  );

  return server;
}

export function loadConfiguration(env: NodeJS.ProcessEnv = process.env): AgymMcpConfiguration {
  const required = ['AGYM_SUPABASE_URL', 'AGYM_SUPABASE_SERVICE_ROLE_KEY', 'AGYM_USER_ID'] as const;
  const missing = required.filter((key) => !env[key]?.trim());
  if (missing.length > 0) throw new Error(`Missing required MCP environment variables: ${missing.join(', ')}`);

  return {
    supabaseUrl: env.AGYM_SUPABASE_URL!.trim(),
    serviceRoleKey: env.AGYM_SUPABASE_SERVICE_ROLE_KEY!.trim(),
    userId: env.AGYM_USER_ID!.trim(),
    agentIdentifier: env.AGYM_AGENT_IDENTIFIER?.trim() || 'hermes',
  };
}

async function main() {
  const configuration = loadConfiguration();
  const client = createClient(configuration.supabaseUrl, configuration.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const server = createAgymMcpServer(client, configuration);
  await server.connect(new StdioServerTransport());
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'AGym MCP server failed to start.');
    process.exitCode = 1;
  });
}
