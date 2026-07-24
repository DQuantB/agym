# Mobile alpha release checklist

This checklist separates source/static evidence from device evidence. Do not mark a gate passed merely because TypeScript, lint, or an EAS build succeeds.

## Implemented source boundary

- [x] Data screen can create a versioned JSON export containing separately labelled raw self-reports and user-confirmed outcomes, then opens the device's system save/share sheet.
- [x] Account deletion calls the existing owner-scoped `delete_my_account` RPC; only after that succeeds does the app clear the current account's local workout drafts and sign out.
- [x] Export and deletion ordering have focused unit tests.
- [x] No service-role, database, MCP, or LLM secret is part of the native bundle.

## Required Android and iOS device gates

Run each check with a disposable invited account and record only non-sensitive evidence (build ID, device/OS, pass/fail). Never record a magic link, token, user ID, or private fitness data.

- [ ] Install an APK/IPA built from the exact candidate commit; record the EAS build ID and installed package version.
- [ ] Complete magic-link sign-in, force-close the app, reopen it, and verify the same session restores on Android and iOS.
- [ ] Sign out and then sign in as a second invited account. Confirm no prior account's Today, Plans, History, local draft, or authorization data is visible.
- [ ] Create an agent proposal; verify proposed is review-only, accept it through the owner-scoped flow, then verify planned/in-progress/confirmed Today states.
- [ ] Start a workout, edit actuals, add a set/exercise, force-close/reopen, and verify the local draft restores only for its owner.
- [ ] Disable connectivity while editing, restart, reconnect, verify one remote save, and confirm duplicate completion remains rejected.
- [ ] Capture messy text, review/correct the uncertain draft, confirm it, and verify History preserves `RAW SELF-REPORT`, `PARSED DRAFT · UNCERTAIN`, and `USER-CONFIRMED` separately.
- [ ] Trigger JSON export and verify the system sheet can save/share a valid JSON file with the expected provenance separation.
- [ ] Use a disposable account to delete all data. Verify the remote account cascade succeeds, the app returns to signed-out state, and local workout drafts no longer restore. A failed deletion must leave local drafts intact.
- [ ] Verify model authorization revoke is reflected in the Data screen and denied by the MCP boundary.

## Release constraints

- [ ] No microphone or voice provider is enabled until the separate Phase 5 spike has a documented founder-approved privacy, retention, quality, offline, and cost decision.
- [ ] No external tester is told AGYM diagnoses, treats, prescribes, or autonomously coaches.
- [ ] Export/delete and the two-account isolation checks pass before an external alpha collects real fitness data.
