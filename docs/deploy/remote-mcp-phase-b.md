# Remote MCP Phase B — Supabase OAuth deployment and verification

Status: **staging deployment pending.** The client-ID-aware confinement migration and remote-only grant-checking RPCs are implemented and have passed a local database proof. Do not enable Supabase OAuth/DCR or deploy until the staging acceptance proof below succeeds.

## Architecture

AGym uses Supabase's native OAuth 2.1 server as both the authorization server and the issuer of the user bearer token consumed by the remote MCP handler:

```text
compatible MCP client → Supabase OAuth 2.1 + DCR + PKCE S256
                      → AGym consent screen
                      → Supabase user JWT (sub + role=authenticated + client_id)
                      → AGym Streamable HTTP MCP handler
                      → Supabase RLS + AGym per-action authorization
```

The remote runtime has no service-role key, no static user ID, no Keycloak credential, and no token bridge. A verified Supabase OAuth token is used only in memory for the matching request.

Dynamic registration is deliberately open to compatible MCP clients. The user must explicitly approve the OAuth request at `/oauth/consent`, and a valid OAuth token still grants no AGym data access without the separately revocable `agent_authorizations` grants for `remote-mcp`.

## Enforced database confinement

A user JWT with a non-empty `client_id` is treated as an OAuth-connected remote client. Restrictive RLS policies deny it direct PostgREST access to every AGym user-data, authorization, and audit table. The remote handler calls only these `SECURITY DEFINER` RPCs, each of which re-checks `auth.uid()`, the OAuth `client_id`, and the active fixed `remote-mcp` grant:

- `remote_mcp_get_context`
- `remote_mcp_list_plans`
- `remote_mcp_create_proposed_plan`

The RPCs derive the user and fixed agent identity internally; they accept neither a user ID nor an authorization ID nor an agent identifier. Browser sessions without `client_id` retain the existing owner-scoped RLS surface.

Local proof applied the full migration chain and verified: direct raw-log/grant/plan reads return zero rows for an OAuth-marked token; no read grant is denied and audited; a granted token reads only its own context and creates only an `agent_written_plan` with `proposed` status; direct plan reads remain denied; and revocation denies and audits the next read. The proof recorded two successful actions and two denied attempts, all without bearer-token material in the audit metadata.

## One-time Supabase dashboard configuration

In the **agym-alpha** project (`pcicmvrzouurdmrdauwz`):

1. Open **Authentication → OAuth Server**.
2. Enable the OAuth 2.1 server.
3. Set the authorization path to `/oauth/consent`.
4. Enable Dynamic Client Registration for MCP-compatible clients.
5. Confirm the project Site URL is `https://agym-murex.vercel.app` and that the URL configuration permits the `/oauth/consent` magic-link return URL.
6. Use asymmetric JWT signing keys before production OAuth use; the remote handler validates the public JWKS and will not receive a JWT signing secret.

Verify public discovery afterwards:

```text
GET https://pcicmvrzouurdmrdauwz.supabase.co/.well-known/oauth-authorization-server/auth/v1
```

It must return JSON with the project issuer, authorization endpoint, token endpoint, JWKS endpoint, and `registration_endpoint`.

## Required Vercel server environment

Set only these server-function values. They are not `VITE_*` values and must never enter browser code, Git, an MCP client configuration, or a terminal transcript.

```text
AGYM_REMOTE_SUPABASE_URL=https://pcicmvrzouurdmrdauwz.supabase.co
AGYM_REMOTE_SUPABASE_PUBLISHABLE_KEY=<project publishable key>
AGYM_REMOTE_OAUTH_ISSUER=https://pcicmvrzouurdmrdauwz.supabase.co/auth/v1
AGYM_REMOTE_MCP_RESOURCE=https://agym-murex.vercel.app/api/mcp
AGYM_REMOTE_ALLOWED_ORIGINS=https://agym-murex.vercel.app
```

Do not configure `AGYM_REMOTE_CLIENTS_JSON`; it was removed with the legacy static-client foundation.

## Endpoints

```text
POST https://agym-murex.vercel.app/api/mcp
GET  https://agym-murex.vercel.app/.well-known/oauth-protected-resource/api/mcp
```

Unauthenticated `POST /api/mcp` must return `401` with a canonical protected-resource metadata URL. `GET` and `DELETE` on `/api/mcp` must return `405`.

## Staging acceptance proof

1. Use the actual Claude custom remote-connector UI to discover the protected resource and perform DCR.
2. Complete authorization-code + PKCE S256. Confirm the AGym consent page displays the client name, its registered callback, and requested scopes before approval.
3. Create two staging users with disjoint records. Prove each identity receives only its own bounded raw/canonical context through `get_context`.
4. For each user, grant `remote-mcp` `read_context` and `write_proposed_plan` separately in **Plans & agent access**. Confirm each corresponding tool is denied before its grant and succeeds after it.
5. Revoke each grant and confirm the very next matching tool call is denied.
6. Confirm successful reads/writes and denied attempts follow the established audit convention; proposed plans remain `agent_written_plan` and `proposed`.
7. Check that the MCP client never displays a Supabase access token, and that Vercel logs/outputs contain no bearer token.

## Rollback

1. Revoke the user's `agent_authorizations` grant to stop the next matching MCP call.
2. Disable Dynamic Client Registration and/or OAuth Server in Supabase to stop new OAuth authorizations.
3. Roll back the Vercel deployment if handler behavior is unsafe.
4. Retain audit evidence. Do not use a service-role fallback or change RLS policies as a rollback workaround.
