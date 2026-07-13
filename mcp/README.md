# AGym MCP server

This is a local stdio MCP server for a single explicitly configured AGym account. It exposes only the bounded `get_context` read tool in the first alpha slice.

## What `get_context` returns

- `confirmed_events`: user-confirmed canonical outcomes.
- `raw_notes`: immutable raw self-reports, explicitly labelled `raw_self_report` and `unparsed`.

It does **not** invoke an LLM, infer categories from raw notes, or treat agent interpretation as canonical AGym data.

## Authorization and audit

Every call requires an active database `agent_authorizations` row matching:

```text
user_id + agent_identifier + action = read_context + revoked_at is null
```

Every successful call writes an `agent_audit_log` row. A missing or revoked authorization returns an MCP tool error and no user context.

## Configuration

Set server-only values in the process environment; see `.env.example`. The service-role key is intentionally required because the MCP process is not a browser session. Never put it in `VITE_*`, the web app, Git, or chat.

Hermes configuration shape:

```yaml
mcp_servers:
  agym:
    command: npm
    args: ["run", "mcp"]
    env:
      AGYM_SUPABASE_URL: "https://your-project-ref.supabase.co"
      AGYM_SUPABASE_SERVICE_ROLE_KEY: "server-only value"
      AGYM_USER_ID: "the authorized user's auth UUID"
      AGYM_AGENT_IDENTIFIER: "hermes"
```

Restart Hermes after adding this configuration. It will discover the tool as `mcp_agym_get_context`.

## Local verification

```bash
npm run typecheck
npm run mcp
```

Running without the required environment variables intentionally exits with a configuration error rather than starting an unbound MCP server.
