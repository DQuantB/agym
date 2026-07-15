import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PlansView } from './PlansView';

type Authorization = {
  id: string;
  agent_identifier: string;
  action: 'read_context' | 'write_proposed_plan';
  granted_at: string;
  revoked_at: string | null;
};

type QueryResult = { data: unknown; error: { message: string; code?: string } | null };

function result(data: unknown, error: QueryResult['error'] = null) {
  return Promise.resolve({ data, error });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

function createClient({
  user = { id: 'user-1' } as { id: string } | null,
  authorizations = [] as Authorization[],
  getUser = vi.fn(() => result({ user })),
  insertResult = result(null),
  revokeResult = result([{ id: 'revoked-id' }]),
}: {
  user?: { id: string } | null;
  authorizations?: Authorization[];
  getUser?: ReturnType<typeof vi.fn>;
  insertResult?: Promise<QueryResult>;
  revokeResult?: Promise<QueryResult>;
} = {}) {
  const authorizationQuery = {
    order: vi.fn(() => result(authorizations)),
    eq: vi.fn(() => authorizationQuery),
  };
  const planQuery = {
    is: vi.fn(() => planQuery),
    order: vi.fn(() => result([])),
  };
  const authorizationSelect = vi.fn(() => authorizationQuery);
  const planSelect = vi.fn(() => planQuery);
  const insert = vi.fn(() => insertResult);
  const revokeSelect = vi.fn(() => revokeResult);
  const revokeQuery = { is: vi.fn(() => ({ select: revokeSelect })) };
  const update = vi.fn(() => ({ eq: vi.fn(() => revokeQuery) }));
  const from = vi.fn((table: string) => table === 'plans'
    ? { select: planSelect }
    : { select: authorizationSelect, insert, update });

  return {
    client: { from, auth: { getUser } } as never,
    from,
    authorizationQuery,
    insert,
    update,
    revokeQuery,
    revokeSelect,
    getUser,
  };
}

describe('PlansView browser authorizations', () => {
  it('shows the fixed client catalogue, scoped accessible controls, and loads all authorization records without an agent filter', async () => {
    const mock = createClient();
    render(<PlansView client={mock.client} />);

    await screen.findByRole('heading', { name: 'Claude Code permissions' });
    expect(screen.getByRole('heading', { name: 'Hermes permissions' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Codex permissions' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Allow Codex to read bounded context' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Allow Codex to write proposed plans' })).toBeInTheDocument();
    expect(screen.getAllByText(/bounded immutable raw self-reports and confirmed outcomes/i)).toHaveLength(3);
    expect(screen.getAllByText(/only makes proposals and cannot confirm outcomes/i)).toHaveLength(3);
    expect(mock.authorizationQuery.eq).not.toHaveBeenCalled();
    expect(mock.authorizationQuery.order).toHaveBeenCalledWith('granted_at', { ascending: false });
    expect(screen.getByText(/no agent-authored proposals yet/i)).toBeInTheDocument();
  });

  it('grants Claude Code and Codex independently with the exact scoped payload', async () => {
    const user = userEvent.setup();
    const mock = createClient();
    render(<PlansView client={mock.client} />);
    await screen.findByRole('heading', { name: 'Claude Code permissions' });

    await user.click(screen.getByRole('button', { name: 'Allow Claude Code to read bounded context' }));
    await waitFor(() => expect(mock.insert).toHaveBeenCalledWith({
      user_id: 'user-1', agent_identifier: 'claude-code', action: 'read_context', scope: { version: 1 },
    }));

    await user.click(screen.getByRole('button', { name: 'Allow Codex to write proposed plans' }));
    await waitFor(() => expect(mock.insert).toHaveBeenLastCalledWith({
      user_id: 'user-1', agent_identifier: 'codex', action: 'write_proposed_plan', scope: { version: 1 },
    }));
  });

  it('keeps successful grant feedback visible after its refresh completes', async () => {
    const user = userEvent.setup();
    const mock = createClient();
    render(<PlansView client={mock.client} />);
    await screen.findByRole('button', { name: 'Allow Codex to read bounded context' });

    await user.click(screen.getByRole('button', { name: 'Allow Codex to read bounded context' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/codex permission granted/i);
    await waitFor(() => expect(mock.authorizationQuery.order).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('status')).toHaveTextContent(/codex permission granted/i);
  });

  it('disables only the pending scope and prevents double-click grant mutations', async () => {
    const user = userEvent.setup();
    const pendingUser = deferred<QueryResult>();
    const mock = createClient({ getUser: vi.fn(() => pendingUser.promise) });
    render(<PlansView client={mock.client} />);
    const readButton = await screen.findByRole('button', { name: 'Allow Codex to read bounded context' });
    const writeButton = screen.getByRole('button', { name: 'Allow Codex to write proposed plans' });

    await user.click(readButton);
    expect(readButton).toBeDisabled();
    expect(writeButton).not.toBeDisabled();
    await user.click(readButton);
    expect(mock.getUser).toHaveBeenCalledTimes(1);

    pendingUser.resolve({ data: { user: { id: 'user-1' } }, error: null });
    await waitFor(() => expect(mock.insert).toHaveBeenCalledTimes(1));
  });

  it('refuses an unauthenticated grant before attempting an insert', async () => {
    const user = userEvent.setup();
    const mock = createClient({ user: null });
    render(<PlansView client={mock.client} />);
    await screen.findByRole('heading', { name: 'Hermes permissions' });

    await user.click(screen.getByRole('button', { name: 'Allow Hermes to read bounded context' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/could not verify your signed-in account/i);
    expect(mock.insert).not.toHaveBeenCalled();
  });

  it('shows a user-visible message when authentication lookup rejects', async () => {
    const user = userEvent.setup();
    const mock = createClient({ getUser: vi.fn(() => Promise.reject(new Error('network unavailable'))) });
    render(<PlansView client={mock.client} />);
    await screen.findByRole('button', { name: 'Allow Hermes to read bounded context' });

    await user.click(screen.getByRole('button', { name: 'Allow Hermes to read bounded context' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/could not grant hermes permission: network unavailable/i);
  });

  it('treats a duplicate active grant conflict as non-success feedback', async () => {
    const user = userEvent.setup();
    const mock = createClient({ insertResult: result(null, { message: 'duplicate key value violates unique constraint', code: '23505' }) });
    render(<PlansView client={mock.client} />);
    await screen.findByRole('button', { name: 'Allow Codex to read bounded context' });

    await user.click(screen.getByRole('button', { name: 'Allow Codex to read bounded context' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/already has this permission active.*refresh/i);
    expect(screen.getByRole('status')).not.toHaveTextContent(/permission granted/i);
  });

  it('revokes the selected client authorization using its id, active-record filter, and returned rows', async () => {
    const user = userEvent.setup();
    const mock = createClient({ authorizations: [{
      id: 'codex-read-1', agent_identifier: 'codex', action: 'read_context', granted_at: '2026-07-15T12:00:00.000Z', revoked_at: null,
    }] });
    render(<PlansView client={mock.client} />);
    await screen.findByRole('region', { name: 'Codex permissions' });

    await user.click(screen.getByRole('button', { name: 'Revoke Codex permission to read bounded context' }));
    await waitFor(() => expect(mock.update).toHaveBeenCalledWith(expect.objectContaining({ revoked_at: expect.any(String) })));
    const eq = mock.update.mock.results[0].value.eq;
    expect(eq).toHaveBeenCalledWith('id', 'codex-read-1');
    expect(mock.revokeQuery.is).toHaveBeenCalledWith('revoked_at', null);
    expect(mock.revokeSelect).toHaveBeenCalledWith('id');
  });

  it('reports a stale revoke that updates no active authorization instead of claiming success', async () => {
    const user = userEvent.setup();
    const mock = createClient({
      authorizations: [{ id: 'codex-read-1', agent_identifier: 'codex', action: 'read_context', granted_at: '2026-07-15T12:00:00.000Z', revoked_at: null }],
      revokeResult: result([]),
    });
    render(<PlansView client={mock.client} />);
    await screen.findByRole('button', { name: 'Revoke Codex permission to read bounded context' });

    await user.click(screen.getByRole('button', { name: 'Revoke Codex permission to read bounded context' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/already revoked or changed.*refresh/i);
    expect(screen.getByRole('status')).not.toHaveTextContent(/permission revoked\. future/i);
  });

  it('shows a user-visible message when revoke rejects unexpectedly', async () => {
    const user = userEvent.setup();
    const pendingRevoke = deferred<QueryResult>();
    const mock = createClient({
      authorizations: [{ id: 'codex-read-1', agent_identifier: 'codex', action: 'read_context', granted_at: '2026-07-15T12:00:00.000Z', revoked_at: null }],
      revokeResult: pendingRevoke.promise,
    });
    render(<PlansView client={mock.client} />);
    await screen.findByRole('button', { name: 'Revoke Codex permission to read bounded context' });

    await user.click(screen.getByRole('button', { name: 'Revoke Codex permission to read bounded context' }));
    pendingRevoke.reject(new Error('network unavailable'));
    expect(await screen.findByRole('status')).toHaveTextContent(/could not revoke codex permission: network unavailable/i);
  });
});
