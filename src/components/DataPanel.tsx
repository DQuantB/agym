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

export function DataPanel() {
  const adapter = useAgymStore((state) => state.adapter);
  const [hasLegacyLocalData] = useState(() => Boolean(
    localStorage.getItem(localStorageKeys.RAW) || localStorage.getItem(localStorageKeys.EVENTS),
  ));

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
      <p className="microcopy">Account-wide deletion will be available as an explicit, audited request flow. Raw logs are intentionally not browser-deletable so source evidence cannot be silently rewritten.</p>
    </section>
  );
}
