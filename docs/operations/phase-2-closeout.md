# Phase 2 — Invite-only Auth and Hosted Storage Close-out

Status: **implementation complete; production data-rights proof pending**

Date opened: 2026-07-15
Source of truth: `docs/plans/networked-agent-alpha-invite-only.md` §Phase 2, as governed by ADR 0002.

## Phase 2 boundary

Phase 2 replaces anonymous browser persistence with authenticated, per-user Supabase persistence for the private alpha. It is not the retired local JSON-file MCP proposal and does not include a hosted AGym parser.

Acceptance criterion from the accepted plan:

> An invited user signs in, logs out, returns, and sees only their own persisted records.

## Shipped implementation

| Capability | Implementation | Evidence |
|---|---|---|
| Typed public Supabase client | `src/lib/supabase.ts` | Unit/type checks and production app configuration |
| Invite/magic-link gate, identity display, sign-out | `src/auth/AuthGate.tsx` | Auth component tests; deployed app |
| User-scoped hosted persistence | `src/storage/supabaseStorageAdapter.ts` | Adapter tests; RLS isolation tests |
| Existing local-data safety | `src/components/DataPanel.tsx` | Local data is disclosed and exportable; never silently uploaded |
| Account-scoped export | `src/components/DataPanel.tsx` → `adapter.exportAll()` | `DataPanel.test.tsx` validates export schema |
| Deliberate full account deletion | `DataPanel.tsx` → hosted adapter delete path / account-deletion RPC | Confirmation phrase UI and `supabase/tests/account-deletion.sql` |

No service-role credential is used by the browser application. The local MCP launcher keeps its service-role credential on the developer machine and is outside the Vite/Vercel deployment boundary.

## Verified production evidence

### Hosted auth and persistence acceptance — PASS

Founder manual production test on `https://agym-murex.vercel.app` (2026-07-15):

1. Sign-in succeeded.
2. A harmless throwaway log was created and confirmed.
3. Refresh retained the record.
4. Sign-out returned the application to the authentication gate.
5. Signing back in restored the same account-scoped record.

This satisfies the Phase 2 plan acceptance criterion. It is user-confirmed evidence, not an automated browser-run record.

### Supporting automated evidence

`docs/architecture/networked-alpha-verification.md` records the following verified local checks:

- `npm run typecheck` — pass
- `npm run lint` — pass
- `npm run test:run` — 101 tests / 17 files passed
- `supabase/tests/rls-isolation.sql` — 11/11 pass
- `supabase/tests/account-deletion.sql` — pass

MCP client proof is tracked separately from Phase 2 but confirms that a separately authorized Claude Desktop client can connect to the same hosted account through the local MCP boundary.

## Required final gate: disposable-account data-rights proof

This is deliberately not run against the founder's primary AGym account.

1. Create or invite a disposable mailbox/account through the existing private-alpha flow.
2. Sign in at production and create one unmistakably throwaway log/event.
3. In **Data**, click **Export all JSON** and save the file.
4. Verify the exported JSON contains that account's raw log and confirmed event, and does not contain another account's data.
5. In **Data → Delete my account**, type `DELETE` and complete deletion.
6. Verify that the app returns to the sign-in gate.
7. Attempt to sign in again with the deleted account; it must not restore the former session or records.
8. Where permitted by the test setup, verify all user-owned rows are absent and the account no longer exists.

Record the result here before changing this document's status to **complete**.

## Historical GitHub issue disposition

The issues below are labelled `phase-2` but do not define the accepted hosted Phase 2 scope:

| Issue | Disposition | Rationale |
|---|---|---|
| #29 — provenance taxonomy decision | Superseded by the deployed hosted schema/plan provenance boundary and ADR 0002; preserve issue history, then close as superseded during close-out. | Current MCP plan writes are forced to `agent_written_plan`; agents cannot create `user_confirmed` outcomes. |
| #30 — interchange JSON decision | Superseded for hosted-alpha implementation; retain export schema tests as the current browser-export contract, but do not declare it the universal hosted interchange contract. | The issue's proposed contract predates the hosted plan/execution model and needs a later, versioned design if external interchange becomes a product surface. |
| #32 — JSON-file StorageAdapter | Close as superseded. | The accepted alpha uses user-scoped Supabase storage, not local shared files. |
| #33 — local-file read-only MCP | Close as superseded. | A Supabase-backed standard MCP server with bounded context and explicit authorization is implemented and verified. |
| #36 — File System Access API link | Close as not planned / superseded. | It only improves the rejected local-file handoff path. |

## Completion decision

Do not label Phase 2 complete until the disposable-account export-and-delete proof passes. Once it passes, close/supersede the five historical GitHub issues above, update this record with the result, and merge the close-out documentation PR.
