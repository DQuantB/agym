import { useState } from 'react';
import { useAgymStore } from '../state/store';

function downloadJson(content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `agym-export-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function DataPanel() {
  const adapter = useAgymStore((state) => state.adapter);
  const deleteAll = useAgymStore((state) => state.deleteAll);
  const [confirmText, setConfirmText] = useState('');

  return (
    <section className="panel">
      <h2>Data ownership</h2>
      <p className="warning">Data stays on this device in plaintext browser localStorage. There is no backend sync, no analytics, and no account deletion because v0 has no accounts.</p>
      <p className="warning">AGym summarizes self-reported log data only. It does not diagnose, treat, prescribe, or provide medical advice.</p>
      <button className="primary" onClick={async () => downloadJson(await adapter.exportAll())}>Export all JSON</button>
      <hr />
      <label>
        Type “delete” to wipe all local AGym data
        <input value={confirmText} onChange={(event) => setConfirmText(event.target.value)} placeholder="delete" />
      </label>
      <button
        className="danger"
        disabled={confirmText !== 'delete'}
        onClick={async () => {
          if (!confirm('Delete all AGym data from this browser? This cannot be undone.')) return;
          await deleteAll();
          setConfirmText('');
        }}
      >
        Delete all data
      </button>
    </section>
  );
}
