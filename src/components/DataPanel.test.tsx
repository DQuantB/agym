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

  it('requires typing a confirmation phrase before deleting the account, then erases data', async () => {
    const user = userEvent.setup();
    const { adapter } = setup();
    await adapter.saveRawLog(makeRawLog());
    await adapter.saveEvents([makeCanonicalEvent()]);
    const deleteSpy = vi.spyOn(adapter, 'deleteAll');

    render(<DataPanel />);

    // Not shown until the user opens the danger zone.
    expect(screen.queryByLabelText(/type .* to confirm/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /delete my account/i }));

    // The destructive button is disabled until the exact phrase is typed.
    const confirmButton = screen.getByRole('button', { name: /permanently delete everything/i });
    expect(confirmButton).toBeDisabled();

    const input = screen.getByLabelText(/type .* to confirm/i);
    await user.type(input, 'delete'); // wrong case
    expect(confirmButton).toBeDisabled();

    await user.clear(input);
    await user.type(input, 'DELETE');
    expect(confirmButton).toBeEnabled();

    await user.click(confirmButton);
    await waitFor(() => expect(deleteSpy).toHaveBeenCalledTimes(1));
  });

  it('can be cancelled without deleting', async () => {
    const user = userEvent.setup();
    const { adapter } = setup();
    const deleteSpy = vi.spyOn(adapter, 'deleteAll');

    render(<DataPanel />);
    await user.click(screen.getByRole('button', { name: /delete my account/i }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByLabelText(/type .* to confirm/i)).not.toBeInTheDocument();
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it('keeps individual raw logs non-deletable from the browser', () => {
    setup();
    render(<DataPanel />);
    expect(screen.getByText(/not browser-deletable/i)).toBeInTheDocument();
  });
});
