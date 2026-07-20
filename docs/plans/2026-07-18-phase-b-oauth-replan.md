# Phase B OAuth replan — prove the identity boundary before building the remote connector

> **For Hermes:** Use the `subagent-driven-development` skill only after the pre-flight gates below pass. Do not deploy a remote MCP endpoint, enable open DCR, or alter production identity data during this plan.

**Goal:** Choose and prove a secure OAuth architecture that lets Claude connect to AGym remotely without weakening Supabase RLS or exposing a Supabase credential to Claude.

**Architecture:** Keep Supabase as AGym's database and owner-enforcement layer. Use an authorization server only if it can support Claude's OAuth Dynamic Client Registration (DCR), authorization-code flow, PKCE S256, and the exact callback URI while preserving a verified mapping to the correct AGym user. The current staging candidate remains Keycloak 26.5.0. Auth0 was evaluated as a managed alternative but is not approved for this phase.

**Tech stack:** Keycloak 26.5.0 on Hetzner; Supabase Auth/Data API/RLS; Vercel server functions; TypeScript; `jose`; MCP Streamable HTTP.

---

## 1. Evidence and decisions as of 2026-07-18

### Confirmed environment facts

- Keycloak staging host: `auth-mcp-test.a-gym.app`; observed container image: `quay.io/keycloak/keycloak:26.5.0`.
- The Keycloak realm discovery document is live and advertises authorization-code flow, PKCE support, and a DCR `registration_endpoint`.
- Claude's documented remote-connector callback URI is `https://claude.ai/api/mcp/auth_callback`.
- The AGym Supabase project exposes **Third-Party Auth**, but its current provider menu lists named integrations (Firebase, Clerk, WorkOS, Auth0, Amazon Cognito) rather than generic OIDC/Keycloak.
- **Gate A result (2026-07-18):** Keycloak's advertised public DCR endpoint rejected both an attacker callback and Claude's exact callback with HTTP 403. No client policies/profiles were configured. See `docs/evidence/2026-07-18-keycloak-dcr-policy.md`. This is a safe failure, but it means direct DCR is not ready for Claude.

### Managed-provider spike: Auth0

Auth0 is officially supported by Supabase Third-Party Auth, but do **not** adopt it for Phase B merely because it appears in that menu.

Official evidence:

