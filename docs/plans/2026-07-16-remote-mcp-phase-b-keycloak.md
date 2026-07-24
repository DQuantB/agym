# Phase B continuation — Keycloak as the DCR-capable OAuth front door

> **Historical / do not execute (superseded 2026-07-24):** Keycloak on Hetzner is not part of AGym's selected direct remote-MCP path and must not be repurposed as a user-token broker. The selected product route is Supabase OAuth → Vercel remote MCP → grant/RLS RPCs. Hetzner is planned separately as an internal intelligence plane; see `docs/adr/0004-direct-mcp-and-hetzner-intelligence-plane.md` and `docs/plans/2026-07-24-hetzner-intelligence-plane.md`. This document remains research evidence only.

Status: **planned, not started.** No implementation in this doc has been written yet.
Date: 2026-07-16
Builds on: `docs/adr/0003-remote-mcp-phase-b.md`, `docs/plans/2026-07-16-remote-mcp-phase-b.md`,
`docs/deploy/remote-mcp-phase-b.md`.

---

## 1. Why this doc exists

The Phase B foundation verifies a **Supabase-issued** OAuth access token directly: `mcp/remote-auth.ts` requires `payload.sub` to be the Supabase auth user UUID and `payload.role === 'authenticated'`, then hands that same token to a Supabase client so Postgres RLS enforces the owner boundary via `auth.uid()`.

That foundation is blocked for Claude Desktop specifically because Supabase's own OAuth authorization-server metadata has no `registration_endpoint` — Claude's custom remote-connector flow requires **OAuth Dynamic Client Registration (DCR)**. This is recorded as the "OAuth compatibility gate" in `docs/deploy/remote-mcp-phase-b.md`.

Keycloak was stood up on the Hetzner box at `auth-mcp-test.a-gym.app` to close that gap. Verified directly against its live discovery document (`https://auth-mcp-test.a-gym.app/realms/agym-mcp-test/.well-known/openid-configuration`):

- `registration_endpoint` is present → DCR is supported.
- `authorization_code` grant is supported.
- `code_challenge_methods_supported` includes `S256` → PKCE is supported.

The dedicated `agym-mcp-test` realm now exists. This document does not treat its current client policy, claim mappings, or broker configuration as production-ready; each must be explicitly verified before external-client enablement.

**The problem this plan solves:** Keycloak can satisfy Claude's DCR/PKCE requirement, but a Keycloak-issued access token's `sub` is a Keycloak-internal user ID, not automatically the AGym/Supabase auth user UUID, and it won't carry `role: authenticated` unless configured. The existing `remote-auth.ts` code — and the "never accept identity from anywhere but a validated token subject" security boundary in ADR 0003 — depends on that claim shape being trustworthy and correct. Swapping the issuer env var alone does not work; the identity bridge between "the OAuth client just authorized" and "the AGym user whose data this is" has to be designed deliberately.

---

## 2. Task 0 — Resolve the identity-bridging design (spike, before any other task)

This is a security-load-bearing decision. Do not start Task 1+ until one option is chosen and its open unknowns are confirmed against current Keycloak/Supabase docs — some details below may have shifted since this plan was written and must be re-verified, not assumed.

### Option A — Keycloak brokers to Supabase as upstream IdP; recover the real Supabase token

- Configure Keycloak's dedicated realm with a generic OpenID Connect Identity Provider pointing at Supabase Auth. A user signing in through Keycloak is redirected to Supabase to actually authenticate; Keycloak brokers the identity and stores the upstream token.
- Keycloak Token Exchange and broker-token retrieval must be verified against the deployed version and threat model. Do **not** expose a stored upstream Supabase bearer token to a public DCR client; a public client cannot keep it confidential.
- The remote MCP endpoint would need a narrowly reviewed server-side exchange/glue path before calling Supabase. It must keep the genuine Supabase token out of browser/Claude-visible state and preserve the existing `sub`/`role` checks.
- **Pros:** preserves Supabase as the sole resource-token issuer and changes less reviewed code.
- **Blocking risks to prove:** whether a server-side-only design is possible without giving a public DCR client bearer access to a brokered upstream token; token refresh/expiry; whether Claude's connector accepts the extra upstream-IdP login redirect.

