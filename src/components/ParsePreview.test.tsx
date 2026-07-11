import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockParser } from '../parser/mockParser';
import { initializeAgymStore, useAgymStore } from '../state/store';
import { createInMemoryStorageAdapter } from '../storage/inMemoryAdapter';
import { ParsePreview } from './ParsePreview';

function stubIds() {
  let index = 0;
  Object.defineProperty(globalThis, 'crypto', { value: { randomUUID: () => `preview-${++index}` }, configurable: true });
}

async function setupWithDraft() {
  const adapter = createInMemoryStorageAdapter();
  initializeAgymStore({ adapter, parser: mockParser });
  await useAgymStore.getState().submitLog('lunch: chicken rice bowl, about 750 kcal', '2026-07-11');
  render(<ParsePreview />);
  return { adapter };
}

describe('ParsePreview and EventEditor', () => {
  beforeEach(() => {
    stubIds();
    vi.restoreAllMocks();
  });

  it('shows empty draft state', () => {
    initializeAgymStore({ adapter: createInMemoryStorageAdapter(), parser: mockParser });
    render(<ParsePreview />);
    expect(screen.getByText(/no active parsed draft/i)).toBeInTheDocument();
  });

  it('edits a flagged payload field, clears the badge, and confirms editedByUser', async () => {
    const user = userEvent.setup();
    const { adapter } = await setupWithDraft();

    expect(screen.getByText(/uncertain/i)).toBeInTheDocument();
    const textarea = screen.getByLabelText(/meal payload json/i);
    fireEvent.change(textarea, { target: { value: JSON.stringify({ kind: 'meal', description: 'chicken rice bowl plus yogurt', kcal: 900, proteinG: 55 }) } });

    expect(screen.queryByText(/uncertain/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(useAgymStore.getState().events).toHaveLength(1));
    const event = useAgymStore.getState().events[0];
    expect(event.editedByUser).toBe(true);
    expect(event.originalPayload).not.toEqual(event.payload);
    await expect(adapter.loadAll()).resolves.toMatchObject({ events: [event] });
  });

  it('switches payload type while preserving date and source text', async () => {
    const user = userEvent.setup();
    await setupWithDraft();
    const original = useAgymStore.getState().drafts[0];

    await user.selectOptions(screen.getByLabelText(/type/i), 'note');

    const draft = useAgymStore.getState().drafts[0];
    expect(draft.date).toBe(original.date);
    expect(draft.sourceText).toBe(original.sourceText);
    expect(draft.payload.kind).toBe('note');
  });

  it('confirm-all persists all drafts and discard-all clears active drafts', async () => {
    const user = userEvent.setup();
    initializeAgymStore({ adapter: createInMemoryStorageAdapter(), parser: mockParser });
    await useAgymStore.getState().submitLog('Squat 3x8@80kg; bench 3x5 @ 60kg', '2026-07-11');
    render(<ParsePreview />);

    await user.click(screen.getByRole('button', { name: /confirm all/i }));
    await waitFor(() => expect(useAgymStore.getState().drafts).toEqual([]));
    expect(useAgymStore.getState().events).toHaveLength(2);

    await act(async () => {
      await useAgymStore.getState().submitLog('sleep 7h good', '2026-07-11');
    });
    await user.click(screen.getByRole('button', { name: /discard all/i }));
    expect(useAgymStore.getState().drafts).toEqual([]);
  });
});
