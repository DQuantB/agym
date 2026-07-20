import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OAuthConsent } from './OAuthConsent';

const getAuthorizationDetails = vi.fn();

vi.mock('../lib/supabase', () => ({
  getSupabaseClient: () => ({
    auth: {
      oauth: {
        getAuthorizationDetails,
        approveAuthorization: vi.fn(),
        denyAuthorization: vi.fn(),
      },
    },
  }),
}));

afterEach(() => {
  getAuthorizationDetails.mockReset();
  window.history.replaceState({}, '', '/');
});

describe('OAuthConsent', () => {
  it('rejects a missing authorization identifier without contacting Supabase', () => {
    render(<OAuthConsent />);

    expect(screen.getByRole('status')).toHaveTextContent(/missing its identifier/i);
    expect(getAuthorizationDetails).not.toHaveBeenCalled();
  });

  it('shows the registered client, redirect URI, requested scopes, and AGym action-grant boundary', async () => {
    window.history.replaceState({}, '', '/oauth/consent?authorization_id=authorization-123');
    getAuthorizationDetails.mockResolvedValue({
      data: {
        authorization_id: 'authorization-123',
        client: { name: 'Claude', uri: 'https://claude.ai', logo_uri: '' },
        redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
        scope: 'openid email',
      },
      error: null,
    });

    render(<OAuthConsent />);

    await waitFor(() => expect(getAuthorizationDetails).toHaveBeenCalledWith('authorization-123'));
    expect(await screen.findByText('Claude', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText(/claude\.ai\/api\/mcp\/auth_callback/i)).toBeInTheDocument();
    expect(screen.getByText(/openid email/i)).toBeInTheDocument();
    expect(screen.getByText(/separately protected/i)).toBeInTheDocument();
  });
});
