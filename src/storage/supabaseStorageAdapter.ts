import type { SupabaseClient } from '@supabase/supabase-js';
import { CanonicalEventSchema, ExportSchema, RawLogSchema } from '../domain/schemas';
import type { AgymExport, CanonicalEvent, RawLog } from '../domain/types';
import type { StorageAdapter } from './StorageAdapter';

interface RawLogRow {
  id: string;
  client_id: string;
  raw_text: string;
  logged_for_date: string;
  client_meta: Record<string, unknown>;
  created_at: string;
}

interface CanonicalEventRow {
  client_id: string;
  final_fields: unknown;
}

function requireData<T>(result: { data: T | null; error: { message: string } | null }, action: string): T {
  if (result.error) throw new Error(`AGym could not ${action}: ${result.error.message}`);
  if (result.data === null) throw new Error(`AGym could not ${action}: no data was returned.`);
  return result.data;
}

function rawLogFromRow(row: RawLogRow): RawLog {
  return RawLogSchema.parse({
    id: row.client_id,
    text: row.raw_text,
    loggedAt: typeof row.client_meta.loggedAt === 'string' ? row.client_meta.loggedAt : row.created_at,
    defaultDate: row.logged_for_date,
    source: 'manual',
    schemaVersion: 1,
  });
}

function canonicalEventFromRow(row: CanonicalEventRow): CanonicalEvent {
  return CanonicalEventSchema.parse({ ...row.final_fields as object, id: row.client_id });
}

async function getAuthenticatedUserId(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error(`AGym could not verify your signed-in account: ${error?.message ?? 'no active user.'}`);
  return data.user.id;
}

/**
 * Browser adapter for authenticated, RLS-protected AGym data. `client_id` is a
 * stable application/export identifier; database UUIDs remain internal.
 */
export function createSupabaseStorageAdapter(supabase: SupabaseClient): StorageAdapter {
  return {
    async loadAll() {
      const [rawLogsResult, eventsResult] = await Promise.all([
        supabase.from('raw_logs').select('id, client_id, raw_text, logged_for_date, client_meta, created_at').is('deleted_at', null).order('created_at', { ascending: true }),
        supabase.from('canonical_events').select('client_id, final_fields').is('deleted_at', null).order('confirmed_at', { ascending: true }),
      ]);

      const rawLogRows = requireData(rawLogsResult, 'load raw logs') as RawLogRow[];
      const eventRows = requireData(eventsResult, 'load confirmed events') as CanonicalEventRow[];
      return { rawLogs: rawLogRows.map(rawLogFromRow), events: eventRows.map(canonicalEventFromRow) };
    },

    async saveRawLog(log) {
      const userId = await getAuthenticatedUserId(supabase);
      const result = await supabase.from('raw_logs').insert({
        user_id: userId,
        client_id: log.id,
        raw_text: log.text,
        logged_for_date: log.defaultDate,
        client_meta: { loggedAt: log.loggedAt, source: log.source, schemaVersion: log.schemaVersion },
      });
      if (result.error) throw new Error(`AGym could not save your raw log: ${result.error.message}`);
    },

    async saveEvents(events) {
      const userId = await getAuthenticatedUserId(supabase);
      for (const event of events) {
        const source = requireData(
          await supabase.from('raw_logs').select('id').eq('client_id', event.rawLogId).is('deleted_at', null).maybeSingle(),
          'find the source raw log for confirmation',
        ) as { id: string };

        const result = await supabase.from('canonical_events').insert({
          user_id: userId,
          client_id: event.id,
          source_raw_log_id: source.id,
          event_type: event.payload.kind,
          final_fields: event,
        });
        if (result.error) throw new Error(`AGym could not save your confirmed event: ${result.error.message}`);
      }
    },

    async deleteEvent(id) {
      const result = await supabase.from('canonical_events').delete().eq('client_id', id);
      if (result.error) throw new Error(`AGym could not delete the confirmed event: ${result.error.message}`);
    },

    async exportAll() {
      const payload: AgymExport = ExportSchema.parse({ schemaVersion: 1, exportedAt: new Date().toISOString(), ...(await this.loadAll()) });
      return JSON.stringify(payload, null, 2);
    },

    async deleteAll() {
      throw new Error('AGym cannot delete hosted raw logs from the browser. Export your data and use the account-deletion workflow when it is available.');
    },
  };
}
