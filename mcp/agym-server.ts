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
const gymExerciseAlternativeSchema = z.object({ client_id: z.string().trim().min(1).max(100), name: z.string().trim().min(1).max(120) });
const gymPlanSchema = z.object({
  kind: z.literal('gym_workout'), schema_version: z.literal(1), scheduled_for: dateSchema,
  title: z.string().trim().min(1).max(160),
  exercises: z.array(z.object({
    client_id: z.string().trim().min(1).max(100), name: z.string().trim().min(1).max(120), sets: z.array(gymSetSchema).min(1).max(20),
    alternatives: z.array(gymExerciseAlternativeSchema).max(4).optional(),
  })).min(1).max(30),
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
const searchCatalogueInputSchema = {
  query: z.string().trim().max(200).optional(),
  body_part: z.string().trim().max(60).optional(),
  limit: z.number().int().min(1).max(50).default(20),
};

// Columns a search word may match against. Mirrors the mobile catalogue
// picker's search (apps/mobile/src/features/exercises/exerciseCatalogueApi.ts)
// so "barbell" (equipment, not name) or "press bench" (word order) both hit.
const CATALOGUE_SEARCHABLE_COLUMNS = ['name', 'target', 'muscle_group', 'equipment', 'category', 'body_part'] as const;

function catalogueSearchWords(query: string | undefined): string[] {
  return (query ?? '').trim().split(/\s+/).filter((word) => word.length > 0);
}

export interface AgymMcpConfiguration {
  supabaseUrl: string;
  serviceRoleKey: string;
  userId: string;
  agentIdentifier: string;
}

/** Identity derived by a trusted transport boundary, never from MCP tool input. */
export interface AgymMcpIdentity {
  userId: string;
  agentIdentifier: string;
  /** Remote OAuth calls use grant-checking RPCs; they never query tables directly. */
  remoteRpc?: true;
}

type AuthorizationAction = 'read_context' | 'write_proposed_plan';

interface AuthorizationRow {
  id: string;
}

function jsonContent(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] };
}

function errorContent(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true };
}

function ensureRemoteRpcAllowed(data: unknown): unknown {
  if (data && typeof data === 'object' && !Array.isArray(data) && typeof (data as Record<string, unknown>).error === 'string') {
    throw new Error((data as Record<string, string>).error);
  }
  return data;
}

/**
 * Both create_mcp_proposed_plan and remote_mcp_create_proposed_plan return
 * {plan, conflicts}. Tolerate a bare plan row too, so a migration/deploy skew
 * degrades to "no conflict info" rather than a wrong payload.
 */
function planEnvelope(data: unknown): { plan: unknown; conflicts: unknown } {
  if (data && typeof data === 'object' && !Array.isArray(data) && 'plan' in data) {
    const envelope = data as { plan: unknown; conflicts?: unknown };
    return { plan: envelope.plan, conflicts: envelope.conflicts ?? null };
  }
  return { plan: data, conflicts: null };
}

async function requireAuthorization(
  client: SupabaseClient,
  identity: AgymMcpIdentity,
  action: AuthorizationAction,
): Promise<AuthorizationRow> {
  const { data, error } = await client
    .from('agent_authorizations')
    .select('id')
    .eq('user_id', identity.userId)
    .eq('agent_identifier', identity.agentIdentifier)
    .eq('action', action)
    .is('revoked_at', null)
    .maybeSingle();

  if (error) throw new Error(`Could not verify AGym ${action} authorization: ${error.message}`);
  if (!data) throw new Error(`No active ${action} authorization exists for ${identity.agentIdentifier}.`);
  return data as AuthorizationRow;
}

async function appendAuditLog(client: SupabaseClient, identity: AgymMcpIdentity, authorizationId: string, action: string, metadata: Record<string, unknown>) {
  const { error } = await client.from('agent_audit_log').insert({
    user_id: identity.userId,
    authorization_id: authorizationId,
    agent_identifier: identity.agentIdentifier,
    action,
    resource_type: 'context',
    metadata,
  });
  if (error) throw new Error(`Could not write AGym audit record: ${error.message}`);
}

