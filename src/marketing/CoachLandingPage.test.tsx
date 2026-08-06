import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CoachLandingPage } from './CoachLandingPage';

const insert = vi.fn();
let configured = true;

vi.mock('../lib/supabase', () => ({
  getSupabaseConfiguration: () => (configured ? { url: 'https://example.test', publishableKey: 'key' } : null),
  getSupabaseClient: () => ({
    from: () => ({ insert }),
  }),
}));

afterEach(() => {
  insert.mockReset();
  configured = true;
});

describe('CoachLandingPage', () => {
  it('renders the plan-versus-actual value proposition and keeps the workflow explicitly conceptual', () => {
    render(<CoachLandingPage />);

    expect(screen.getByRole('heading', { name: /plan is not their whole training week/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /clearer record of the week/i })).toBeInTheDocument();
    expect(screen.getByText(/prototype concept/i)).toBeInTheDocument();
    expect(screen.getByText(/when the athlete can preserve and confirm/i)).toBeInTheDocument();
    expect(screen.getByText(/not a medical device/i)).toBeInTheDocument();
  });

  it('submits an email lead and shows a confirmation', async () => {
    insert.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<CoachLandingPage />);

    await user.type(screen.getByLabelText(/email address/i), 'coach@example.test');
    await user.click(screen.getByRole('button', { name: /request early access/i }));

    await waitFor(() => expect(insert).toHaveBeenCalledWith({
      email: 'coach@example.test',
      coach_name: null,
      note: null,
    }));
    expect(await screen.findByRole('status')).toHaveTextContent(/you.re on the list/i);
  });

  it('shows an error and does not silently succeed when the submission fails', async () => {
    insert.mockResolvedValue({ error: { message: 'insert failed' } });
    const user = userEvent.setup();
    render(<CoachLandingPage />);

    await user.type(screen.getByLabelText(/email address/i), 'coach@example.test');
    await user.click(screen.getByRole('button', { name: /request early access/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/something went wrong/i);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows a fallback instead of a form when Supabase is not configured', () => {
    configured = false;
    render(<CoachLandingPage />);

    expect(screen.getByRole('status')).toHaveTextContent(/reply beta/i);
    expect(screen.queryByLabelText(/email address/i)).not.toBeInTheDocument();
  });
});
