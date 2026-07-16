# ADR 0003 — Phase B: Remote OAuth-protected MCP

Status: accepted
Date: 2026-07-16
Supersedes: ADR 0002 only for the MCP transport and remote-client identity boundary

## Decision

AGym Phase B adds a hosted, stateless Streamable HTTP MCP endpoint at the AGym production origin. It enables compatible remote MCP clients to read a signed-in user's bounded AGym context and create review-required plan proposals.

The existing local stdio MCP server remains supported for local clients. It is not exposed over HTTP.

```text
compatible remote MCP client
  → OAuth 2.1 authorization-code + PKCE
  → AGym remote MCP endpoint
  → verified token subject + approved OAuth client identity
  → Supabase RLS + AGym per-action authorization
  → bounded context / proposed plan
```

## Hard security boundary

1. The endpoint derives the AGym account only from a validated OAuth access-token subject. It never accepts a user ID from MCP tool arguments, query parameters, headers, or environment configuration.
2. A remote client identity derives only from a validated, allowlisted OAuth `client_id`, mapped server-side to an AGym `agent_identifier`. It never trusts a client-provided label.
3. The remote endpoint uses a user bearer token plus the Supabase publishable key and owner-scoped RLS. It does not use a Supabase service-role key.
4. Existing `agent_authorizations` remain the independently revocable product permission layer. OAuth authentication does not imply AGym read or write permission.
5. The only remote tool surface in this phase is `get_context`, `list_plans`, and `create_proposed_plan`. Plan creation remains atomic, `agent_written_plan`, and `proposed`; no remote tool can confirm an outcome or activate a plan.
6. The endpoint is stateless request/response Streamable HTTP. Phase B does not add SSE, resumable sessions, sampling, tasks, dynamic OAuth-client registration, or arbitrary agent identifiers.
7. A remote deployment is prohibited until Supabase OAuth 2.1 Server is enabled, a first real client is explicitly registered/allowlisted, and a staging OAuth authorization-code + PKCE proof succeeds.

## Why

The local stdio process is bound to one configured user and holds a service-role credential. That is appropriate for a local, user-controlled process but cannot establish a remote caller's user or client identity. Remote access requires a cryptographically verified identity and a database-enforced owner boundary.

## Consequences

- AGym can target interoperable MCP clients without creating a custom connector for each model vendor.
- "All LLMs" means compatible MCP client products, not every chat UI or every model. Client support is verified one client at a time.
- The first production client is deliberately allowlisted. Adding a later client requires a reviewed mapping and a user-visible authorization entry, not an implicit compatibility claim.
- The web app remains Vercel-hosted. The remote MCP handler is a server-side Vercel function in the same project/domain; it is not Vite browser code.
