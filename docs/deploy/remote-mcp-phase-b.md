# Remote MCP Phase B — deployment and verification

Status: implementation ready; **do not deploy until the OAuth pre-flight gate below is complete.**

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
- `AGYM_REMOTE_CLIENTS_JSON`: JSON mapping of verified OAuth client IDs to fixed AGym identifiers, initially `remote-mcp`; for example `{"<verified-client-id>":"remote-mcp"}`.
- `AGYM_REMOTE_ALLOWED_ORIGINS`: comma-separated browser origins that may initiate a request. Direct non-browser MCP clients normally send no Origin header and remain supported.

There is deliberately no service-role key and no static user ID in the remote runtime.

## Required Supabase OAuth pre-flight

1. In a staging Supabase project, enable the OAuth 2.1 Server and configure its consent/authorization UI.
2. Pre-register one compatible MCP OAuth client with an exact redirect URI. Do not enable dynamic client registration in the initial release.
3. Configure the access token for this protected resource and verify it contains the standard identity claims, `client_id`, and the configured MCP resource audience.
4. Use asymmetric JWT signing/JWKS. The endpoint validates issuer, expiry, audience, UUID subject, authenticated role, and allowlisted client ID.
5. Only after staging proof, repeat the configuration for production.

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
