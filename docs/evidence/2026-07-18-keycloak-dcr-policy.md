# Keycloak DCR policy evidence — 2026-07-18

Scope: staging only. Realm: `agym-mcp-test` at `auth-mcp-test.a-gym.app`.

## Environment observed

- Server SSH access was restored and confirmed as the `agym` account.
- Keycloak container version: `26.5.0`.
- Realm discovery remains public and advertises a `registration_endpoint`.
- The realm has no configured Keycloak client policies or client profiles (`policies: []`, `profiles: []`).

## Disposable registration tests

No DCR client was created by either test; both returned HTTP `403`.

| Registration redirect URI | Result |
| --- | --- |
| `https://attacker.example/callback` | rejected, HTTP 403 |
| `https://claude.ai/api/mcp/auth_callback` | rejected, HTTP 403 |

The test requests used only public-client registration fields: `token_endpoint_auth_method: none`, `grant_types: ["authorization_code"]`, and `response_types: ["code"]`. No user token, client secret, Keycloak admin password, or registration response was recorded.

## Conclusion

The currently advertised Keycloak registration endpoint is **not usable by Claude**: it rejects the exact documented Claude callback as well as the deliberately invalid callback. The initial Phase B foundation therefore remains non-deployable for a Claude remote connector.

This is a safe failure: no permissive/open DCR behavior was found. Do not attempt to "fix" it by broadly opening registration or accepting arbitrary redirects.

## Next decision gate

Before any Keycloak policy change, the team must select a documented configuration that can simultaneously:

1. reject arbitrary redirect URIs;
2. accept only `https://claude.ai/api/mcp/auth_callback`;
3. create a public authorization-code client with PKCE S256; and
4. map the resulting authenticated user to the existing Supabase/RLS identity without a service-role key or a Supabase token reaching Claude.

If no such configuration can be proven in the staging realm, remote Claude MCP remains blocked and AGym retains its local stdio MCP integration.
