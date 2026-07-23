# AGYM native development and device setup

## Configuration

From `apps/mobile`, copy `.env.example` to `.env.local` and enter only the Supabase project URL and publishable key. `EXPO_PUBLIC_*` values are visible in the app bundle. Never put a service-role key, database password, MCP credential, or LLM key in mobile configuration.

## Run

```bash
cd apps/mobile
npm install
npm run start
```

Use Expo Go or a development build, then select iOS or Android from the Expo development server. The app uses the `agym://` scheme for native deep links; add the final callback URLs to Supabase Auth before inviting alpha users.

## Required pre-alpha device proof

On both iOS and Android: sign in, kill the app, reopen it, verify the same session persists, then sign out and verify account-scoped screens have cleared before any new account loads. A deliberate sign-out requires a new magic link if passwordless sign-in is used.

## Local checks

```bash
npx tsc --noEmit
npm run lint
```

Automated checks do not prove the real-device session lifecycle.