- [Supabase Auth0 guide](https://supabase.com/docs/guides/auth/third-party/auth0) requires an Auth0 `role: "authenticated"` claim and shows Supabase consuming an Auth0 token.
- [Auth0 DCR guide](https://auth0.com/docs/get-started/applications/dynamic-client-registration) states that DCR is disabled by default and, when enabled, is **Open Dynamic Registration**: anyone can create applications without a registration token at `POST /oidc/register`.
- The same guide says all DCR clients receive PKCE and can receive default API permissions for third-party applications.

This fails AGym's requirement to admit only Claude's exact callback URI. While every individual Auth0 client has callback URIs, enabling Auth0's public DCR endpoint would allow arbitrary parties to register their own callback URIs. It would also introduce a new external identity system and require a deliberate migration/mapping for existing Supabase UUID-owned data. Therefore:

```text
Decision: do not create an Auth0 tenant or change AGym login during this Phase B plan.
```

A managed provider may be reconsidered later only after a separate provider-selection decision confirms: (1) non-open DCR with exact redirect-URI enforcement, (2) an officially supported Supabase integration, (3) identity migration, pricing, and data-processing approval.

### Security invariants — never relax these

1. The remote endpoint derives the AGym account only from a cryptographically verified token subject or an equivalently reviewed, server-side mapping. It never accepts a user ID from MCP arguments, headers, or a client label.
2. The remote runtime never holds or uses the Supabase service-role key.
3. Claude never receives a Supabase access token, a Keycloak admin credential, a management API token, or a confidential-client secret.
4. A successful OAuth login does not grant AGym data access by itself. `agent_authorizations` remains the immediate read/write/revocation layer.
5. DCR must reject every redirect URI except the exact Claude callback URI above, require a public authorization-code client and PKCE S256, and be rate limited.
6. No production deployment or real-user rollout occurs before two-account isolation, grant, revocation, and audit proofs pass.

## 2. Pre-flight gate A — exact Keycloak DCR policy

**Objective:** Prove that the public registration path cannot create a client using an attacker-controlled callback URI.

**Infrastructure scope:** staging realm `agym-mcp-test` only. Do not test against `master` or production.

### Task A1: Capture non-secret Keycloak DCR policy state

**Files:**
- Create: `docs/evidence/2026-07-18-keycloak-dcr-policy.md`

Record only non-secret information:

- Keycloak version (`26.5.0` already observed);
- realm name and discovery URL;
- configured client-registration/client-policy executors relevant to redirect URI validation, client type, grant type, and PKCE;
- whether public DCR can be disabled or restricted independently of authenticated admin registration.

Do not copy Docker environment variables, admin credentials, client secrets, bearer tokens, exported realms, or private keys into the repository.

### Task A2: Run a disposable DCR negative test

**Objective:** Register a harmless public test client with a deliberately wrong HTTPS callback URI in the staging realm.

Expected result: the registration is rejected before a client is created.

If registration succeeds, immediately delete the disposable client and mark gate A as failed. Do not enable remote MCP deployment. The failure proves that Keycloak's direct DCR endpoint is too broad for Claude and needs a separately designed authorization-server/DCR solution.

### Task A3: Run the exact Claude DCR positive test

**Objective:** Repeat the same minimal public authorization-code registration using only:

```json
{
  "redirect_uris": ["https://claude.ai/api/mcp/auth_callback"],
  "token_endpoint_auth_method": "none",
  "grant_types": ["authorization_code"],
  "response_types": ["code"]
}
```

Expected result: registration succeeds and the resulting client enforces PKCE `S256` (not `plain`). Record only the returned client ID prefix/shape and policy result; do not commit client IDs if they are not needed for reproducibility.

**Gate A pass condition:** wrong callback rejected; exact Claude callback accepted; public authorization-code + PKCE S256 enforced.

### Gate A result — 2026-07-20

The current staging realm remains safely closed: it rejected both the attacker and Claude callbacks (HTTP 403). Research against Keycloak 26.5.0 confirmed that stock client-registration policies/client policies can harden public authorization-code registration and require PKCE S256, but cannot express the required exact literal redirect-URI allowlist. In particular, host-oriented trusted-host checks would still admit other `https://claude.ai/...` paths.

Do **not** enable anonymous DCR using only stock Keycloak policies. The only viable next DCR options are a reviewed custom Keycloak `ClientRegistrationPolicy` implementation plus its `ClientRegistrationPolicyFactory` that rejects every registration except the exact callback, or a separate supported authorization-server architecture. A metadata proxy is not sufficient.

## 3. Pre-flight gate B — preserve Supabase RLS with a real AGym identity

**Objective:** Prove a remote OAuth result can reach Supabase as the correct existing AGym/Supabase user without exposing a Supabase token to Claude.

The direct Keycloak-token approach is currently blocked: the Supabase Third-Party Auth UI has no supported generic Keycloak/OIDC integration. Do not attempt to impersonate Auth0 or modify RLS to trust an unverified external subject.

### Task B1: Document candidate server-side bridge mechanisms

**Files:**
- Created: `docs/spikes/2026-07-20-keycloak-supabase-identity-bridge.md`
- Modify: `docs/adr/0003-remote-mcp-phase-b.md` only after a gate passes

Investigate, against Keycloak 26.5.0 and Supabase's current OAuth behavior:

1. Keycloak brokering Supabase as an upstream OIDC provider plus **server-side retrieval of an upstream Supabase-issued access token from Keycloak broker storage** (not RFC 8693 token exchange); and
2. any reviewed Supabase-supported mechanism that returns a user-scoped Supabase token to AGym's server but never to the public DCR client.

For each mechanism, explicitly answer:

- What trusted server component receives the upstream token?
- What credential authorizes the exchange, where is it stored, and can a public client obtain it?
- How does the bridge bind the token to the already verified Keycloak user?
- What stops user A from requesting user B's token?
- How are expiry, refresh, logout, and revocation handled?
- Can the resulting Supabase token execute the existing RLS policies for the existing UUID-owned AGym rows?

### Gate B result — 2026-07-20

The bridge spike is recorded in `docs/spikes/2026-07-20-keycloak-supabase-identity-bridge.md`. It rejects Keycloak-token forwarding, RFC 8693 token exchange, and Keycloak's stock broker-token endpoint as ways to supply a safe Supabase user token. The stock endpoint is subject-bound but returns brokered stored token material and Keycloak's OIDC broker flow can retain refresh tokens; it cannot be granted to Claude or called from Vercel under AGym's no-refresh-token invariant.

Do not add a Vercel refresh-token vault or a service-role fallback. The only remaining Keycloak direction would be a new, separately reviewed server-only access-token-only bridge component plus a disposable Supabase-upstream proof that validates the actual project access token against two-user RLS, proves the backend never receives a refresh token, and proves AGym action authorization is checked server-side on every tool call. That infrastructure is not approved by this plan.

**Abort condition:** If no server-side-only bridge preserves RLS, do not substitute a service-role key. Mark remote Claude MCP blocked and retain the local stdio MCP integration.

### Task B2: Build a disposable two-user RLS proof only after a mechanism is selected

**Files:**
- Create: `mcp/e2e-remote-identity-bridge.mts`
- Create or modify: focused test fixtures under `mcp/`

Use two dedicated staging AGym accounts with disjoint fixture data. The proof must demonstrate:

1. bridge result for user A reads only user A's bounded context;
2. bridge result for user B reads only user B's bounded context;
3. cross-user reads/writes are denied by Supabase RLS;
4. neither the client nor logs receive a Supabase bearer token;
5. missing/revoked AGym authorization denies the next call.

**Gate B pass condition:** all five assertions pass through the real Supabase staging project.

## 4. Implementation — only after gates A and B pass

### Task C1: Record the architecture decision

**Files:**
- Modify: `docs/adr/0003-remote-mcp-phase-b.md`
- Modify: `docs/deploy/remote-mcp-phase-b.md`
- Modify: `mcp/README.md`

Document the selected authorization-server topology, server-only secrets, exact redirect policy, token audience/claims, operational owner, rollback, and evidence links. Remove the old static `AGYM_REMOTE_CLIENTS_JSON` deployment direction for the Claude route.

### Task C2: Update remote authentication with tests first

**Files:**
- Modify: `mcp/remote-auth.ts`
- Modify: `mcp/remote-auth.test.ts`
- Modify: `api/mcp.ts`
- Modify: `api/mcp.test.ts`

Write failing tests for invalid issuer, expired token, wrong audience, invalid/mismatched subject, missing `role`, unapproved DCR client, origin rejection, canonical resource metadata, and JSON-only requests.

Then implement the smallest token-validation and server-side bridge code satisfying the selected ADR. Preserve the existing user-token Supabase client; do not add a service-role client.

### Task C3: Implement only a separately proven DCR policy

Research record: `docs/spikes/2026-07-20-keycloak-custom-dcr-policy.md`

**Files:** exact paths depend on a future ADR/options spike.

- Stock Keycloak native policy is ruled out for this exact-callback requirement; do not enable anonymous DCR with its host/safety controls.
- A custom Keycloak `ClientRegistrationPolicy` implementation plus `ClientRegistrationPolicyFactory` is an option only after a dedicated ADR/spike defines its exact registration contract, upgrade/operational ownership, rate limiting, and hostile registration tests.
- A different authorization-server design is an option only after the same DCR and identity/RLS gates pass.
- Do not place a misleading metadata proxy in front of Keycloak.

### Task C4: Run protocol and product proof

Use Claude's actual custom remote-connector UI—not only curl/Postman—to prove:

1. automatic DCR with the exact callback;
2. authorization-code + PKCE S256;
3. authenticated MCP tool discovery;
4. user A/user B RLS isolation;
5. separate AGym read and write grants;
6. immediate denial after revocation;
7. audit records for successful and denied calls, according to the established audit convention.

## 5. Deployment and rollback gates

Deploy only to staging first. Required Vercel environment values must be server-only and never use a `VITE_` prefix. Verify publicly:

```text
GET  /.well-known/oauth-protected-resource/api/mcp → JSON protected-resource metadata
POST /api/mcp without a bearer token             → 401 with canonical resource_metadata
```

Rollback order:

1. revoke the user's AGym action grant (stops the next tool call);
2. disable the DCR policy/client path (stops new authorization);
3. remove the bridge's server-only configuration and redeploy;
4. retain audit evidence; do not delete user data as a rollback action.

## 6. Definition of done

Phase B is complete only when every gate above passes with recorded evidence, all focused and full checks pass, and the real Claude connector proves two-account isolation plus grant/revocation behavior. A deployed endpoint without those proofs is not Phase B complete.
