# ADR 0004 — Direct Remote MCP and a Separate Hetzner Intelligence Plane

Status: accepted
Date: 2026-07-24
Supersedes: ADR 0002's local-stdio-first direction for external/mobile alpha delivery; amends ADR 0003's local-stdio compatibility wording.

## Decision

AGym has two deliberately separate planes:

```text
Product data / user-agent plane
compatible MCP client
  → direct Streamable HTTP MCP at AGym's public Vercel origin
  → Supabase OAuth 2.1 + user consent
  → Vercel MCP handler
  → grant-checking, RLS-scoped Supabase RPCs
  → AGym user data

Company intelligence plane
approved company inputs
  → Hetzner-hosted internal harness
  → bounded company memory / evaluations / work queues
  → human-approved plans, tickets, or deployment proposals
  → existing product and delivery boundaries
```

The native AGym app talks to Supabase for its authenticated product UI. It is not an MCP client and does not embed an MCP, model, service-role, or company-harness credential.

External user agents must connect directly to the remote MCP endpoint. A local `mcp/agym-server.ts` stdio process is retained only as a developer compatibility/test utility while it has maintenance value. It is not an external-tester requirement, a mobile dependency, or a production intermediation layer.

Hetzner will become the planned internal AI intelligence layer for AGym: an operator-controlled harness and company memory for internal work. It is not an OAuth issuer, a Supabase identity bridge, the public MCP endpoint, or an authority that may directly mutate user data.

## Invariants

1. **Product truth remains in product systems.** Supabase remains authoritative for user accounts, raw self-reports, uncertain drafts, user-confirmed outcomes, plans, grants, and audit facts. The company memory is not a second canonical user-data store.
2. **Direct user-agent access.** Remote MCP identity derives only from the remote OAuth token and its verified subject/client claims. The Hetzner harness and local stdio server may not proxy, impersonate, mint, exchange, cache, or replay a user's OAuth/Supabase token.
3. **Explicit product permissions.** OAuth consent never replaces AGym's independently revocable per-action grants. A remote MCP write may create only a proposed, agent-written plan; it cannot confirm an outcome or activate a plan.
4. **No user-data backhaul by default.** Raw fitness logs, private account data, OAuth bearer/refresh tokens, service-role credentials, and private exports must not enter Hetzner company memory or harness logs. Any future exception requires a separate data-flow ADR, user consent, minimisation, retention/deletion design, and security review.
5. **Harness outputs are proposals/evidence, not truth.** Internal agents may draft plans, tickets, runbooks, evaluations, or code-change proposals. A human or the existing product confirmation boundary must approve the resulting effect.
6. **Least privilege and separation.** The Hetzner host uses distinct non-human identities per service, secrets outside Git, encrypted backups, audit logs, restricted administration, and no shared production database superuser credential.
7. **No premature tooling choice.** This ADR chooses boundaries and planning direction only. It does not select an agent framework, vector database, queue, model provider, orchestration product, or deployment stack.

## Why

The previous local stdio MCP was useful to prove an early founder loop, but requiring every user or mobile tester to operate a local privileged process creates friction and makes the product depend on the founder's machine. Direct OAuth-protected remote MCP is the correct user-facing boundary.

The company still needs an internal place to run repeatable agent work, retain operational knowledge, evaluate harness changes, and coordinate human-in-the-loop delivery. Hetzner can provide that company-controlled execution environment without placing it on the path between an AGym user and their chosen agent.

## Consequences

- Remote MCP activation is a product-alpha gate, not merely a deployed HTTP route. It requires the real-client OAuth/DCR/PKCE, two-account isolation, grant/revocation, and audit proof already specified in `docs/deploy/remote-mcp-phase-b.md`.
- The existing Hetzner Keycloak staging host is legacy research infrastructure. It is not part of the selected remote-MCP design and must not be repurposed into a token broker or production identity component.
- Hetzner intelligence-plane implementation begins only after the phased plan in `docs/plans/2026-07-24-hetzner-intelligence-plane.md` passes its discovery and security gates.
- Historical local-stdio and Keycloak documents remain evidence. They are not current implementation instructions where they conflict with this ADR.
