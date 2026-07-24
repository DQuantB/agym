# AGym alpha — going live runbook

This runbook describes the current networked/mobile alpha. ADR 0004 is authoritative when older local-stdio or Keycloak planning documents conflict with it.

## Product architecture

```text
AGym mobile/web app → Supabase Auth + owner-scoped RLS → Supabase data
external agent client → Supabase OAuth + AGym consent → Vercel remote MCP → grant/RLS RPCs
Hetzner internal harness → approved company memory and human-approved internal delivery work
```

The phone is not an MCP client. It must not run a local MCP process or contain an MCP credential, model credential, service-role key, database password, or company-harness credential.

The local `mcp/agym-server.ts` process is a developer compatibility/test utility only. Do not ask an external tester to install or configure it, and do not treat a successful local handshake as proof that the remote mobile-agent loop works.

Hetzner is not in the product request path. Its planned role is the internal company intelligence plane described in `docs/plans/2026-07-24-hetzner-intelligence-plane.md`; it is not an OAuth issuer, token bridge, public MCP runtime, or user-data mirror.

---

## 1. Product deployment baseline

1. Deploy the Vercel project from reviewed GitHub `main`.
2. Keep only public Supabase configuration in browser/native public environment variables.
3. Keep service-role, database, OAuth signing, model-provider, and company-harness secrets out of Git, browser/native bundles, Vercel client configuration, and terminal transcripts.
4. Keep public signup disabled for the invite-only alpha and invite each tester deliberately.
5. Apply only migrations that have passed local SQL/RLS verification; confirm hosted migration parity before testing.

---

## 2. Required mobile data-ownership proof

Before collecting real tester fitness data, use disposable invited accounts to prove on the exact mobile candidate build:

1. sign-in persistence and account-switch isolation;
2. export creates a valid JSON file with raw self-reports and user-confirmed outcomes kept distinct;
3. deletion succeeds remotely before local drafts/session clear;
4. deletion failure retains the local session/drafts;
5. workout drafts survive offline/restart/reconnect without duplicate completion.

Record only build ID, device/OS, pass/fail, and non-sensitive observations. The detailed checklist is `docs/mobile/release-checklist.md`.

---

## 3. Direct remote MCP activation gate

The Vercel route existing or returning protocol errors is not activation proof. The remote MCP path is live for alpha only after the staging acceptance proof in `docs/deploy/remote-mcp-phase-b.md` passes:

1. a compatible client discovers protected-resource metadata and completes real OAuth authorization-code + PKCE S256 + dynamic client registration;
2. two disposable users with disjoint fixture data prove owner isolation;
3. `read_context` is denied before the AGym grant, succeeds after the matching grant, and is denied immediately after revocation;
4. `write_proposed_plan` is independently denied/granted/revoked and produces only an `agent_written_plan` with `proposed` status;
5. audit evidence records allowed and denied calls without bearer tokens or private payloads;
6. one resulting proposal is visible in mobile as review-only and needs explicit user acceptance before it becomes active.

Do not replace a failed direct-remote proof with a local service-role bridge, Hetzner proxy, Keycloak token broker, static user ID, or weaker RLS policy.

---

## 4. Internal Hetzner intelligence-plane gate

Do not deploy an agent framework, vector store, scheduler, model gateway, or company-memory database just because a server exists. First complete the inventory, threat model, company-memory contract, action contract, and representative-loop evaluation in `docs/plans/2026-07-24-hetzner-intelligence-plane.md`.

The initial useful loop is deliberately internal and human-approved:

```text
approved docs/code/decisions → cited retrieval → draft plan/ticket/checklist → human review → explicit external action
```

It must not access AGym private user data or automatically merge, deploy, message users, or alter product truth.

---

## 5. Alpha invitation decision

Invite a small technical Android cohort only after the mobile data-ownership gates pass. Call the cohort **agent-connected** only after the direct remote MCP gate also passes. Do not make medical, treatment, prescription, autonomous-coaching, or unsupported privacy claims.
