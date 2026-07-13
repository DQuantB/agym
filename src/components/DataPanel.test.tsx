import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockParser } from '../parser/mockParser';
import { initializeAgymStore } from '../state/store';
import { createInMemoryStorageAdapter } from '../storage/inMemoryAdapter';
import { makeCanonicalEvent, makeRawLog } from '../test/factories';
import { ExportSchema } from '../domain/schemas';
import { DataPanel } from './DataPanel';

function setup() {
  const adapter = createInMemoryStorageAdapter();
  initializeAgymStore({ adapter, parser: mockParser });
  return { adapter };
}

describe('DataPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('exports complete valid JSON when populated and when empty', async () => {
    const user = userEvent.setup();
    const { adapter } = setup();
    await adapter.saveRawLog(makeRawLog());
    await adapter.saveEvents([makeCanonicalEvent()]);

    let capturedBlob: Blob | undefined;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => { capturedBlob = blob as Blob; return 'blob:agym-export'; });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    render(<DataPanel />);
    const exportButton = screen.getByRole('button', { name: /export all json/i });
    expect(exportButton).toHaveClass('primary');
    await user.click(exportButton);

    await waitFor(() => expect(capturedBlob).toBeDefined());
    const exported = ExportSchema.parse(JSON.parse(await capturedBlob!.text()));
    expect(exported.rawLogs).toHaveLength(1);
    expect(exported.events).toHaveLength(1);

    await adapter.deleteAll();
    await user.click(screen.getByRole('button', { name: /export all json/i }));
    const emptyExport = ExportSchema.parse(JSON.parse(await capturedBlob!.text()));
    expect(emptyExport.rawLogs).toEqual([]);
    expect(emptyExport.events).toEqual([]);
  });

  it('explains why hosted raw-log deletion is deferred to an audited account workflow', () => {
    setup();
    render(<DataPanel />);

    expect(screen.queryByRole('button', { name: /delete all data/i })).not.toBeInTheDocument();
    expect(screen.getByText(/not browser-deletable/i)).toBeInTheDocument();
  });
});
