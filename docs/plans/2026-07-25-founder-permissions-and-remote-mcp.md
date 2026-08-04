# Founder permissions and remote MCP staging implementation plan

> **For Hermes:** Use subagent-driven-development skill for each isolated implementation task; do not combine the mobile permission UI and remote deployment changes in one branch.

**Goal:** Restore the owner-controlled permission path needed for the founder MCP proof, then complete a secure staging proof of the already-implemented Supabase-OAuth remote MCP foundation.

**Architecture:** The mobile app gets a small native Data-screen control for the fixed `hermes` identity and its two separate, revocable actions. The web app is redeployed from a verified revision that already contains the same web permission surface. Remote MCP remains on `agym-alpha`: verified Supabase OAuth/DCR user JWTs, client-ID-aware RLS confinement, and narrow remote RPCs. `mcp-test`/Keycloak is not in the user-data request path.

**Tech Stack:** Expo React Native, TypeScript, Supabase Auth/Postgres/RLS, Vite/Vercel server functions, MCP SDK, Supabase OAuth 2.1/DCR.

---

### Task 1: Add mobile Hermes permission controls

**Files:**
- Modify: `apps/mobile/src/features/data/dataApi.ts`
- Modify: `apps/mobile/src/app/(tabs)/data.tsx`
- Add/modify focused tests under `apps/mobile/src/features/data/`

**Acceptance:** A signed-in owner sees separate explicit permission controls for Hermes read context and proposed-plan write. Grant writes only its own `user_id`, fixed `agent_identifier: "hermes"`, one action, and `{ version: 1 }`; revoke remains one-way. The screen displays grant status and refreshes after a successful mutation.

**Verification:** mobile focused tests, `npm run typecheck`, `npm run lint`, and `npm test` from `apps/mobile`.

### Task 2: Ship the matching web permission surface

**Files:** no feature code expected; `src/components/PlansView.tsx` is already the implementation.

**Acceptance:** The exact intended Vercel project/domain serves a bundle containing `Plans & agent access` and the Hermes grant controls; `/plans` returns HTTP 200. Do not deploy an accidental new Vercel project or alias.

**Verification:** record target project/alias, cache-busted HTTP checks, bundle-string inspection, and a signed-in owner UI check.

### Task 3: Remote MCP staging preflight

**Files:** inspect existing `api/mcp.ts`, `api/.well-known/oauth-protected-resource/[...path].ts`, `mcp/remote-auth.ts`, `supabase/migrations/20260720160000_constrain_remote_oauth_mcp.sql`, and their tests.

**Acceptance:** Supabase OAuth metadata exposes authorization/token/registration endpoints and PKCE S256; deployed protected-resource metadata is JSON; anonymous POST gets canonical OAuth 401; GET is 405; remote runtime has no service-role/static-user identity; migration history is linked and matches before any remote data proof.

### Task 4: Remote MCP staging acceptance

**Precondition:** Task 2 offers an owner permission surface for the fixed `remote-mcp` product identity.

**Acceptance:** Actual compatible client DCR + OAuth authorization-code PKCE works against `agym-alpha`; two users cannot read each other; no-grant/revoked calls are denied and audited; granted context read and proposal write use only narrow remote RPCs and create `agent_written_plan`/`proposed` results. No access token or health data is copied to logs/docs.

**Stop condition:** Do not declare this complete based only on curl or unit tests. If the real client cannot finish DCR/PKCE, preserve the local MCP proof and report remote client compatibility as blocked.
