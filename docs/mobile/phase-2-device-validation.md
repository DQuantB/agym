# Phase 2 native Today and Plans validation

Phase 2 source checks prove the native read surfaces compile and their pure query/state behavior is covered. A signed-in Android device test is still required before this phase is accepted as device-validated.

## Before testing

1. Rebuild the APK from the current `feat/mobile-auth-shell` source after commit `564043e` and the subsequent uncommitted Phase 2 completion changes are included.
2. Confirm the mobile app has its public Supabase configuration only:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` (or the project's documented public/publishable-key name)
3. In Supabase Auth, retain `agym://auth/callback` as an allowed redirect URL.
4. Use the existing authorized local MCP integration to create one proposed Gym workout for the signed-in test account. Do not paste credentials into this record.

## Android/device acceptance checks

### Authentication and account scope

- [ ] Launch the newly built APK and complete magic-link sign-in.
- [ ] Force-close and reopen it; the session remains signed in.
- [ ] Sign out; Today and Plans show sign-in-required states and no previous account's title/source remains visible.
- [ ] Sign in as a second invited account. The first account's plan must not appear. This is a user-facing confirmation of the Supabase RLS owner boundary.

### Plans

- [ ] Before a remote result returns, Plans shows `Loading plans`, not a misleading `No proposal loaded` state.
- [ ] The MCP-created plan displays `✧ Agent proposal · <source>` with plan title and scheduled date.
- [ ] It states `Nothing has been applied yet` and exposes Review, not workout start.
- [ ] Accept it only through the proposal review flow. After refresh, it appears as `◇ Planned`.
- [ ] Disable connectivity or use an invalid public endpoint in a disposable build only; Plans shows a warning and does not display stale plan data as if it belonged to the current account.

### Today

- [ ] A proposed-only plan appears as `✧ Agent proposal`, remains review-only, and has no Start Workout action.
- [ ] After acceptance, the scheduled plan appears as `◇ Planned` and Start Workout is available.
- [ ] An in-progress execution shows `● Workout in progress` and Resume.
- [ ] A confirmed execution shows `✓ User confirmed` and does not offer Start/Resume.
- [ ] Check labels at Android large-font/Dynamic Type size: proposal, planned, in-progress, confirmed, and warning meaning remain readable without relying on color alone.

## Evidence to record

Record the APK build identifier, Android device/emulator model, two-account result, and any failed state. Do not capture access tokens, magic links, or private health data in screenshots or issue comments.
