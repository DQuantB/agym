# AGym MCP server

This is a local stdio MCP server for one explicitly configured AGym account.
It can be used by a supported local MCP client: `hermes`, `claude-code`, or
`codex`. The server is not a hosted endpoint and must remain on the user's
local machine.

## What `get_context` returns

- `confirmed_events`: user-confirmed canonical outcomes.
- `raw_notes`: immutable raw self-reports, explicitly labelled `raw_self_report` and `unparsed`.

It does **not** invoke an LLM, infer categories from raw notes, or treat agent
interpretation as canonical AGym data. The user-selected LLM in the local MCP
client interprets this bounded raw/confirmed context and may propose a plan;
AGym does not call a hosted server-side parser.

## Authorization and audit

Every call requires an active database `agent_authorizations` row matching:

```text
user_id + agent_identifier + action = read_context + revoked_at is null
```

Every successful call writes an `agent_audit_log` row. A missing or revoked
authorization returns an MCP tool error and no user context. Browser grants
are independent: the user must explicitly approve each required scope for each
of `hermes`, `claude-code`, and `codex`. For example, granting `read_context`
to `hermes` does not grant it to `claude-code`, and `write_proposed_plan` is a
separate approval from `read_context`.

`AGYM_AGENT_IDENTIFIER` is a fixed routing label, not a cryptographic client
identity. Use only one of the three identifiers above, and make it exactly
match the client named on the app's permission button and the local MCP process
environment. The authorization action checks, rather than a client identifier
or scope JSON by itself, are what decide whether an MCP action is allowed.

## Configuration

Configure the MCP server privately in the chosen local client's configuration.
The process needs these environment-variable names:

```text
AGYM_SUPABASE_URL
AGYM_SUPABASE_SERVICE_ROLE_KEY
AGYM_USER_ID
AGYM_AGENT_IDENTIFIER
```

The service-role key is intentionally required because this local MCP process
is not a browser session. Keep it in private local configuration only. Never
put it in `VITE_*`, browser code, Git, chat, or deployment environment
variables. Do not print it while troubleshooting.

Create one separate MCP-process configuration per local client. Set
`AGYM_AGENT_IDENTIFIER` exactly to `hermes`, `claude-code`, or `codex` for the
corresponding process, then use the matching app permission button to grant
each scope before making a real call. Point the process at this repository and
run `npm run mcp`; restarting or reloading the client may be required after a
configuration change.

Non-secret discovery/configuration checks:

```bash
hermes mcp test agym
claude mcp list
codex mcp list
```

These commands only establish that the client can discover its configured MCP
server. They do not bypass AGym authorization; a tool call remains blocked
until the signed-in user has granted that client's requested action in the app.

## Local verification

```bash
npm run typecheck
npm run mcp:smoke   # offline: config validation + all three tools register
npm run mcp         # starts the stdio server (needs private environment above)
```

With a running local Supabase stack, you can drive the full
read/write/audit round-trip against the database. Use private local MCP
configuration; do not print or paste secret values into a shell command.

```bash
npm run mcp:e2e
```

`mcp:e2e` self-seeds a user, exercises `get_context`, `create_proposed_plan`,
and `list_plans`, checks the append-only audit log grew, and proves that
revoking the user's `read_context` grant denies the agent. See
`docs/architecture/networked-alpha-verification.md` for the recorded results.

Running without the required environment variables intentionally exits with a
configuration error rather than starting an unbound MCP server.
