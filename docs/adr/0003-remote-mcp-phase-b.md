# ADR 0003 — Phase B: Remote OAuth-protected MCP

Status: accepted
Date: 2026-07-16; amended 2026-07-20
Supersedes: ADR 0002 only for the MCP transport and remote-client identity boundary

## Decision

AGym Phase B provides a hosted, stateless Streamable HTTP MCP endpoint at the AGym public origin. Compatible remote MCP clients use **Supabase's native OAuth 2.1 server** to authenticate as an existing AGym user, then call the endpoint with the resulting Supabase-issued access token.

```text
compatible remote MCP client
  → Supabase OAuth 2.1 authorization-code + PKCE S256 + DCR
  → AGym explicit OAuth consent page
  → Supabase user JWT (verified issuer, JWKS, aud=authenticated, sub, role, client_id)
  → AGym remote MCP endpoint
  → Supabase RLS + AGym per-action authorization
  → bounded context / proposed plan
```

The existing local stdio MCP server remains supported for local clients and is not exposed over HTTP.

## Hard security boundary

1. The endpoint derives the AGym account only from a cryptographically verified Supabase OAuth token subject. It never accepts a user ID from MCP arguments, query parameters, headers, or environment configuration.
2. The remote endpoint verifies Supabase issuer, JWKS signature, expiry, `aud: authenticated`, UUID-shaped `sub`, and `role: authenticated`. It requires the Supabase-issued `client_id` claim for traceability, but maps every approved dynamic client to the fixed product identity `remote-mcp`; it does not trust a client-supplied label.
3. A Supabase OAuth bearer carries a non-empty `client_id`. Restrictive client-ID-aware RLS denies that bearer direct PostgREST access to AGym tables; the remote endpoint uses it only to call narrowly scoped, grant-checking remote RPCs. It does not use a Supabase service-role key, Keycloak credential, token bridge, refresh-token vault, or static user ID.
4. `agent_authorizations` remains the immediate, independently revocable product-permission layer. OAuth authentication and consent do not grant AGym read or write permission by themselves.
5. Dynamic client registration is open to compatible MCP clients as supported by Supabase OAuth Server. Every OAuth request must display AGym's explicit consent page with the registered client name, callback URI, and requested scopes. This deliberately replaces the prior infeasible exact-Claude-callback-only DCR contract.
6. The only remote tool surface is `get_context`, `list_plans`, and `create_proposed_plan`. Plan creation remains atomic, `agent_written_plan`, and `proposed`; no remote tool can confirm an outcome or activate a plan.
7. The endpoint is stateless request/response Streamable HTTP. Phase B does not add SSE, resumable sessions, sampling, tasks, or arbitrary agent identifiers.
8. No production rollout occurs before native OAuth discovery/DCR, real-client authorization-code + PKCE, two-account RLS isolation, separate AGym grants, immediate revocation, and audit proof pass.

## Why

Supabase OAuth Server issues genuine project user JWTs with the established owner UUID and `authenticated` database role. This preserves the existing RLS boundary without issuing a secondary identity, trusting a foreign JWT issuer, exposing a Supabase token to an OAuth client beyond its normal OAuth relationship, or operating a server-side broker bridge.

Supabase documents MCP-compatible dynamic registration, but does not offer an exact-callback-only DCR allowlist. The selected control set is explicit user OAuth consent, trusted display of registered client/callback data, current Supabase OAuth security controls, owner-scoped RLS, and AGym's separate action grants/revocation. The user selected this deliberate product/security trade-off on 2026-07-20.

## Consequences

- AGym can serve compatible MCP clients through an official Supabase path, including Claude when its actual connector completes the documented DCR flow.
- "All LLMs" means compatible MCP client products, not every chat UI or every model. Each client is verified through the staging acceptance proof.
- Users must manage two distinct authorization layers: OAuth consent/refresh-token lifecycle in Supabase and immediate AGym action grants in Plans.
- Keycloak staging infrastructure is not in the request path and must not be treated as an alternate token issuer or production dependency.
- The web app remains Vercel-hosted. The remote MCP handler is a Vercel server function in the same project/domain; it is not Vite browser code.
