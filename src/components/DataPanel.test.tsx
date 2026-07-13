import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockParser } from '../parser/mockParser';
import { initializeAgymStore, useAgymStore } from '../state/store';
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

  it('requires exact typed delete plus browser confirmation before wiping state and storage', async () => {
    const user = userEvent.setup();
    const { adapter } = setup();
    const rawLog = makeRawLog();
    const event = makeCanonicalEvent();
    await adapter.saveRawLog(rawLog);
    await adapter.saveEvents([event]);
    await useAgymStore.getState().hydrate();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<DataPanel />);
    const button = screen.getByRole('button', { name: /delete all data/i });
    expect(button).toBeDisabled();

    await user.type(screen.getByPlaceholderText('delete'), 'Delete');
    expect(button).toBeDisabled();
    await user.clear(screen.getByPlaceholderText('delete'));
    await user.type(screen.getByPlaceholderText('delete'), 'delete');
    expect(button).toBeEnabled();
    await user.click(button);

    await waitFor(() => expect(useAgymStore.getState().events).toEqual([]));
    await expect(adapter.loadAll()).resolves.toEqual({ rawLogs: [], events: [] });
    expect(window.confirm).toHaveBeenCalled();
  });
});
