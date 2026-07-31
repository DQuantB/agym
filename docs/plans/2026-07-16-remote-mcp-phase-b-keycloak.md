# Phase B continuation — Keycloak as the DCR-capable OAuth front door

Status: **planned, not started.** No implementation in this doc has been written yet.
Date: 2026-07-16
Builds on: `docs/adr/0003-remote-mcp-phase-b.md`, `docs/plans/2026-07-16-remote-mcp-phase-b.md`,
`docs/deploy/remote-mcp-phase-b.md` (all on branch `feat/remote-mcp-phase-b`, not this branch —
move or cherry-pick this file onto that branch before resuming work there).

---

## 1. Why this doc exists

The Phase B foundation (already implemented on `feat/remote-mcp-phase-b`) verifies a
**Supabase-issued** OAuth access token directly: `mcp/remote-auth.ts` requires `payload.sub` to be
the Supabase auth user UUID and `payload.role === 'authenticated'`, then hands that same token to a
Supabase client so Postgres RLS enforces the owner boundary via `auth.uid()`.

That foundation is blocked for Claude Desktop specifically because Supabase's own OAuth
authorization-server metadata has no `registration_endpoint` — Claude's custom remote-connector
flow requires **OAuth Dynamic Client Registration (DCR)**. This is recorded as the "OAuth
compatibility gate" in `docs/deploy/remote-mcp-phase-b.md`.

Keycloak was stood up on the Hetzner box at `auth-mcp-test.a-gym.app` to close that gap. Verified
directly against its live discovery document
(`https://auth-mcp-test.a-gym.app/realms/master/.well-known/openid-configuration`):

- `registration_endpoint` is present → DCR is supported.
- `authorization_code` grant is supported.
- `code_challenge_methods_supported` includes `S256` → PKCE is supported.

Only the default `master` realm exists right now. No AGym-specific realm, client, or claim mapping
has been created.

**The problem this plan solves:** Keycloak can satisfy Claude's DCR/PKCE requirement, but a
Keycloak-issued access token's `sub` is a Keycloak-internal user ID, not the AGym/Supabase auth
user UUID, and it won't carry `role: authenticated` unless something makes it. The existing
`remote-auth.ts` code — and the "never accept identity from anywhere but a validated token
subject" security boundary in ADR 0003 — depends on that claim shape being trustworthy and correct.
Swapping the issuer env var alone does not work; the identity bridge between "the OAuth client
Keycloak just authorized" and "the AGym user whose data this is" has to be designed deliberately.

---

## 2. Task 0 — Resolve the identity-bridging design (spike, before any other task)

This is a security-load-bearing decision. Do not start Task 1+ until one option is chosen and its
open unknowns are confirmed against current Keycloak/Supabase docs — some details below may have
shifted since this plan was written and must be re-verified, not assumed.

### Option A — Keycloak brokers to Supabase as upstream IdP; use Keycloak Token Exchange to recover the real Supabase token

- Configure Keycloak's `master` (or a new dedicated) realm with a **generic OpenID Connect Identity
  Provider** pointing at Supabase Auth. A user signing in through Keycloak is redirected to Supabase
  to actually authenticate; Keycloak brokers the identity and stores the upstream token.
- Enable Keycloak **Token Exchange** (standard token exchange; confirm current Keycloak version
  supports it without a preview feature flag) to retrieve the **stored upstream Supabase token**
  for the logged-in session, rather than trusting a locally re-signed Keycloak token for resource
  access.
- The remote MCP endpoint (`api/mcp.ts` / `remote-auth.ts`) stays almost unchanged: it still
  verifies a genuine Supabase-issued JWT against Supabase's JWKS, same `sub`/`role` checks as today.
  Keycloak's only job is being the DCR/PKCE front door Claude talks to; it never becomes a trusted
  token issuer for the resource server.
- **Pros:** minimal change to already-reviewed `remote-auth.ts` logic; Supabase remains the sole
  trusted token issuer for RLS, so the existing hard security boundary in ADR 0003 is preserved
  almost verbatim.
- **Unknowns to verify before committing:** exact Keycloak version/edition support for standard
  token exchange (this has moved between "preview" and "stable" across Keycloak releases — check
  the version actually deployed on the Hetzner box); whether the stored upstream token survives
  refresh/expiry correctly through the broker; whether Claude's connector flow is compatible with
  an additional upstream-IdP redirect hop during authorization (extra redirect during login).

### Option B — Register Keycloak as a trusted third-party JWT issuer directly in Supabase Auth