export function registerAgymTools(server: McpServer, client: SupabaseClient, identity: AgymMcpIdentity): void {

  server.registerTool(
    'get_context',
    {
      description: 'Read a bounded, user-authorized AGym context: user-confirmed events and optionally immutable raw self-report notes. Raw notes remain unparsed evidence, not confirmed facts.',
      inputSchema: contextInputSchema,
    },
    async ({ from_date: fromDate, to_date: toDate, limit, include_raw_notes: includeRawNotes }) => {
      try {
        if (identity.remoteRpc) {
          const { data, error } = await client.rpc('remote_mcp_get_context', {
            p_from_date: fromDate ?? null,
            p_to_date: toDate ?? null,
            p_limit: limit,
            p_include_raw_notes: includeRawNotes,
          });
          if (error) throw new Error(`Could not load remote AGym context: ${error.message}`);
          const result = ensureRemoteRpcAllowed(data);
          if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('Remote AGym context RPC returned an invalid response.');
          return jsonContent({
            ...(result as Record<string, unknown>),
            query: { from_date: fromDate ?? null, to_date: toDate ?? null, limit, include_raw_notes: includeRawNotes },
            caveat: 'Raw notes are immutable user self-reports. They are unparsed evidence, not user-confirmed structured facts.',
          });
        }

        const authorization = await requireAuthorization(client, identity, 'read_context');
        let eventsQuery = client.from('canonical_events').select('id, event_type, final_fields, confirmed_at')
          .eq('user_id', identity.userId).is('deleted_at', null).order('confirmed_at', { ascending: false }).limit(limit);
        if (fromDate) eventsQuery = eventsQuery.gte('confirmed_at', `${fromDate}T00:00:00.000Z`);
        if (toDate) eventsQuery = eventsQuery.lte('confirmed_at', `${toDate}T23:59:59.999Z`);
        const eventsResult = await eventsQuery;
        if (eventsResult.error) throw new Error(`Could not load confirmed events: ${eventsResult.error.message}`);

        let rawNotes: unknown[] = [];
        if (includeRawNotes) {
          let rawLogsQuery = client.from('raw_logs').select('id, raw_text, logged_for_date, created_at')
            .eq('user_id', identity.userId).is('deleted_at', null).order('created_at', { ascending: false }).limit(limit);
          if (fromDate) rawLogsQuery = rawLogsQuery.gte('logged_for_date', fromDate);
          if (toDate) rawLogsQuery = rawLogsQuery.lte('logged_for_date', toDate);
          const rawLogsResult = await rawLogsQuery;
          if (rawLogsResult.error) throw new Error(`Could not load raw notes: ${rawLogsResult.error.message}`);
          rawNotes = (rawLogsResult.data ?? []).map((log) => ({ id: log.id, logged_at: log.created_at, logged_for_date: log.logged_for_date, text: log.raw_text, provenance: 'raw_self_report', interpretation_status: 'unparsed' }));
        }
        const confirmedEvents = (eventsResult.data ?? []).map((event) => ({ id: event.id, confirmed_at: event.confirmed_at, event_type: event.event_type, provenance: 'user_confirmed', data: event.final_fields }));
        await appendAuditLog(client, identity, authorization.id, 'get_context', { from_date: fromDate ?? null, to_date: toDate ?? null, raw_notes_included: includeRawNotes, raw_note_count: rawNotes.length, confirmed_event_count: confirmedEvents.length });
        return jsonContent({ user_id: identity.userId, query: { from_date: fromDate ?? null, to_date: toDate ?? null, limit, include_raw_notes: includeRawNotes }, confirmed_events: confirmedEvents, raw_notes: rawNotes, caveat: 'Raw notes are immutable user self-reports. They are unparsed evidence, not user-confirmed structured facts.' });
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
        if (identity.remoteRpc) {
          const { data, error } = await client.rpc('remote_mcp_list_plans', { p_status: status ?? null, p_limit: limit });
          if (error) throw new Error(`Could not load remote AGym plans: ${error.message}`);
          const plans = ensureRemoteRpcAllowed(data);
          if (!Array.isArray(plans)) throw new Error('Remote AGym plans RPC returned an invalid response.');
          return jsonContent({ plans, caveat: 'Plans are agent-authored proposals, not confirmed outcomes or user acceptance.' });
        }
        const authorization = await requireAuthorization(client, identity, 'read_context');
        let query = client.from('plans').select('id, raw_plan_text, plan_data, provenance, status, source_client, scheduled_for, created_at, updated_at')
          .eq('user_id', identity.userId).is('deleted_at', null).order('created_at', { ascending: false }).limit(limit);
        if (status) query = query.eq('status', status);
        const { data, error } = await query;
        if (error) throw new Error(`Could not load plans: ${error.message}`);
        await appendAuditLog(client, identity, authorization.id, 'list_plans', { status: status ?? null, plan_count: data?.length ?? 0 });
        return jsonContent({ plans: data ?? [], caveat: 'Plans are agent-authored proposals, not confirmed outcomes or user acceptance.' });
      } catch (error) {
        return errorContent(error instanceof Error ? error.message : 'AGym plan request failed.');
      }
    },
  );

  server.registerTool(
    'search_exercise_catalogue',
    {
      description: 'Search the metadata-only exercise catalogue (name, category, body part, equipment, target muscle) to find standardized exercise names before authoring a gym_workout plan with create_proposed_plan. Results are reference data, not user data or a confirmed outcome; matching one does not log or confirm anything.',
      inputSchema: searchCatalogueInputSchema,
    },
    async ({ query, body_part: bodyPart, limit }) => {
      try {
        let exercises: unknown[];
        if (identity.remoteRpc) {
          const { data, error } = await client.rpc('remote_mcp_search_exercise_catalogue', {
            p_query: query ?? null,
            p_body_part: bodyPart ?? null,
            p_limit: limit,
          });
          if (error) throw new Error(`Could not search the remote AGym exercise catalogue: ${error.message}`);
          const result = ensureRemoteRpcAllowed(data);
          if (!Array.isArray(result)) throw new Error('Remote AGym exercise catalogue RPC returned an invalid response.');
          exercises = result;
        } else {
          const authorization = await requireAuthorization(client, identity, 'read_context');
          let catalogueQuery = client.from('exercise_catalogue')
            .select('id, name, category, body_part, equipment, muscle_group, secondary_muscles, target')
            .order('name', { ascending: true }).order('id', { ascending: true }).limit(limit);
          for (const word of catalogueSearchWords(query)) {
            catalogueQuery = catalogueQuery.or(CATALOGUE_SEARCHABLE_COLUMNS.map((column) => `${column}.ilike.%${word}%`).join(','));
          }
          if (bodyPart) catalogueQuery = catalogueQuery.eq('body_part', bodyPart);
          const { data, error } = await catalogueQuery;
          if (error) throw new Error(`Could not search the exercise catalogue: ${error.message}`);
          exercises = data ?? [];
          await appendAuditLog(client, identity, authorization.id, 'search_exercise_catalogue', { query: query ?? null, body_part: bodyPart ?? null, limit, result_count: exercises.length });
        }
        return jsonContent({
          exercises,
          query: { query: query ?? null, body_part: bodyPart ?? null, limit },
          caveat: 'Catalogue results are reference metadata for naming/standardizing plan exercises. Selecting one does not confirm or log anything.',
        });
      } catch (error) {
        return errorContent(error instanceof Error ? error.message : 'AGym exercise catalogue search failed.');
      }
    },
  );

  server.registerTool(
    'create_proposed_plan',
    {
      description: 'Create an agent-authored proposed plan after explicit write authorization. This never confirms an outcome or activates a plan. Prefer search_exercise_catalogue first to name each exercise consistently with AGym\'s standardized catalogue rather than an ad hoc description, when a reasonable match exists. The response includes an advisory `conflicts` field noting any other Gym plan already on that date; conflicts are informational only and never block creation. A gym_workout exercise may include an `alternatives` array (each `{client_id, name}`, up to 4) naming other exercises usable for the same slot with the same prescribed sets — use this when more than one exercise would reasonably work (e.g. Barbell row with alternatives Lat pulldown, Seated cable row); the user chooses which to perform at workout time, so do not create separate proposals for each option.',
      inputSchema: planInputSchema,
    },
    async ({ raw_plan_text: rawPlanText, plan_data: planData }) => {
      try {
        let envelope: { plan: unknown; conflicts: unknown };
        if (identity.remoteRpc) {
          const { data, error } = await client.rpc('remote_mcp_create_proposed_plan', {
            p_raw_plan_text: rawPlanText,
            p_plan_data: planData,
          });
          if (error) throw new Error(`Could not create remote proposed plan: ${error.message}`);
          envelope = planEnvelope(ensureRemoteRpcAllowed(data));
        } else {
          const authorization = await requireAuthorization(client, identity, 'write_proposed_plan');
          const { data, error } = await client.rpc('create_mcp_proposed_plan', {
            p_user_id: identity.userId,
            p_authorization_id: authorization.id,
            p_agent_identifier: identity.agentIdentifier,
            p_raw_plan_text: rawPlanText,
            p_plan_data: planData,
          });
          if (error) throw new Error(`Could not create proposed plan: ${error.message}`);
          envelope = planEnvelope(data);
        }
        if (!envelope.plan || typeof envelope.plan !== 'object' || Array.isArray(envelope.plan)) {
          throw new Error('AGym proposed-plan RPC returned an invalid response.');
        }
        return jsonContent({
          plan: envelope.plan,
          conflicts: envelope.conflicts,
          caveat: 'This is an agent-authored proposal awaiting user review. It is not a confirmed outcome or active plan.',
        });
      } catch (error) {
        return errorContent(error instanceof Error ? error.message : 'AGym plan creation failed.');
      }
    },
  );
}

export function createAgymMcpServer(client: SupabaseClient, configuration: AgymMcpConfiguration): McpServer {
  const server = new McpServer({ name: 'agym', version: '0.1.0' });
  registerAgymTools(server, client, configuration);
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