### Option B — Register Keycloak as a trusted third-party JWT issuer directly in Supabase Auth

- Supabase supports registering a supported external OIDC issuer ("Third-party Auth") so PostgREST/RLS can validate that issuer's JWTs directly.
- Configure Keycloak with protocol mappers to issue `role: authenticated`, an exact AGym MCP resource audience, and a stable UUID `sub` equal to the corresponding Supabase/AGym user ID.
- `remote-auth.ts` changes: issuer/JWKS point at Keycloak; validation keeps the UUID `sub`, authenticated-role, audience, and reviewed client-policy checks. Supabase must be configured to accept the same issuer/JWKS token so `auth.uid()` resolves to the AGym UUID.
- **Pros:** Claude receives only a least-privilege Keycloak resource token; no upstream Supabase bearer token is exposed to a public DCR client. It avoids a broker-token-exchange dependency.
- **Unknowns to prove:** exact current Supabase third-party-auth configuration and support for Keycloak; RLS behavior for the configured claims; an automated provisioning/mapping mechanism that guarantees `sub` equals the AGym UUID for every user.

### How to decide

Spend a short timeboxed spike (half a day, not longer) proving the riskiest unknowns against the deployed Keycloak version and the actual Supabase project before picking:

1. Retrieve the deployed Keycloak version from the host and verify whether the tempting broker-token route would expose upstream bearer credentials to the public DCR client. If it would, reject Option A for the Claude flow.
2. Check the current Supabase project/dashboard and current official documentation for supported third-party Keycloak/OIDC issuer configuration, required claims, and RLS behavior.
3. Verify Claude's current documented callback URI and use that exact URI in a DCR policy. Do not infer it from a hostname-only restriction.
4. Prefer **Option B** if it provides a tested Keycloak → Supabase RLS claim path. Option A is acceptable only if the brokered upstream token never reaches the public client and the server-side exchange is independently threat-reviewed.
5. Record the decision and concrete evidence (version/configuration/screenshots, not assumptions) as an addendum to `docs/adr/0003-remote-mcp-phase-b.md` before starting Task 1.

---

## 3. Target architecture (once Task 0 picks a path)

Common to both options:

```text
Claude Desktop custom connector
  → OAuth 2.1 authorization-code + PKCE + DCR against Keycloak (auth-mcp-test.a-gym.app)
  → Keycloak issues/brokers a token
  → AGym remote MCP endpoint (api/mcp.ts) verifies a token whose subject is
    provably the AGym/Supabase user
  → Supabase RLS + AGym per-action `agent_authorizations` (unchanged)
  → bounded context / proposed plan (unchanged)
```

What does **not** change regardless of option:
- The local stdio MCP server and its service-role credential (untouched, local-only).
- `agent_authorizations` remains the independently revocable product-permission layer — a valid OAuth/DCR identity still must not imply AGym read/write permission on its own.
- Tool surface stays `get_context`, `list_plans`, `create_remote_mcp_proposed_plan` only; no outcome confirmation, no SSE/resumable sessions.
- No service-role key enters the remote runtime under either option.

---

## 4. Tasks (after Task 0 is resolved)

### Task 1: Stand up and harden the dedicated Keycloak realm/client policy (infra, not app code)

- Keep `agym-mcp-test` isolated from Keycloak `master` for test integration; use a dedicated non-test realm for production.
- Register the OAuth client policy needed for Claude's custom connector:
  - Confirm Claude's currently documented custom-connector redirect/callback URI against Anthropic's live docs at implementation time.
  - Reject arbitrary redirect URIs and web origins. The built-in anonymous-registration restriction must be audited to confirm it can restrict the exact callback path; if it only matches the host, deploy a narrow DCR registration gateway that enforces the exact URI, public authorization-code client, PKCE S256, and rate limiting before forwarding an approved registration to Keycloak.
  - Enable PKCE `S256` as required for public clients; do not accept `plain` merely because Keycloak's discovery advertises it globally.