- Supabase supports registering an external OIDC issuer ("third-party auth") so PostgREST/RLS will
  accept and verify JWTs signed by that issuer directly, without Supabase itself having issued them.
- Configure Keycloak with a protocol mapper that hard-codes/forwards a `role: authenticated` claim,
  and provision Keycloak users so their `sub` equals the corresponding Supabase auth user UUID
  (this requires either identity federation with a fixed, synced ID, or just-in-time provisioning
  that writes the Supabase UUID as the Keycloak user ID at first login).
- `remote-auth.ts` changes: issuer/JWKS now point at Keycloak; validation still requires `sub`
  (must equal a real Supabase auth UUID) and whatever role/claim shape Supabase's third-party-auth
  feature expects (this differs from today's Supabase-native claim shape and must be confirmed
  against current Supabase docs, not assumed from this plan).
- **Pros:** no extra broker/exchange hop at request time; Keycloak is the single OAuth authority
  end to end.
- **Unknowns to verify before committing:** exact current Supabase third-party-auth configuration
  steps and supported providers list; how `auth.uid()` / RLS policies resolve identity for
  third-party-issued tokens (whether it requires a matching `auth.users` row or is fully claim-based);
  how to reliably guarantee the Keycloak `sub` equals the Supabase UUID for every user without a
  manual provisioning step per user.

### How to decide

Spend a short timeboxed spike (half a day, not longer) proving the riskiest unknown in each option
against the actual deployed Keycloak version and the actual Supabase project before picking:

1. Check the deployed Keycloak version (`auth-mcp-test.a-gym.app` admin console → footer/about) and
   confirm whether standard Token Exchange is enabled/available in that version. If yes and simple
   to enable → this favors Option A.
2. Check the current Supabase dashboard (Authentication → Sign In / Providers, or a dedicated
   "Third-party Auth" section if present in this Supabase project) for whether a generic/custom OIDC
   issuer can be registered today. If yes and straightforward → this favors Option B.
3. Prefer **Option A** if both are viable and roughly equal effort — it changes strictly less
   already-reviewed security-critical code (ADR 0003's Task 3 code stays intact) and keeps Supabase
   as the sole identity source of truth, which is the property the existing security review already
   signed off on.
4. Record the decision and the concrete evidence for it (screenshots/config, not assumptions) as a
   short addendum to `docs/adr/0003-remote-mcp-phase-b.md` before starting Task 1.

---

## 3. Target architecture (once Task 0 picks a path)

Common to both options:

```text
Claude Desktop custom connector
  → OAuth 2.1 authorization-code + PKCE + DCR against Keycloak (auth-mcp-test.a-gym.app)
  → Keycloak issues/brokers a token
  → AGym remote MCP endpoint (api/mcp.ts) verifies a token whose subject is
    provably the AGym/Supabase user (via Option A's recovered Supabase token, or
    Option B's third-party-trusted Keycloak token)
  → Supabase RLS + AGym per-action `agent_authorizations` (unchanged)
  → bounded context / proposed plan (unchanged)
```

What does **not** change regardless of option:
- The local stdio MCP server and its service-role credential (untouched, local-only).
- `agent_authorizations` remains the independently revocable product-permission layer — a valid
  OAuth/DCR identity still must not imply AGym read/write permission on its own.
- Tool surface stays `get_context`, `list_plans`, `create_remote_mcp_proposed_plan` only; no
  outcome confirmation, no SSE/resumable sessions.
- No service-role key enters the remote runtime under either option.

---

## 4. Tasks (after Task 0 is resolved)

### Task 1: Stand up a dedicated Keycloak realm and client (infra, not app code)

- Create a dedicated realm (e.g. `agym`) instead of using `master` for anything production-facing.
- Register the OAuth client policy needed for Claude's custom connector:
  - Confirm Claude's currently-documented custom-connector redirect/callback URI against
    Anthropic's live docs at implementation time (do not hardcode a guessed value into Keycloak
    config from memory).
  - Restrict DCR-created clients to that approved redirect URI pattern — ADR 0003 explicitly
    requires the DCR policy to reject arbitrary redirect URIs.
  - Enable PKCE `S256` as required for public clients.
- If Option A: configure the Supabase generic-OIDC identity provider inside this realm and enable/
  test token exchange.
- If Option B: configure the protocol mapper(s) needed to produce the exact claim shape Supabase's
  third-party auth expects, and the provisioning mechanism that guarantees `sub` equality with the
  Supabase user UUID.

### Task 2: Update `mcp/remote-auth.ts` for the chosen identity path

