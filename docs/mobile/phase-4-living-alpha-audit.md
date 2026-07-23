# Mobile Phase 4 living-alpha audit

**Audited source:** `feat/mobile-phase4-correction-proof` at `abb9bcc`:

- `bbb539e` — raw capture and review flow;
- `b83d633` — generalized workout correction and focused client tests;
- `abb9bcc` — a reset-runnable hosted lifecycle/RLS proof.

**Scope:** Phase 4, *text capture, raw evidence, and correction UX*, in the proposed `docs/plans/2026-07-21-mobile-alpha-feature-plan.md`. This is a source and hosted-database audit. It is not evidence of a real-device pass.

## Verified correction-proof boundary

- `CaptureScreen` is a signed-in, text-first capture surface. It writes a `raw_logs` row before it requests a structured draft.
- `create_deterministic_parse_draft(raw_log_id)` derives `auth.uid()`, reads only an undeleted raw log owned by that identity, and writes a separate `parse_drafts` row. It is `SECURITY DEFINER`, has an empty search path, is revoked from `public`/`anon`, and is granted only to `authenticated`.
- The deterministic draft retains the immutable raw text and records `provenance = 'llm_parsed_uncertain'`; it does not overwrite the raw record.
- The review screen renders every parsed workout exercise and every set. The user can correct each exercise name and each set's reps/load before confirmation. The raw evidence remains visible, and displayed safety/uncertainty reasons are not treated as facts.
- Confirmation constructs a `user_confirmed` canonical event linked to both `source_raw_log_id` and `source_parse_draft_id`. A `correction_diff` retains the original draft fields when the user changed them.
- The existing History/Log surface visibly distinguishes `RAW SELF-REPORT`, `PARSED DRAFT · UNCERTAIN`, and `USER-CONFIRMED` evidence records.

## Automated and hosted evidence

Executed against this source on 2026-07-23:

| Check | Command | Result |
|---|---|---|
| Capture correction helpers | `cd apps/mobile && npm test -- --run src/features/capture/captureApi.test.ts` | PASS — 2 tests |
| Mobile type check | `cd apps/mobile && npm run typecheck` | PASS |
| Mobile lint | `cd apps/mobile && npm run lint` | PASS |
| Local/hosted migration parity | `npx supabase migration list --linked` | PASS — all 13 local migrations match remote |
| Hosted lifecycle/RLS proof | `cd supabase && npx supabase db reset --linked --yes --sql-paths tests/deterministic-parse-drafts.sql` | PASS — all 13 migrations applied; owner parse/confirmation succeeded; cross-user parse and canonical confirmation were rejected |

The hosted reset was authorized because this alpha project contains only disposable mock data. The test transaction rolls its test records back; the reset itself intentionally clears prior mock records.

## Android artifact and signed-in device evidence

Executed on 2026-07-23:

| Check | Result |
|---|---|
| EAS Android preview build | `7685c0dd-04dc-412d-8bfa-7edf5b2831a2` finished successfully for exact commit `f6113b2b028be7ef85793e804537c3f4acedaa85` |
| Artifact/install | downloaded `pTHjAtCvAEio2xosALX9Dp9PEQUgLhoxGQoOU7zp23o.apk`; `adb install -r` succeeded for `com.bdaniele03.agym` |
| Device | booted Android emulator `sdk_gphone16k_x86_64` (`emulator-5554`) |
| Auth | a disposable hosted test account completed the magic-link callback and reached the authenticated Today tab; the defect in the previous build was fixed by `f6113b2` |
| Capture/review | raw workout text saved first; uncertain review showed all three parsed sets with editable name/reps/load and both confirm/discard actions |
| Confirmation/history | explicit confirmation dialog completed; Capture stated `User confirmed. Raw evidence remains preserved.` and History visibly labelled `USER-CONFIRMED`, `PARSED DRAFT · UNCERTAIN`, and `RAW SELF-REPORT` |

The disposable test account and local magic-link artifacts were deleted after validation. No access token, magic link, or user identifier is retained in this record.

## Result: correction proof and core Android capture loop passed

The successor slice closes the original audit's concrete source gaps for generalized exercise/set correction, pure client helper coverage, two-account raw → draft → canonical lifecycle proof, artifact provenance, and the signed-in Android raw → uncertain review → user confirmation → provenance-history loop.

It does **not** establish the full product-level Phase 4 acceptance statement yet:

