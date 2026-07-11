import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Parser } from '../parser/Parser';
import { initializeAgymStore, useAgymStore } from '../state/store';
import { createInMemoryStorageAdapter } from '../storage/inMemoryAdapter';
import { LogInput } from './LogInput';

function setup(parser: Parser) {
  const adapter = createInMemoryStorageAdapter();
  initializeAgymStore({ adapter, parser });
  render(<LogInput />);
  return { adapter };
}

describe('LogInput', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('disables submit when empty', () => {
    setup({ parse: vi.fn() });
    expect(screen.getByRole('button', { name: /parse log/i })).toBeDisabled();
  });

  it('stores raw text verbatim, passes date override to parser, and clears after submit resolves', async () => {
    const user = userEvent.setup();
    const parse = vi.fn(async ({ text, defaultDate, rawLogId }) => ({
      parserName: 'test-parser',
      warnings: [],
      events: [{ id: 'draft-1', rawLogId, date: defaultDate, time: null, payload: { kind: 'note' as const, text }, uncertaintyFlags: [], sourceText: text, parserVersion: 'test-parser', schemaVersion: 1 as const }],
    }));
    const { adapter } = setup({ parse });
    const rawText = '  Squat 3x8@80kg\nthen knee felt weird  ';

    await user.type(screen.getByLabelText(/training log/i), rawText);
    await user.clear(screen.getByLabelText(/^date/i));
    await user.type(screen.getByLabelText(/^date/i), '2026-07-10');
    await user.click(screen.getByRole('button', { name: /parse log/i }));

    await waitFor(() => expect(screen.getByLabelText(/training log/i)).toHaveValue(''));
    expect(parse).toHaveBeenCalledWith(expect.objectContaining({ text: rawText, defaultDate: '2026-07-10' }));
    const stored = await adapter.loadAll();
    expect(stored.rawLogs[0].text).toBe(rawText);
    expect(stored.rawLogs[0].defaultDate).toBe('2026-07-10');
    expect(useAgymStore.getState().drafts).toHaveLength(1);
  });
});