- Option A: little to no change — `AGYM_REMOTE_OAUTH_ISSUER` still points at Supabase; add whatever
  glue is needed to fetch the exchanged upstream token before calling `createRemoteMcpSupabaseClient`.
- Option B: `AGYM_REMOTE_OAUTH_ISSUER` now points at the Keycloak realm; update claim validation to
  match Keycloak's token shape; keep the same fail-closed behavior (`RemoteAuthenticationError` on
  any missing/invalid claim).
- Either way: preserve every existing hard-boundary check — UUID-shaped `sub`, an explicit
  authenticated-role check, and the allowlisted-client-to-agent-identifier mapping. Replace the
  static `AGYM_REMOTE_CLIENTS_JSON` allowlist model with a real DCR-aware client-policy check per
  ADR 0003 §5 ("must be replaced before a Claude deployment") — do not ship DCR support while still
  trusting an unreviewed client-provided label.
- Add/extend `mcp/remote-auth.test.ts` for the new claim/token shape, including negative tests:
  wrong issuer, expired token, missing role claim, mismatched audience, unapproved client.

### Task 3: Environment and deployment configuration

- Update `docs/deploy/remote-mcp-phase-b.md` with the final env var set (issuer URL changes if
  Option B; any new token-exchange-related config if Option A).
- Confirm no secret (Keycloak client secret, if any confidential client is used anywhere, though
  Claude's DCR client should be public+PKCE) ends up in `VITE_*`, browser code, or Git.
- Decide staging vs. production Keycloak realm strategy — likely promote from `auth-mcp-test` to a
  production hostname once proven, mirroring how Vercel has a staging/production split today.

### Task 4: Staging proof (must pass before any production deploy)

Mirrors the existing "User permission proof" in `docs/deploy/remote-mcp-phase-b.md`, extended for
Keycloak/DCR specifically:

1. Claude Desktop performs DCR against the `agym` Keycloak realm and registers a client
   automatically (no manual client pre-registration).
2. Complete authorization-code + PKCE end to end from Claude Desktop's actual custom-connector UI,
   not a manual curl/Postman simulation.
3. Confirm the resulting request to `/api/mcp` resolves to the correct AGym user — test with two
   distinct real accounts and confirm neither can see the other's data.
4. Grant `Remote MCP client` read/write permission in the AGym web app (Plans & agent access) and
   confirm `get_context` / `create_proposed_plan` work only after the grant exists.
5. Revoke one of the two permissions and confirm the very next call is denied — no caching of a
   stale positive authorization.
6. Confirm `agent_audit_log` records every call, including denied attempts if that's the existing
   audit convention.

### Task 5: Documentation and rollback

- Update ADR 0003 with the final chosen architecture (Option A or B) and why, referencing the Task
  0 spike evidence.
- Update `mcp/README.md` and `docs/deploy/remote-mcp-phase-b.md` so the Keycloak realm/client
  configuration is reproducible from docs alone, not tribal knowledge.
- Rollback plan (extends the existing one in `docs/deploy/remote-mcp-phase-b.md`):
  - Disabling/deleting the Keycloak client immediately blocks new authorizations for that client.
  - Revoking the user's `agent_authorizations` row still stops data access immediately regardless
    of OAuth/Keycloak state (this layer is unaffected by anything in this plan).
  - If Option A: disabling the Supabase IdP link in Keycloak stops new logins without touching the
    resource server.
  - If Option B: removing Keycloak as a trusted third-party issuer in Supabase immediately stops
    Keycloak-issued tokens from passing RLS, without needing a Keycloak-side change.

---

## 5. Explicit open questions to close before coding starts

- [ ] Which Keycloak version is actually deployed on the Hetzner box, and does it support standard
      Token Exchange without a preview flag? (Determines if Option A is realistic.)
- [ ] Does the current Supabase project expose third-party-auth / custom OIDC issuer registration
      today, and what exact claim shape does it require? (Determines if Option B is realistic.)
- [ ] What is Claude's currently-documented custom-connector OAuth redirect URI? (Needed for the
      Keycloak client's redirect allowlist — verify against live Anthropic docs, not this plan.)
- [ ] Should the Keycloak realm used for the real integration be `master` (rename/reuse) or a new
      dedicated realm — this plan assumes a new dedicated realm; confirm before Task 1.
- [ ] Confirm whether `auth-mcp-test.a-gym.app` is meant to become the permanent auth host or is a
      throwaway test name that should be replaced (e.g. `auth.a-gym.app`) before any production
      client is registered against it, since DCR client registrations and redirect URIs would need
      to move if the hostname changes later.
