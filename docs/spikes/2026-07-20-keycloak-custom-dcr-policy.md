# Spike — Custom Keycloak policy for the Claude DCR contract

Status: research complete; implementation not approved
Date: 2026-07-20
Scope: Keycloak 26.5.0 staging feasibility only. No Keycloak configuration, provider JAR, public endpoint, or client registration was changed.

## Decision question

Can AGym use a small custom Keycloak extension to make its Dynamic Client Registration (DCR) endpoint safe for Claude's exact callback?

Required effective client contract:

```text
redirect_uris              exactly ["https://claude.ai/api/mcp/auth_callback"]
token_endpoint_auth_method exactly "none" / public-client semantics
grant type                 authorization_code only
PKCE                       S256 enforced server-side
```

All other redirect paths, client types, flows, broad web origins, service-account capability, custom metadata, and later DCR updates that weaken these settings must be rejected.

## Feasibility verdict

A custom Keycloak 26.5.0 **Client Registration Policy SPI** is feasible for the effective Keycloak client configuration. It is not, by itself, a full HTTP firewall or raw JSON-schema validator.

The verified 26.5.0 extension-facing interfaces/classes are:

```text
ClientRegistrationPolicy                 implemented by the policy
ClientRegistrationPolicyFactory          creates the policy from realm component configuration
ClientRegistrationContext                supplies the parsed client representation and session
ClientRegistrationPolicyException        signals a rejected registration/update
```

`ClientRegistrationPolicyManager` is Keycloak's policy-chain manager/invoker, not an interface implemented by the extension. It governs lifecycle invocation and makes actual realm ordering a prototype/test concern.

The policy lifecycle exposes `beforeRegister`, `afterRegister`, `beforeUpdate`, and `afterUpdate`. It receives the parsed `ClientRepresentation` before creation/update and the resulting `ClientModel` after creation/update. This supports validation before persistence and server-side assertion/normalization after persistence.

It does **not** prove the original raw JSON did not include a field that Keycloak ignored or normalized before the policy runs. Therefore raw-body size limits, duplicate-key rejection, strict unknown-field rejection, durable rate limiting, and external network access control must be separate controls.

## Minimal extension shape

```text
agym-keycloak-claude-dcr-policy/
  pom.xml
  src/main/java/io/agym/keycloak/dcr/
    ClaudeDcrPolicy.java
    ClaudeDcrPolicyFactory.java
  src/main/resources/META-INF/services/
    org.keycloak.services.clientregistration.policy.ClientRegistrationPolicyFactory
  src/test/java/...
  src/test/resources/...
```

- Build against exactly `26.5.0`, using Keycloak server dependencies as `provided`.
- Avoid private/internal Keycloak implementation APIs.
- Use a stable provider ID, no secrets, and no mutable process-local request/rate-limit state.
- Register the factory through Java `ServiceLoader` metadata.
- Apply the policy to the staging realm's DCR policy chain and verify policy ordering in the actual admin configuration.
- Implement both registration and update hooks. A valid client must not be mutable into an unsafe one through its registration-management path.

The extension is a Keycloak server plugin. It must be copied into `/opt/keycloak/providers/` while building a Keycloak image and run through the Keycloak provider build/optimized-image process. It is version-sensitive: recompile and run the full hostile integration matrix on every Keycloak upgrade.

## Required policy behavior

### Before register and before update

Reject unless the effective representation has all of the following:

1. `redirectUris` exists, has cardinality exactly one, and its only element byte-for-byte equals `https://claude.ai/api/mcp/auth_callback`.
2. The client is public; no secret-based authenticator, confidential behavior, service account, direct grant, client credentials, device flow, CIBA, implicit/hybrid behavior, or non-OIDC protocol is enabled.
3. The only accepted effective authorization flow is authorization code.
4. No URL/metadata setting can widen callback or browser behavior: root/base/admin URLs, broad web origins, logout URIs, JWKS/JWK URLs, request object settings, protocol mappers, role/group mappings, scopes, service-account roles, or arbitrary attributes must be rejected unless separately allowlisted.
5. No disallowed field that survives Keycloak parsing is present. This is an allowlist contract, not a growing blocklist.

Use generic client-registration errors. Do not log raw registration access tokens, authorization headers, client secrets, or full untrusted payloads.

### After register and after update

Assert the persisted `ClientModel` still satisfies the contract, then force Keycloak's server-side PKCE attribute to `S256` (commonly `pkce.code.challenge.method`). Do not rely on Claude sending a Keycloak-specific metadata field: RFC 7591 does not provide one universally interoperable field meaning “enforce PKCE S256.”

The integration suite must demonstrate actual authorization behavior: no challenge and `plain` are rejected; a correct S256 verifier succeeds.

