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

## Android artifact and unauthenticated launch evidence

Executed on 2026-07-23:

| Check | Result |
|---|---|
| EAS Android preview build | `03e5524f-f46a-4f84-8388-a77026da673d` finished successfully for exact commit `b83d633d0cd846996cb21ff0e1bc5ac5ae184a14` |
| Artifact | `ds_VeMYFvMUaBhTnbFIqTVXQKOPeOKKwcWuHgnARHJc.apk`, downloaded successfully (113 MB) |
| Installation | `adb install -r` succeeded for package `com.bdaniele03.agym` |
| Launch | process opened in `com.bdaniele03.agym/.MainActivity`; no Android/React Native fatal exception found in the inspected launch log |
| Device | booted Android emulator `sdk_gphone16k_x86_64` (`emulator-5554`) |
| Unauthenticated screen | verified visible: the native private-alpha magic-link sign-in screen, with email field and sign-in action |

This proves the exact correction-source artifact builds, installs, and reaches its real native authentication boundary. It does not prove a signed-in capture flow.

## Result: source/hosted proof passed; signed-in device gate remains open

The successor slice closes the original audit's concrete source gaps for generalized exercise/set correction, pure client helper coverage, and two-account raw → draft → canonical lifecycle proof.

It does **not** establish the full product-level Phase 4 acceptance statement yet:

1. **Signed-in real-device proof is incomplete.** A disposable invited account must validate magic-link return, raw capture, multi-set correction, confirmation, History labels, force-close/reopen, and account-switch isolation. This requires a usable test-account authentication path; do not record or paste a magic link/token in this audit.
2. **Original proposed-plan breadth remains deferred.** The proposed Phase 4 plan calls for editable date/source/plan context, dedicated review/composer/history components, and UI tests for all capture transitions. This correction-proof branch deliberately implements the narrow text/workout path rather than claiming those broader additions.
3. **Agent-context observation is not a device proof.** The database boundaries ensure the confirmed canonical event and labelled raw evidence are durable; an end-to-end founder MCP context read after a device capture must still be recorded before claiming the whole alpha demo passed.

## Next gate

Use a disposable invited account to complete the signed-in Android checklist above, then record only the build ID, device model, pass/fail state, and sanitized evidence. Do not record access tokens, magic links, or private health data.
