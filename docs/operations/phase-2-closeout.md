# Phase 2 — Invite-only Auth and Hosted Storage Close-out

Status: **complete**

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

## Disposable-account data-rights proof — PASS

The data-rights proof was deliberately run against `gamerdani680@gmail.com`, not the founder's primary AGym account (2026-07-15).

1. An invite was sent to the disposable address and the account signed in to production.
2. A throwaway log/event was created and confirmed.
3. **Data → Export all JSON** produced an export that the user verified contained the disposable account's throwaway raw log and confirmed event.
4. **Data → Delete my account** required the confirmation phrase `DELETE` and completed the permanent-delete flow.
5. The application returned to the sign-in gate.
6. A post-deletion re-entry attempt returned `Signups not allowed for this instance`, confirming the invite-only guardrail stayed active rather than recreating the deleted account through public signup.
7. A read-only hosted Supabase Auth admin verification found no remaining user for the disposable address (`ACCOUNT_ABSENT_AFTER_DELETION`).

The deletion migration's automated cascade test remains the proof that deletion removes every associated user-owned table row; the production pass proves the real browser/account lifecycle through the deployed application.

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

**Phase 2 is complete.** The hosted invitation/authentication, per-user persistence, export, and full-account-deletion gates have both automated evidence and a production disposable-account proof. The five historical GitHub issues above can now be closed with their documented dispositions; this close-out record is the durable audit trail.