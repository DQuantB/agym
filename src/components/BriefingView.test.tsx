import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockParser } from '../parser/mockParser';
import { initializeAgymStore, useAgymStore } from '../state/store';
import { createInMemoryStorageAdapter } from '../storage/inMemoryAdapter';
import { makeCanonicalEvent } from '../test/factories';
import { BriefingView } from './BriefingView';

function setup() {
  initializeAgymStore({ adapter: createInMemoryStorageAdapter(), parser: mockParser });
}

describe('BriefingView', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders an empty briefing without error', () => {
    setup();
    render(<BriefingView />);
    expect(screen.getByText(/confirmed events: 0/i)).toBeInTheDocument();
    expect(screen.getByText(/not medical advice/i)).toBeInTheDocument();
  });

  it('regenerates when the date range changes, copies exact markdown, and downloads .md', async () => {
    const user = userEvent.setup();
    setup();
    useAgymStore.setState({
      events: [
        makeCanonicalEvent({ id: 'in-range', date: '2026-07-11', payload: { kind: 'note', text: 'in range note' }, originalPayload: { kind: 'note', text: 'in range note' } }),
        makeCanonicalEvent({ id: 'out-range', date: '2026-06-01', payload: { kind: 'note', text: 'old note' }, originalPayload: { kind: 'note', text: 'old note' } }),
      ],
    });
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    let capturedBlob: Blob | undefined;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => { capturedBlob = blob as Blob; return 'blob:briefing'; });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    render(<BriefingView />);
    await user.clear(screen.getByLabelText(/briefing from date/i));
    await user.type(screen.getByLabelText(/briefing from date/i), '2026-07-01');
    await user.clear(screen.getByLabelText(/briefing to date/i));
    await user.type(screen.getByLabelText(/briefing to date/i), '2026-07-14');

    const markdown = screen.getByText(/in range note/i).textContent ?? '';
    expect(screen.queryByText(/old note/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /copy markdown/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining('in range note')));
    expect(screen.getByRole('status')).toHaveTextContent(/copied/i);

    await user.click(screen.getByRole('button', { name: /download .md/i }));
    await waitFor(() => expect(capturedBlob).toBeDefined());
    expect(await capturedBlob!.text()).toContain('in range note');
    expect(markdown).toContain('in range note');
  });
});
