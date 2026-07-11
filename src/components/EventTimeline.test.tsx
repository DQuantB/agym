import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeAgymStore, useAgymStore } from '../state/store';
import { createInMemoryStorageAdapter } from '../storage/inMemoryAdapter';
import { makeCanonicalEvent } from '../test/factories';
import { mockParser } from '../parser/mockParser';
import { EventTimeline } from './EventTimeline';

function setup() {
  const adapter = createInMemoryStorageAdapter();
  initializeAgymStore({ adapter, parser: mockParser });
  return { adapter };
}

describe('EventTimeline', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders empty state', () => {
    setup();
    render(<EventTimeline />);
    expect(screen.getByText(/no confirmed events yet/i)).toBeInTheDocument();
  });

  it('groups events by local date newest first and shows key facts and flags', async () => {
    const { adapter } = setup();
    const older = makeCanonicalEvent({ id: 'older', date: '2026-07-10', time: '23:55', payload: { kind: 'bodyweight', weightKg: 82 }, originalPayload: { kind: 'bodyweight', weightKg: 82 } });
    const newer = makeCanonicalEvent({ id: 'newer', date: '2026-07-11', time: '00:05', payload: { kind: 'meal', description: 'oats', kcal: 500, proteinG: null }, originalPayload: { kind: 'meal', description: 'oats', kcal: 500, proteinG: null }, uncertaintyFlags: [{ field: 'payload.proteinG', reason: 'not stated' }] });
    await adapter.saveEvents([older, newer]);
    await useAgymStore.getState().hydrate();

    render(<EventTimeline />);

    expect(screen.getByRole('heading', { name: '2026-07-11' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '2026-07-10' })).toBeInTheDocument();
    expect(screen.getByText(/oats · 500 kcal/i)).toBeInTheDocument();
    expect(screen.getByText(/82 kg/i)).toBeInTheDocument();
    expect(screen.getByText(/uncertain/i)).toBeInTheDocument();
    expect(screen.getByText('2026-07-11').compareDocumentPosition(screen.getByText('2026-07-10')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('deletes only after confirmation and persists through rehydrate', async () => {
    const user = userEvent.setup();
    const { adapter } = setup();
    const event = makeCanonicalEvent({ id: 'delete-me', date: '2026-07-11' });
    await adapter.saveEvents([event]);
    await useAgymStore.getState().hydrate();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<EventTimeline />);
    await user.click(screen.getByRole('button', { name: /delete event/i }));

    await waitFor(() => expect(useAgymStore.getState().events).toEqual([]));
    const freshAdapterState = await adapter.loadAll();
    expect(freshAdapterState.events).toEqual([]);
  });
});
