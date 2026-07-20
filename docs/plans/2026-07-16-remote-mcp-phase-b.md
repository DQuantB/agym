# Phase B — Remote MCP implementation plan

> **For Hermes:** Use the subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Deliver a secure remote, OAuth-protected MCP vertical slice that lets a compatible client access only the signed-in user's AGym context and create review-required plans.

**Architecture:** A stateless Vercel Web-API endpoint serves Streamable HTTP at `/api/mcp`. It verifies a Supabase OAuth access token, derives the user from `sub`, maps a validated allowlisted OAuth `client_id` to a fixed AGym agent identity, and uses an authenticated Supabase client under existing RLS. A new self-scoped RPC writes a proposed plan plus audit row atomically. The local service-role stdio MCP path stays unchanged.

**Tech stack:** Vercel Node.js Web-API function, MCP TypeScript SDK 1.29, Supabase OAuth 2.1/JWKS, Supabase RLS/Postgres, Zod, Vitest.

**Non-goals:** Dynamic client registration, arbitrary client labels, SSE/resumable sessions, LLM parsing, backend coaching, outcome confirmation, service-role browser/remote use, deployment before a real OAuth client proof.

---

## Delivery gates

### Pre-flight gate — configuration
- Supabase OAuth 2.1 Server is enabled in a staging project first.
- One compatible OAuth client is pre-registered, its redirect URI is exact, and its verified OAuth `client_id` is placed only in the server runtime environment as an allowlist mapping.
- Supabase asymmetric signing/JWKS is enabled, and the remote endpoint validates issuer, expiry, resource audience, `sub`, role, and client ID.

### Revision gate — local implementation
- Typecheck, lint, build, unit tests, local migration reset, and existing MCP/RLS tests pass.
- HTTP tests prove missing/invalid identity is rejected before a tool handler, client/user spoofing cannot cross tenants, and grant revocation takes effect on the next call.

### Escalation gate — external client integration
- A real OAuth authorization-code + PKCE exchange and one deployed compatible client must be exercised before claiming client compatibility.
- If Supabase OAuth cannot issue resource-bound tokens for the endpoint, stop production deployment and use a dedicated authorization-server design rather than weakening audience checks.

### Abort gate — privacy/security failure
- Stop and rotate/revoke before deployment if a service-role key enters a remote runtime, browser bundle, client configuration, logs, or Git.
- Do not expose the existing static-user stdio server through HTTP.

---

### Task 1: Make MCP server identity/client agnostic

**Files:**
- Modify: `mcp/agym-server.ts`
- Test: `mcp/remote-server.test.ts`

1. Split the configuration into an identity-only shape and local stdio configuration so a remote handler can provide `{userId, agentIdentifier}` without a service-role key.
2. Keep local `loadConfiguration()` and stdio bootstrap behavior unchanged.
3. Make read/write handler behavior accept an authenticated user Supabase client and identity closure.
4. Test that remote code cannot introduce or override user/client identity through tool inputs.

### Task 2: Add a remote-safe plan RPC and security coverage

**Files:**
- Create: `supabase/migrations/20260716T000000_remote_mcp_plan_rpc.sql`
- Modify: `supabase/tests/rls-isolation.sql`

1. Create `create_remote_mcp_proposed_plan` that derives `user_id` from `auth.uid()` and rejects unauthenticated calls.
2. Verify the authorization row belongs to `auth.uid()`, matches the server-supplied mapped agent identity and `write_proposed_plan`, and is active.
3. Atomically insert only an `agent_written_plan` with `proposed` status plus append-only audit entry.
4. Grant only `authenticated`; retain existing service-role RPC for local stdio compatibility.
5. Test two identities, cross-user authorization/plan attempts, revoked authorization, and proposal provenance/status.

### Task 3: Add verified remote OAuth identity and stateless transport

**Files:**
- Create: `mcp/remote-auth.ts`
- Create: `api/mcp.ts`
- Create: `api/.well-known/oauth-protected-resource/[...path].ts` or equivalent route supported by Vercel
- Create: `mcp/remote-http.test.ts`
- Modify: `package.json`, lockfile, `vercel.json`

1. Add server-only environment validation for public Supabase URL/key, OAuth issuer, canonical MCP resource URL, expected resource audience, and JSON client-ID-to-agent mapping.
2. Strictly parse bearer tokens and validate against Supabase JWKS with `jose`; require valid issuer, expiry, audience/resource, UUID subject, `authenticated` role, and an allowlisted client ID.
3. Serve OAuth protected-resource metadata and return `401` with the correct `WWW-Authenticate` resource metadata hint for authentication failures.
4. Enforce explicit host/origin policy, no-store responses, request-size bounds, and JSON-only stateless Streamable HTTP.
5. Instantiate a request-scoped MCP server and Supabase client with the verified user token. No `AGYM_USER_ID` or service-role key may exist in this route.
6. Return 405 for unsupported GET/DELETE MCP transport methods in this stateless initial release.

### Task 4: Add a legible remote-client grant surface and operational docs

**Files:**
- Modify: `src/components/PlansView.tsx`
- Modify: `src/components/PlansView.test.tsx`
- Modify: `mcp/README.md`
- Modify: `docs/deploy/going-live.md`
- Create: `docs/deploy/remote-mcp-phase-b.md`

1. Add the initial fixed remote agent label that matches the server mapping; explain that its OAuth identity is verified and that each permission remains separate/revocable.
2. Preserve local Hermes, Claude Code, and Codex controls; no free-form client field.
3. Document the exact server-only environment variables by name, Supabase OAuth enablement/client registration steps, Vercel route behavior, first-client staging proof, grant/revocation verification, and rollback/revocation procedure.
4. Explicitly state that a discovered tool alone is not an authorized AGym data call.

### Task 5: Verify, review, deploy, and prove

1. Run `npm run typecheck`, `npm run lint`, `npm run test:run`, `npm run build`, `npm run mcp:smoke`, `npm run mcp:e2e`, and local SQL test suites.
2. Review secret exposure and browser build output.
3. Apply the reviewed migration to staging, configure the server-only deployment environment, and test a valid OAuth client through the deployed endpoint.
4. Apply to production and deploy only when staging proves authorization-code + PKCE, strict identity validation, bounded context, proposal creation, audit growth, and immediate revocation.
5. Create a focused PR with evidence, risks, external-client status, and any user-operated dashboard steps.