## What needs another layer

A Keycloak registration policy is defense in depth, not a replacement for request-edge controls.

An endpoint-specific gateway/WAF/reverse-proxy policy is required before public DCR because it provides:

- request-body and connection limits;
- strict JSON parsing/schema validation, including unknown/duplicate fields;
- rate limits and concurrency limits;
- content-type and timeout enforcement;
- token/header-redacted request logs;
- a deny-by-default network path so untrusted callers cannot bypass it to contact Keycloak's DCR endpoint directly.

This is not a metadata proxy. The Keycloak SPI remains the authority that validates the resulting client configuration. A gateway must not alter OAuth metadata or pretend that it implements authorization-server semantics.

Keycloak realm/admin controls must separately govern who can register/update clients and who can mutate clients via Admin Console, Admin REST, imports, or other privileged paths.

## Hostile test matrix

Run against a disposable Keycloak 26.5.0 integration environment with the JAR installed. Assert status/error, persisted `ClientModel`, and actual authorization/token behavior.

1. Happy path: captured real Claude DCR shape; exact URI; public authorization-code client; persisted PKCE exactly S256; valid S256 authorization succeeds.
2. Redirect attacks: missing/empty/multiple URI; URI plus second URI; trailing slash; query/fragment; HTTP; alternate host/port; userinfo; IDNA/encoding/case variants; whitespace/CRLF; wildcard; callback-like URI in another client URL field; broad `webOrigins`.
3. Authentication/client attacks: omitted/secret/basic/post/private-key/mTLS client auth; a supplied secret alongside `none`; public flag plus secret authenticator; service account/client credentials.
4. Flow attacks: omitted/empty/mixed grants; implicit; direct/password grant; device/CIBA; non-OIDC protocol; Keycloak flow flags inconsistent with declared grants.
5. PKCE attacks: missing/plain/malformed S256; update S256 to plain/absent; authorization without a challenge; `plain`; incorrect verifier; correct S256 verifier.
6. Raw payload attacks: unknown keys, nested unknown attributes, duplicate keys, wrong types/nulls, invalid JSON/UTF-8, deep JSON, oversize body/arrays/strings. Record which are rejected, ignored, defaulted, or observable by the SPI; any ignored form must be stopped by the gateway schema layer.
7. Lifecycle/operations: DCR update attempts, registration-management token handling, Admin Console/API mutation, realm/client import, provider missing/incompatible startup, a two-node deployment, gateway bypass, and a Keycloak patch/minor upgrade rehearsal.

## Operational burden

This is a small JAR but a material long-term security boundary:

- pinned Keycloak compatibility and upgrade tests;
- staged image build/release process;
- gateway/WAF and network-route maintenance;
- DCR audit/monitoring and abuse response;
- privileged-admin change controls;
- a reproducible test environment and hostile regression matrix.

It solves **only** the DCR client-configuration gate. It does not solve the separate Keycloak-to-Supabase user-token/RLS bridge. That bridge remains an unproven hypothesis documented in `2026-07-20-keycloak-supabase-identity-bridge.md`; neither JAR implementation nor public deployment may begin until it has its own real two-user proof.

## Recommendation

Do not implement or deploy the provider yet. First run a narrowly scoped prototype in a disposable Keycloak 26.5.0 environment to verify the actual SPI contract, policy ordering, persisted PKCE setting, and Claude's real DCR payload. In parallel, keep Phase B blocked on the Supabase RLS bridge proof. If either proof fails, retain the current local stdio MCP integration rather than weakening the data boundary.

## Sources checked

- Keycloak 26.5.0 `ClientRegistrationPolicy`: https://github.com/keycloak/keycloak/blob/26.5.0/services/src/main/java/org/keycloak/services/clientregistration/policy/ClientRegistrationPolicy.java
- Keycloak 26.5.0 `ClientRegistrationPolicyFactory`: https://github.com/keycloak/keycloak/blob/26.5.0/services/src/main/java/org/keycloak/services/clientregistration/policy/ClientRegistrationPolicyFactory.java
- Keycloak 26.5.0 policy manager: https://github.com/keycloak/keycloak/blob/26.5.0/services/src/main/java/org/keycloak/services/clientregistration/policy/ClientRegistrationPolicyManager.java
- Keycloak 26.5.0 registration context: https://github.com/keycloak/keycloak/blob/26.5.0/services/src/main/java/org/keycloak/services/clientregistration/ClientRegistrationContext.java
- Keycloak 26.5.0 built-in policy examples: https://github.com/keycloak/keycloak/tree/26.5.0/services/src/main/java/org/keycloak/services/clientregistration/policy/impl
- Keycloak current provider configuration guidance: https://www.keycloak.org/server/configuration-provider
