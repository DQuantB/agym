import { describe, expect, it, vi } from 'vitest';

import { deleteAccountAndClearLocalData } from './accountDeletion';
import { buildMobileDataExport, serializeMobileDataExport } from './mobileDataExport';

describe('mobile data export', () => {
  it('keeps raw self-reports and user-confirmed outcomes separately labelled', () => {
    const exported = buildMobileDataExport(
      [{ client_id: 'raw-1', raw_text: 'Squat 3x8', logged_for_date: '2026-07-24', created_at: '2026-07-24T08:00:00Z' }],
      [{ client_id: 'event-1', final_fields: { kind: 'workout', exercise: 'Squat' }, confirmed_at: '2026-07-24T08:03:00Z' }],
      '2026-07-24T09:00:00Z',
    );

    expect(exported).toEqual({
      schemaVersion: 1,
      exportedAt: '2026-07-24T09:00:00Z',
      rawSelfReports: [{
        provenance: 'raw_self_report',
        clientId: 'raw-1',
        rawText: 'Squat 3x8',
        loggedForDate: '2026-07-24',
        createdAt: '2026-07-24T08:00:00Z',
      }],
      userConfirmedOutcomes: [{
        provenance: 'user_confirmed',
        clientId: 'event-1',
        finalFields: { kind: 'workout', exercise: 'Squat' },
        confirmedAt: '2026-07-24T08:03:00Z',
      }],
    });
    expect(JSON.parse(serializeMobileDataExport([], [], '2026-07-24T09:00:00Z'))).toMatchObject({ schemaVersion: 1 });
  });

  it('rejects malformed rows instead of exporting an untrustworthy record', () => {
    expect(() => buildMobileDataExport(
      [{ client_id: 'raw-1', raw_text: '', logged_for_date: '2026-07-24', created_at: '2026-07-24T08:00:00Z' }],
      [],
      '2026-07-24T09:00:00Z',
    )).toThrow('raw log raw_text was missing or invalid');

    expect(() => buildMobileDataExport(
      [],
      [{ client_id: 'event-1', final_fields: [], confirmed_at: '2026-07-24T08:03:00Z' }],
      '2026-07-24T09:00:00Z',
    )).toThrow('canonical event final_fields was missing or invalid');
  });
});

describe('account deletion local-data boundary', () => {
  it('clears local drafts only after remote deletion succeeds, then signs out', async () => {
    const events: string[] = [];
    await deleteAccountAndClearLocalData('user-1', {
      deleteRemoteAccount: async () => { events.push('remote'); },
      clearLocalDrafts: async (userId) => { events.push(`clear:${userId}`); },
      signOut: async () => { events.push('signout'); },
    });

    expect(events).toEqual(['remote', 'clear:user-1', 'signout']);
  });

  it('retains local drafts and session when remote deletion fails', async () => {
    const clearLocalDrafts = vi.fn();
    const signOut = vi.fn();

    await expect(deleteAccountAndClearLocalData('user-1', {
      deleteRemoteAccount: async () => { throw new Error('remote deletion failed'); },
      clearLocalDrafts,
      signOut,
    })).rejects.toThrow('remote deletion failed');

    expect(clearLocalDrafts).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });
});
