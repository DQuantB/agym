# Mobile Phase 4 living-alpha audit

**Audited source:** `feat/mobile-phase4-capture` at `bbb539e` (`feat(mobile): add raw capture review flow`, 2026-07-22)

**Scope:** Phase 4, *text capture, raw evidence, and correction UX*, in `docs/plans/2026-07-21-mobile-alpha-feature-plan.md`. This is a source/contract audit. It is not evidence of a real-device pass.

## Verified implemented boundary

- `CaptureScreen` is a signed-in, text-first capture surface. It inserts a `raw_logs` row before asking for a structured draft.
- `create_deterministic_parse_draft(raw_log_id)` derives `auth.uid()`, looks up only an undeleted raw log belonging to that identity, and creates a separate `parse_drafts` row. The function is `SECURITY DEFINER`, uses an empty search path, is revoked from `public`/`anon`, and granted only to `authenticated`.
- The migration stores deterministic output with `provenance = 'llm_parsed_uncertain'` through the table default/constraint path; it does not overwrite the raw text.
- The screen distinguishes uncertain review from canonical confirmation. Confirmation inserts a `canonical_events` record with `provenance: 'user_confirmed'`, linked to both `source_raw_log_id` and `source_parse_draft_id`.
- The committed SQL regression script proves owner parsing and cross-user parse denial for the new RPC.
- The existing `LogScreen` was extended in the Phase 4 commit to query and visibly label `RAW SELF-REPORT`, `PARSED DRAFT · UNCERTAIN`, and `USER-CONFIRMED` evidence records. It is the current History surface.

## Audit result: partial, not Phase-4 complete

The branch implements the narrow raw-log → uncertain-draft → user-confirmed-record path. It does **not** yet meet the whole Phase 4 acceptance statement: “a user can correct a questionable parse in a few taps, and an agent subsequently sees the confirmed result plus correctly labelled raw evidence.”

### Verified gaps to close before calling Phase 4 source-complete

1. **Correction is only a first-exercise shortcut.** The screen edits one exercise name and its first set's reps/load. It does not provide general inline editing for all parsed sets/exercises, date, source/plan context, or an explicit uncertainty-reason view per editable field.
2. **No capture or history unit/UI tests.** `apps/mobile` has no committed capture/history test. The only Phase-4 test is the SQL RPC script; it does not exercise the mobile client mapping, confirmation payload, or history labels/error states.
3. **No confirmation transition RLS regression.** The existing new SQL test proves the parser RPC is owner-scoped, but does not prove the full raw → draft → canonical transition for two users or that a second identity cannot create a canonical record linked to the first identity's evidence.
4. **No device proof.** No Android/iOS source-to-APK provenance or real-device capture/correction test is recorded. Source checks cannot establish keyboard, tap, screen-reader, or account-switch behavior.

## Known scope distinction

`docs/plans/2026-07-21-mobile-v2-delivery-plan.md` narrows a later native-alpha sequence around one accepted Gym workout and labels Log/Data as M6. It does not supersede the already-committed Phase 4 raw-capture branch by itself. Until a superseding ADR/plan is accepted, the raw-evidence trust boundary above remains binding for this branch.

## Next scoped delivery slice

Create a fresh successor worktree from `bbb539e` and close only the first auditable gaps:

1. generalize the correction UI to all parsed exercises/sets while retaining each uncertainty reason and the immutable raw evidence;
2. extract/test pure capture API mapping and canonical confirmation payload construction, including the History status labels;
3. add a two-account SQL proof for the complete raw → draft → canonical path;
4. retain raw evidence and preserve immutable provenance; do not add voice, analytics, a generic parser, or a coach dashboard.

After automated checks pass, rebuild the Android APK from the successor commit and perform the manual capture/correct/confirm/account-switch device checklist before declaring Phase 4 device-validated.
