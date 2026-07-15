# Multi-client MCP authorizations implementation plan

> **For Hermes:** Use the subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Let a signed-in AGym user explicitly and independently grant/revoke bounded context-read and proposed-plan-write permissions for Hermes, Claude Code, and Codex, enabling a real MCP compatibility test with more than one LLM client.

**Architecture:** Generalize the existing `PlansView` direct Supabase/RLS flow rather than introducing a privileged endpoint. The browser only exposes a fixed client catalogue, and the MCP process checks an exact, separate `{ user_id, agent_identifier, action }` authorization on every call. No LLM parser is added: external user-selected LLMs reason from raw/confirmed context and create proposals.

**Tech stack:** React/TypeScript, Supabase browser client + existing RLS, Vitest, official MCP TypeScript SDK, Claude Code CLI, Codex CLI.

**Non-goals:** No server-side LLM parsing; no free-form agent identifiers; no service-role key in browser code; no production deployment; no file-storage fallback path.

---

### Task 1: Generalize explicit browser authorization controls

**Objective:** Replace the Hermes-only permissions UI with an allowlisted local-client catalogue while preserving separate, revocable action scopes.

**Files:**
- Modify: `src/components/PlansView.tsx`
- Create: `src/components/PlansView.test.tsx`

**Steps:**
1. Add an `agentClients` fixed catalogue for `hermes`, `claude-code`, and `codex`, each with a user-facing label.
2. Change the authorization query to load the authenticated user's records without filtering to `hermes`.
3. Parameterize active lookup, grant, revoke, visible headings, descriptions, and success/error text by `agentIdentifier` / display label.
4. Explicitly state that context read can include bounded immutable raw self-reports plus confirmed outcomes; proposals cannot confirm outcomes.
5. Test the two independent permissions for Claude Code and Codex, unauthenticated refusal, exact insert payload, and exact revoke condition.
6. Run the focused test, then typecheck/lint.

### Task 2: Preserve named-client isolation in backend test coverage

**Objective:** Prove named local client grants remain independent and cannot be broadened by the MCP service role.

**Files:**
- Modify: `mcp/smoke.mts`
- Modify: `mcp/e2e.mts`
- Modify: `supabase/tests/rls-isolation.sql`

**Steps:**
1. Add a non-default `AGYM_AGENT_IDENTIFIER=claude-code` configuration assertion to the smoke test.
2. Add live E2E assertions that one named client is permitted only after its own read/write grants, and another is denied until separately granted; confirm one client’s revocation does not affect another.
3. Extend SQL lifecycle coverage for independently active `claude-code` / `codex` grants, immutable history, and regrant after revocation.
4. Run local Supabase reset + the isolation SQL test and MCP E2E; retain existing single-user/least-privilege guarantees.

### Task 3: Document safe configuration for Claude Code and Codex

**Objective:** Make the verified local MCP configuration repeatable without exposing the service-role key.

**Files:**
- Modify: `mcp/README.md`
- Modify: `docs/deploy/going-live.md`

**Steps:**
1. Replace Hermes-only wording with generic local MCP client guidance.
2. Document that every client process needs a distinct fixed `AGYM_AGENT_IDENTIFIER` matching a user-approved browser grant.
3. Use environment-variable references/private local configuration only; never show literal secrets.
4. Add exact non-secret CLI discovery/validation commands for Hermes, Claude Code, and Codex.
5. Document that a real client call remains blocked until the user explicitly grants each scope in the app.

### Task 4: Review and verify

**Objective:** Ensure the multi-client implementation is scoped, secure, and build-safe.

**Steps:**
1. Run `npm run typecheck`, `npm run lint`, `npm run test:run`, and `npm run build`.
2. Run local Supabase migration/reset and SQL/MCP E2E tests where the CLI/runtime is available.
3. Review the diff for secrets, client-side service-role exposure, scope-enforcement claims, and accidental handling of raw health data.
4. Commit the scoped implementation. Do not deploy it; production deployment and real hosted-account test are explicit follow-up gates.
