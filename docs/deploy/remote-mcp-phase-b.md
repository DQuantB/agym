# Remote MCP Phase B — deployment and verification

Status: foundation implemented; **do not deploy the current remote handler for Claude Desktop.** Claude’s custom remote-connector flow requires OAuth Dynamic Client Registration (DCR); the existing `mcp-test` Supabase authorization-server metadata has no `registration_endpoint`, while the current handler expects a static OAuth-client allowlist. That combination cannot complete Claude Desktop OAuth safely.

## Vercel endpoint

The Vercel project serves a stateless JSON Streamable HTTP endpoint:

```text
POST https://agym-murex.vercel.app/api/mcp
GET  https://agym-murex.vercel.app/.well-known/oauth-protected-resource/api/mcp
```

`GET` and `DELETE` on `/api/mcp` return `405`; Phase B does not use stateful sessions or SSE.

## Required Vercel server environment

Set these only in Vercel's server-function environment. They are not `VITE_*` values and must never enter browser code, Git, an MCP client configuration, or a terminal transcript.

```text
AGYM_REMOTE_SUPABASE_URL
AGYM_REMOTE_SUPABASE_PUBLISHABLE_KEY
AGYM_REMOTE_OAUTH_ISSUER
AGYM_REMOTE_MCP_RESOURCE
AGYM_REMOTE_CLIENTS_JSON
AGYM_REMOTE_ALLOWED_ORIGINS
```

Use:

- `AGYM_REMOTE_OAUTH_ISSUER`: `https://<project-ref>.supabase.co/auth/v1`
- `AGYM_REMOTE_MCP_RESOURCE`: exact canonical public endpoint, for example `https://agym-murex.vercel.app/api/mcp`
- `AGYM_REMOTE_CLIENTS_JSON`: legacy/static client mapping used by the current foundation. **Do not configure it for a Claude Desktop deployment**; Claude uses DCR, so this mapping must be replaced by reviewed DCR client-policy validation before deployment.
- `AGYM_REMOTE_ALLOWED_ORIGINS`: comma-separated browser origins that may initiate a request. Direct non-browser MCP clients normally send no Origin header and remain supported.

There is deliberately no service-role key and no static user ID in the remote runtime.

## OAuth compatibility gate — Claude Desktop

Before configuring Vercel runtime variables or deploying, use an OAuth 2.1 authorization server that satisfies Claude Desktop’s custom remote-connector requirements:

1. It advertises `authorization_endpoint`, `token_endpoint`, and `registration_endpoint` in public authorization-server metadata.
2. It supports OAuth Dynamic Client Registration (DCR), authorization-code flow, and PKCE `S256` for a public client.
3. Its DCR policy accepts only approved redirect URIs, including Claude’s documented custom-connector callback URI, rather than accepting arbitrary web origins.
4. It issues asymmetric JWTs/JWKS with AGym user identity, authenticated role, and the exact MCP resource audience.
5. The remote handler maps a validated DCR client to the fixed `remote-mcp` product identity without trusting tool input. The current `AGYM_REMOTE_CLIENTS_JSON` static allowlist implementation must be replaced before a Claude deployment.

The current `mcp-test` Supabase project is useful as an AGym data/RLS staging database, but its OAuth metadata was verified without a `registration_endpoint`; it cannot by itself authorize a Claude Desktop remote connector.

## User permission proof

1. In the signed-in AGym web app, open **Plans & agent access**.
2. Grant `Remote MCP client` read context and, separately, write proposed plans.
3. Complete OAuth authorization-code + PKCE in the registered MCP client.
4. Call `get_context` and verify returned raw notes remain labelled `raw_self_report` / `unparsed` and confirmed events remain `user_confirmed`.
5. Call `create_proposed_plan`, then verify the Plans tab shows `proposed` with agent-written provenance.
6. Revoke either permission in the app and repeat its corresponding call. It must be denied immediately and must not expose data or create a plan.

## Rollback

- Revoke the user's AGym action grant to stop the next tool call immediately.
- Remove the client ID from `AGYM_REMOTE_CLIENTS_JSON` and redeploy to block that OAuth client globally.
- Roll back the Vercel deployment if the endpoint behavior is unsafe.
- Do not weaken token audience checks, use a service-role key, or expose the legacy local stdio process as a workaround.