- If Option A: configure the Supabase generic-OIDC identity provider and prove the server-side-only exchange model.
- If Option B: configure protocol mappers and an automated provisioning/mapping mechanism that guarantees the external JWT `sub` equals the intended Supabase UUID.

### Task 2: Update `mcp/remote-auth.ts` for the chosen identity path

- Option A: retain Supabase issuer/JWKS validation, adding only reviewed server-side glue that never releases upstream bearer credentials to the public DCR client.
- Option B: point issuer/JWKS at the Keycloak realm and validate the precise claim shape Supabase accepts.
- Either way: preserve hard-boundary checks — UUID-shaped `sub`, explicit authenticated-role check, exact resource audience, and a server-side DCR-aware client-policy mapping. Replace the static `AGYM_REMOTE_CLIENTS_JSON` model before a Claude deployment; do not trust an unreviewed client-provided label.
- Add/extend tests for wrong issuer, expired token, missing role, mismatched audience, invalid subject, unapproved client, canonical protected-resource metadata, request-origin rejection, and JSON-only transport.

### Task 3: Environment and deployment configuration

- Update `docs/deploy/remote-mcp-phase-b.md` with the final environment variable set.
- Confirm no Keycloak confidential-client secret, if one is introduced by a reviewed server-only flow, ends up in `VITE_*`, browser code, or Git.
- Promote from `auth-mcp-test` to a production hostname only after staging proof; use separate realms and DCR policy state.

### Task 4: Staging proof (must pass before any production deploy)

1. Claude Desktop performs DCR against the Keycloak realm/gateway and registers a client automatically (no manual pre-registration).
2. Complete authorization-code + PKCE end to end from Claude Desktop's actual custom-connector UI, not a curl/Postman simulation.
3. Confirm the resulting request to `/api/mcp` resolves to the correct AGym user — test with two distinct real accounts and confirm neither can see the other's data.
4. Grant `Remote MCP client` read/write permission in the AGym web app (Plans & agent access) and confirm `get_context` / `create_proposed_plan` work only after the grant exists.
5. Revoke one of the two permissions and confirm the very next call is denied — no caching of a stale positive authorization.
6. Confirm `agent_audit_log` records every call, including denied attempts if that is the established audit convention.

### Task 5: Documentation and rollback

- Update ADR 0003 with the final chosen architecture and the Task 0 evidence.
- Update `mcp/README.md` and `docs/deploy/remote-mcp-phase-b.md` so the final Keycloak realm/client configuration is reproducible from docs alone, not tribal knowledge.
- Rollback plan:
  - Disable the DCR policy/gateway or Keycloak client to block new authorizations.
  - Revoke the user's `agent_authorizations` row to stop data access immediately regardless of OAuth state.
  - If Option A: disable the Supabase IdP link in Keycloak.
  - If Option B: remove Keycloak issuer trust in Supabase.

---

## 5. Explicit open questions to close before coding starts

- [ ] Is SSH access to the Keycloak VPS restored, and what Keycloak version is deployed?
- [ ] Does the current Supabase project expose/configure Keycloak third-party auth today, and what exact claim shape does it require?
- [ ] What exact callback URI do Anthropic's current connector docs require, verified live at implementation time?
- [ ] Can Keycloak's DCR policy restrict the exact callback path, or is the minimal DCR gateway necessary?
- [ ] How will the Keycloak user subject be provisioned/mapped immutably to an AGym/Supabase UUID?
- [ ] Is `auth-mcp-test.a-gym.app` staging-only, as this plan assumes, and what will the production hostname be?
