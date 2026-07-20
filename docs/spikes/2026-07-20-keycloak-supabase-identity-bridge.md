# Spike — Keycloak to Supabase identity bridge for Remote MCP

Status: completed — no production bridge selected
Date: 2026-07-20
Scope: Phase B staging architecture research only. No Keycloak, Supabase, Vercel, user-data, or identity configuration was changed by this spike.

## Question

Can a public Claude remote-MCP client authenticate through Keycloak while the AGym remote handler continues to access the existing Supabase data model through the authenticated user's real RLS identity?

The required boundary is:

```text
Claude receives: Keycloak OAuth tokens only
Vercel remote MCP receives: a validated Keycloak identity and, if proven safe,
                            a transient user-scoped Supabase access token
Supabase receives: only a genuine project user token whose sub is the existing
                   auth.users UUID, so auth.uid() and current RLS remain intact
```

The remote runtime must not use a service-role key. Claude must never receive a Supabase access token, refresh token, Keycloak admin credential, or backend confidential-client secret.

## Constraints confirmed before this spike

- Existing AGym rows and RLS are owned by Supabase Auth UUIDs.
- The current AGym Supabase Third-Party Auth UI exposes named providers, not a generic Keycloak/OIDC issuer.
- A Keycloak-issued JWT is not a Supabase project JWT. Copying the UUID into `sub`, adding `role: authenticated`, or configuring similar claims cannot make Supabase accept a Keycloak signature/issuer.
- The remote endpoint must derive identity only from a validated token subject. It must not accept a user ID from MCP input, headers, query parameters, or a client label.

## Candidate analysis

### 1. Forward a Keycloak token to Supabase

Verdict: rejected.

Supabase will not treat the Keycloak token as an AGym project user token under the current Third-Party Auth capability. Therefore PostgREST cannot resolve the existing user identity through `auth.uid()` and existing RLS is not preserved.

### 2. Keycloak brokers Supabase as an upstream OIDC provider, then the backend retrieves the broker token

Verdict: conditionally possible in Keycloak, but unproven and not approved for implementation.

The only potentially compatible design is:

1. The user signs in to Keycloak through a Supabase upstream identity-provider flow.
2. Keycloak stores the *genuine upstream Supabase user token* for that brokered identity.
3. Claude gets only a Keycloak token.
4. **Hypothesis only:** the Vercel handler might use a confidential, backend-only Keycloak broker-token retrieval mechanism for that exact brokered Keycloak subject. The exact Keycloak 26.5 endpoint/provider, credential, role, and authorization semantics are not yet evidenced.
5. If and only if that mechanism yields a genuine **Supabase access token** (never a refresh token), the handler would use that access token only in memory to call AGym Supabase. It would return neither token nor token-derived credentials to Claude.

Keycloak would itself become a credential-holding component in this design. Before it can be selected, the threat model must cover whether upstream access/refresh tokens are stored, encryption/key management at rest, administrator and backup access, log exposure, retention/deletion on unlink or revocation, and the guarantee that backend retrieval cannot return an upstream refresh token.

This preserves RLS **only if** the retrieved upstream token is a genuine token accepted by this project’s REST API and has all of the following properties:

- `sub` equals the existing `auth.users.id` / AGym owner UUID;
- it has the authenticated-user claims used by the current RLS policies;
- it is accepted by `https://<project-ref>.supabase.co/rest/v1/...`;
- Keycloak cannot retrieve another user's upstream token based on caller input;
- the public DCR client cannot obtain Keycloak broker-token-read capability or the backend audience.

This is not Keycloak “converting” a token into a Supabase JWT. It is only a backend retrieving a token that Supabase previously issued to the same user.

Mandatory disposable-staging proof before this option may be selected:

1. Prove the exact Supabase project exposes a supported upstream authorization/token flow for the existing AGym identities.
2. Prove the access token resulting from that flow is accepted by the project's PostgREST API.
3. Prove its `sub` is the existing Supabase UUID and `auth.uid()` resolves to it.
4. With two dedicated accounts and disjoint fixtures, prove A cannot read/write B and B cannot read/write A through real RLS.
5. Prove broker-token retrieval is bound to the validated Keycloak subject, not an input UUID/email, and identify the exact Keycloak endpoint/provider and enforcement mechanism.
6. Prove a public Claude client cannot call that retrieval mechanism, obtain a broker token, backend credential, privileged Keycloak audience, or upstream **access/refresh** token.
7. Prove Vercel receives only a transient upstream **access** token; it must never receive an upstream refresh token.
8. Test expiry, upstream refresh failure, Keycloak logout, Supabase session revocation, unlink/deletion, and error handling. A refresh failure must require reauthentication; it must never fall back to a service-role or a different account.

Until every assertion passes, this remains a hypothesis rather than an identity bridge.

### 3. Keycloak RFC 8693 token exchange mints a Supabase token

Verdict: rejected.

Keycloak token exchange can issue/manage Keycloak-controlled tokens for permitted audiences. It does not grant Keycloak authority to mint a JWT signed by Supabase. Any Keycloak output remains a Keycloak token and does not preserve the existing Supabase issuer/signature boundary.

A backend-only exchange could potentially restrict access to Keycloak's broker-token facility, but it does not solve the requirement that the final data call use a genuine Supabase user token.

### 4. Vercel vault of per-user Supabase refresh tokens

Verdict: not selected.

This could technically preserve RLS, but it creates a new high-value credential vault that needs encryption, rotation, deletion, audit, account-link protection, and revocation semantics. It is not a justified fallback for Phase B and must not be added casually.

## Identity and lifecycle rules for a future broker proof

- Bind a Keycloak user to the immutable upstream tuple `(issuer, upstream sub)`, not email. Email-based automatic linking is not sufficient for owner identity.
- The backend must validate Keycloak issuer, signature/JWKS, audience, expiry, authorized party/client, and subject before performing a broker lookup.
- The lookup must use that validated Keycloak subject only. The request must never choose an upstream/Supabase user ID.
- Keep any genuine Supabase access token transient in backend memory; do not persist it in Vercel, emit it in logs, include it in errors, or expose it through MCP metadata/tool output.
- Supabase access JWTs are short lived. A Keycloak logout may stop later broker retrieval but does not automatically invalidate an already issued Supabase JWT. The implementation must model this residual lifetime explicitly and avoid a cached token beyond its expiry.

## Conclusion

There is no supported generic “Keycloak token to Supabase RLS token” conversion path for the current AGym project.

The only candidate that could preserve the established owner/RLS boundary is a server-only Keycloak broker-token flow using a genuine Supabase-issued project user token. It is blocked until a disposable staging proof demonstrates that Supabase can serve as the required upstream provider and that the resulting token works against the existing project RLS without reaching Claude.

Phase B must not deploy a remote Claude connector until that proof and the exact-callback DCR gate both pass. The existing local stdio MCP path remains the safe supported integration.

## References

- Current Keycloak Server Administration Guide — Identity Brokering and client registration: https://www.keycloak.org/docs/latest/server_admin/
- Keycloak 26.5.0 source: https://github.com/keycloak/keycloak/tree/26.5.0
- Supabase Third-Party Auth overview: https://supabase.com/docs/guides/auth/third-party/overview
- Supabase JWTs: https://supabase.com/docs/guides/auth/jwts
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase OAuth Server: https://supabase.com/docs/guides/auth/oauth-server