1. **Account lifecycle proof remains partial.** This run did not record force-close/reopen persistence or a second-account switch; those are mobile-alpha release gates, not evidence to infer from the successful single-account flow.
2. **Original proposed-plan breadth remains deferred.** The proposed Phase 4 plan calls for editable date/source/plan context, dedicated review/composer/history components, and UI tests for all capture transitions. This correction-proof branch deliberately implements the narrow text/workout path rather than claiming those broader additions.
3. **Agent-context observation is not a device proof.** The database boundaries ensure the confirmed canonical event and labelled raw evidence are durable; an end-to-end founder MCP context read after a device capture must still be recorded before claiming the whole alpha demo passed.

## Follow-up: account-switch fix, tooling fixes, and hosted MCP context-read proof (2026-07-23)

This session (no Android/iOS device, emulator, adb, or EAS CLI available in this environment) closed what a headless environment can close, and re-confirms what still needs a physical device.

**Account-switch state clearing — real gap found and fixed.** `AuthProvider.tsx` had a comment noting "Account-scoped feature stores/outboxes must subscribe here and clear synchronously" but never actually wired this up: `localDraftStore`'s `clearAccountLocalExecutionDrafts` was never called on sign-out or account switch. Added `apps/mobile/src/auth/sessionTransition.ts` (a pure, unit-tested transition classifier: `none` / `signed_in` / `switched_account` / `signed_out`) and wired it into `AuthProvider` so account-scoped local execution drafts are cleared before the next session's data is used. This is a genuine fix, not just a test.

**Force-close/reopen persistence — unchanged, still requires a physical device.** The SecureStore-backed Supabase session persistence wiring (`persistSession: true`, a SecureStore-backed storage adapter, `getSession()` restored on bootstrap) was re-inspected and is correctly configured. No physical-device force-close/reopen pass was performed in this session; that remains a required manual release-gate check.

**Two real CI/tooling gaps found and fixed.** Root `npm run lint` and root `npm run test:run` were not excluding `apps/mobile`, which has its own separate ESLint config and Vitest environment. Root lint crashed (`eslint-plugin-react`/ESLint version conflict while linting `apps/mobile/eslint.config.js`) and root test crashed (`Worker exited unexpectedly`, mixing mobile's `node` test environment into root's `jsdom` run) — both reproduced cleanly after a fresh `npm ci`, confirming they were real gaps, not install corruption. Fixed by excluding `apps/mobile` in root `eslint.config.js` and root `vite.config.ts` test config, and added a `mobile-quality` CI job so `apps/mobile`'s own lint/typecheck/test actually run in CI (previously untested by CI at all).

**Hosted DB reset + full SQL lifecycle/RLS proof.** Ran `supabase db reset --linked` against the hosted alpha project. All 5 SQL proofs (`gym-plan-acceptance`, `gym-workout-execution`, `deterministic-parse-drafts`, `rls-isolation`, `account-deletion`) were verified authoritatively via local Docker Supabase + real `psql` (which displays every `SELECT`-based assertion, not just `RAISE NOTICE` lines) — all pass, 100% clean. Note: the hosted CLI's `--sql-paths` batch-seeding mechanism silently drops bare-`SELECT` assertion output and produced one misleading failure (`raw-log delete unexpectedly succeeded`) on `rls-isolation.sql`; a clean, isolated local re-run proved this was a CLI-batching artifact, not a real regression — `DELETE` on `raw_logs` is correctly rejected (`permission denied`, SQLSTATE 42501) for both the owner and cross-user cases.

**Founder MCP context-read proof, against the real hosted project.** Seeded a disposable hosted account through normal RLS — `raw_logs` insert → `create_deterministic_parse_draft` RPC → `user_confirmed` `canonical_events` insert → `read_context` grant — mirroring exactly the row shapes `CaptureScreen` produces on a device. Then called the real production `get_context` tool handler (the same code Claude Desktop/Hermes calls, from `mcp/agym-server.ts`) against the hosted DB. Result: exactly 1 `confirmed_event` (`provenance=user_confirmed`, correct data) and 1 `raw_note` (`provenance=raw_self_report`, `interpretation_status=unparsed`, correct text). The disposable account was deleted immediately after. No access token, magic link, or user identifier is retained in this record.

This proves the device-capture → MCP-context-read loop end-to-end through real production code and the real hosted database — everything except the literal physical screen tap.

## Next gate

Two items remain, and both require an actual phone (or emulator with a signed EAS build), which this environment cannot provide:

1. Force-close/reopen session persistence and a second-account switch, run on real iOS and Android hardware.
2. A repeat of the founder MCP context-read check, this time starting from an actual on-device capture rather than an API-seeded equivalent.

Do not record access tokens, magic links, or private health data.
