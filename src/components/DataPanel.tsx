import { useState } from 'react';
import { useAgymStore } from '../state/store';
import { localStorageAdapter, localStorageKeys } from '../storage/localStorageAdapter';

function downloadJson(content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `agym-export-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

const DELETE_PHRASE = 'DELETE';

export function DataPanel() {
  const adapter = useAgymStore((state) => state.adapter);
  const deleteAll = useAgymStore((state) => state.deleteAll);
  const [hasLegacyLocalData] = useState(() => Boolean(
    localStorage.getItem(localStorageKeys.RAW) || localStorage.getItem(localStorageKeys.EVENTS),
  ));
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function runDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAll();
      // On the hosted adapter this also signs the user out; the AuthGate then
      // returns to the sign-in screen automatically.
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Account deletion failed.');
      setDeleting(false);
    }
  }

  return (
    <section className="panel">
      <h2>Data ownership</h2>
      <p className="warning">Your private-alpha data is stored under your signed-in account and protected by account-scoped access controls. AGym does not use it for analytics or model training without explicit consent.</p>
      <p className="warning">AGym summarizes self-reported log data only. It does not diagnose, treat, prescribe, or provide medical advice.</p>
      <button className="primary" onClick={async () => downloadJson(await adapter.exportAll())}>Export all JSON</button>
      {hasLegacyLocalData && (
        <section className="warning" aria-label="Local prototype data">
          <p>Local prototype data was found in this browser. It has not been uploaded to your private-alpha account.</p>
          <button className="ghost" onClick={async () => downloadJson(await localStorageAdapter.exportAll())}>Download local prototype JSON</button>
        </section>
      )}
      <hr />
      <section aria-label="Delete account">
        <h3>Delete my account</h3>
        <p className="microcopy">This permanently erases your AGym account and all associated data — raw logs, confirmed events, drafts, plans, agent authorizations, audit history, and consent records. This cannot be undone. Export your data first if you want a copy.</p>
        {!confirming ? (
          <button className="ghost" onClick={() => { setConfirming(true); setDeleteError(null); }}>Delete my account…</button>
        ) : (
          <div className="danger-zone">
            <label htmlFor="agym-delete-confirm">Type <strong>{DELETE_PHRASE}</strong> to confirm permanent deletion.</label>
            <input
              id="agym-delete-confirm"
              type="text"
              autoComplete="off"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              disabled={deleting}
            />
            <div className="danger-actions">
              <button
                className="danger"
                disabled={confirmText.trim() !== DELETE_PHRASE || deleting}
                onClick={() => void runDelete()}
              >
                {deleting ? 'Deleting…' : 'Permanently delete everything'}
              </button>
              <button className="ghost" disabled={deleting} onClick={() => { setConfirming(false); setConfirmText(''); setDeleteError(null); }}>Cancel</button>
            </div>
            {deleteError && <p role="alert" className="warning">{deleteError}</p>}
          </div>
        )}
      </section>
      <p className="microcopy">Individual raw logs are intentionally not browser-deletable so source evidence cannot be silently rewritten. Full account deletion above is the deliberate, all-or-nothing erasure path.</p>
    </section>
  );
}
