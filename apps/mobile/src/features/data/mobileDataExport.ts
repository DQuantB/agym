export type RawSelfReportExport = {
  provenance: 'raw_self_report';
  clientId: string;
  rawText: string;
  loggedForDate: string;
  createdAt: string;
};

export type UserConfirmedOutcomeExport = {
  provenance: 'user_confirmed';
  clientId: string;
  finalFields: Record<string, unknown>;
  confirmedAt: string;
};

type RawLogRow = {
  client_id: unknown;
  raw_text: unknown;
  logged_for_date: unknown;
  created_at: unknown;
};

type CanonicalEventRow = {
  client_id: unknown;
  final_fields: unknown;
  confirmed_at: unknown;
};

export type MobileDataExport = {
  schemaVersion: 1;
  exportedAt: string;
  rawSelfReports: RawSelfReportExport[];
  userConfirmedOutcomes: UserConfirmedOutcomeExport[];
};

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`AGYM could not export data: ${field} was missing or invalid.`);
  }
  return value;
}

function requireObject(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`AGYM could not export data: ${field} was missing or invalid.`);
  }
  return value as Record<string, unknown>;
}

export function buildMobileDataExport(
  rawRows: RawLogRow[],
  canonicalRows: CanonicalEventRow[],
  exportedAt: string = new Date().toISOString(),
): MobileDataExport {
  requireString(exportedAt, 'exportedAt');

  return {
    schemaVersion: 1,
    exportedAt,
    rawSelfReports: rawRows.map((row) => ({
      provenance: 'raw_self_report',
      clientId: requireString(row.client_id, 'raw log client_id'),
      rawText: requireString(row.raw_text, 'raw log raw_text'),
      loggedForDate: requireString(row.logged_for_date, 'raw log logged_for_date'),
      createdAt: requireString(row.created_at, 'raw log created_at'),
    })),
    userConfirmedOutcomes: canonicalRows.map((row) => ({
      provenance: 'user_confirmed',
      clientId: requireString(row.client_id, 'canonical event client_id'),
      finalFields: requireObject(row.final_fields, 'canonical event final_fields'),
      confirmedAt: requireString(row.confirmed_at, 'canonical event confirmed_at'),
    })),
  };
}

export function serializeMobileDataExport(
  rawRows: RawLogRow[],
  canonicalRows: CanonicalEventRow[],
  exportedAt?: string,
): string {
  return JSON.stringify(buildMobileDataExport(rawRows, canonicalRows, exportedAt), null, 2);
}
