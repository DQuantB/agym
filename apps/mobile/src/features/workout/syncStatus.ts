import type { LocalSyncState } from './localDraftStore';

export type SyncBadge = {
  label: string;
  detail: string;
  tone: 'neutral' | 'proposal' | 'confirmed' | 'warning';
  glyph: string;
  canRetry: boolean;
  accessibilityLabel: string;
};

export function describeSyncState(state: LocalSyncState, lastSyncError?: string | null): SyncBadge {
  switch (state) {
    case 'saved_locally':
      return {
        label: 'Saved locally', detail: 'Saved on this device. Syncs to your account automatically.',
        tone: 'neutral', glyph: '●', canRetry: false,
        accessibilityLabel: 'Saved locally. Syncs to your account automatically.',
      };
    case 'syncing':
      return {
        label: 'Syncing…', detail: 'Sending your saved progress to your account.',
        tone: 'proposal', glyph: '●', canRetry: false,
        accessibilityLabel: 'Syncing. Sending your saved progress to your account.',
      };
    case 'synced':
      return {
        label: 'Synced', detail: 'Your progress is saved to your account.',
        tone: 'confirmed', glyph: '✓', canRetry: false,
        accessibilityLabel: 'Synced. Your progress is saved to your account.',
      };
    case 'sync_failed':
      return {
        label: 'Sync failed — retry', detail: `Saved locally, but not yet synced.${lastSyncError ? ` ${lastSyncError}.` : ''} A connected LLM cannot read this session until sync succeeds.`,
        tone: 'warning', glyph: '!', canRetry: true,
        accessibilityLabel: `Sync failed. Saved locally.${lastSyncError ? ` ${lastSyncError}.` : ''} A connected LLM cannot read this session until sync succeeds. Retry available.`,
      };
  }
}
