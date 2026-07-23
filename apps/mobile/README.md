# AGYM mobile

AGYM mobile is the native Expo client for the private alpha. It is intentionally separate from the Vite web companion and contains only public mobile configuration.

## Local setup

```bash
cd apps/mobile
cp .env.example .env.local
npm ci
npm run typecheck
npm test
npm run lint
npx expo-doctor
```

Set only these values in `.env.local`:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
```

Never place a service-role key, database password, MCP credential, or model credential in this app or any `EXPO_PUBLIC_*` variable.

## Magic-link authentication

The app uses the `agym` deep-link scheme and sends Supabase magic links to:

```text
agym://auth/callback
```

Before testing sign-in, the AGYM owner must add that exact redirect URL (or the provider's documented equivalent pattern that includes it) to Supabase Auth's redirect allow-list. The app exchanges the one-time PKCE `code` from that link into a SecureStore-persisted session. A native device test remains required for cold-start links, foreground links, force-close/reopen, and sign-out.

## Run on Android

Use the already configured Android application ID `com.bdaniele03.agym`.

```bash
npm run android
```

For a development build, use the checked-in EAS profile after the automated checks pass. An APK build or emulator launch is not authentication validation: sign in with an invited test account, force-close and reopen, then sign out and confirm the private tabs disappear.

## Scope status

This branch provides the Phase 1 native auth shell: email magic-link request, SecureStore-backed session restoration, deep-link PKCE exchange, sign-out, and an authentication gate. It does not claim that Supabase dashboard redirect configuration or an Android/iOS device test has been completed.
