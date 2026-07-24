# Hetzner Intelligence Plane and Direct Remote MCP Plan

> **For Hermes:** use `subagent-driven-development` task-by-task. Do not deploy, migrate data, enable OAuth/DCR, add an AI provider, or select a harness framework until the applicable pre-flight and revision gates pass.

**Goal:** establish a safe, company-controlled intelligence plane on Hetzner for internal harness workflows and company memory while activating AGym's direct remote MCP path separately, without putting a local Hermes server or Hetzner in the user-agent data path.

**Architecture:** AGym's user data plane remains Supabase + Vercel. Compatible external agents connect directly to the Vercel Streamable HTTP MCP endpoint through Supabase OAuth and AGym's independent action grants. Hetzner is an internal control-plane environment for company operations: repeatable harness runs, policy checks, evaluated company-memory retrieval, and human-approved delivery proposals. It must not proxy user MCP traffic, become an identity broker, or store user fitness data by default.

**Tech stack:** undecided by design. Candidate categories to evaluate later are a small TypeScript/Python worker runtime, a relational metadata store, object storage for approved non-user artifacts, a queue/scheduler, an evaluation runner, and an LLM gateway. No framework, vector database, or model provider is selected in this plan.

---

## 0. Current state and non-goals

### Current state

- Mobile clients authenticate directly with Supabase and use owner-scoped product APIs.
- The direct remote MCP handler is deployed at the AGym Vercel origin, but its real-client OAuth/DCR/PKCE and authorization acceptance proof is pending.
- A local stdio MCP server works as a developer compatibility utility. It is not the target external-user architecture.
- A Hetzner Keycloak host exists from a superseded identity/DCR investigation. It is not in the selected request path.

### Explicit non-goals for this plan

- Deploying any new Hetzner service or changing the existing server.
- Moving Supabase, Vercel, mobile, or remote MCP traffic to Hetzner.
- Building an autonomous coach, autonomous deployment bot, or unsupervised user-data agent.
- Copying AGym raw logs, fitness data, user exports, or OAuth credentials into company memory.
- Selecting a framework or paid provider before workload, data, and evaluation requirements are written down.

## 1. Target boundaries

```text
EXTERNAL PRODUCT PATH — no Hetzner, no local bridge
agent client → Supabase OAuth + consent → Vercel remote MCP → grant/RLS RPC → Supabase
mobile app  → Supabase Auth/RLS → Supabase

INTERNAL COMPANY PATH — Hetzner only
approved docs / repositories / tickets / non-user operational metrics
  → ingestion with provenance and classification
  → company-memory retrieval + harness workflow
  → evidence, evaluation, and proposed action
  → human approval
  → GitHub / issue tracker / deployment workflow
```

### Data classes

| Class | System of record | May enter company memory? | Default retention |
| --- | --- | --- | --- |
| Public product/docs/code | Git + repository docs | Yes, with source URL/commit provenance | Source-controlled lifecycle |
| Internal delivery knowledge | Company-memory store | Yes, if classified internal and access controlled | Explicit review/expiry policy |
| User account/product records | Supabase | No | Product retention/export/delete policy |
| Raw fitness logs and private exports | Supabase/device | No | Product retention/export/delete policy |
| OAuth, refresh, service-role, deployment secrets | Secret manager only | Never | Rotation/revocation policy |
| Harness prompt/output traces | Harness run store | Only redacted internal operational content | Short, explicit retention |

## 2. Gates taxonomy

- **Pre-flight gate:** evidence required before a task starts. Failure means no implementation.
- **Revision gate:** a proposed design/tool choice must be reviewed by the founder before it becomes an implementation task.
- **Escalation gate:** a request to include user data, credentials, production writes, or regulated claims stops the run and requires a separate ADR.
- **Abort gate:** a failed isolation, secret-scanning, or evaluation condition stops deployment and returns the component to design.

## 3. Phase A — inventory and threat model (plan/evidence only)

### Task A1: Produce a Hetzner inventory without exposing secrets

**Objective:** establish what the existing server currently runs and whether Keycloak can be safely retired or isolated from future intelligence-plane work.

**Files:**
- Create: `docs/evidence/YYYY-MM-DD-hetzner-inventory.md`
- Create: `docs/security/hetzner-intelligence-plane-threat-model.md`

**Steps:**
1. Record only non-secret facts: server purpose, OS/version, exposed hostnames/ports, running service names, firewall posture, backup mechanism, patching owner, and SSH access model.
2. Record the existing Keycloak host as legacy research infrastructure; do not alter it during inventory.
3. Classify each discovered service as retain, isolate, migrate later, or retire-candidate.
4. Write attacker goals: administrative takeover, secret exfiltration, cross-tenant access, prompt injection, unsafe automation, and user-data leakage.
5. Define required mitigations before any agent workload: MFA/SSH hardening, service identities, network allowlist, encrypted backups, log redaction, update policy, and incident owner.

**Pre-flight pass:** the inventory identifies every public listener and administrative path; no secret, token, private key, user record, or configuration dump is committed.

### Task A2: Define company-memory objects and provenance

**Objective:** make “company memory” concrete before selecting storage or retrieval tooling.

**Files:**
- Create: `docs/architecture/company-memory-contract.md`
- Create: `docs/evals/company-memory-fixtures/README.md`

**Steps:**
1. Define the minimum record envelope: `id`, `source_kind`, `source_locator`, `source_revision`, `captured_at`, `classification`, `owner`, `content_hash`, `retention_until`, and `supersedes`.
2. Start with only four source kinds: approved ADR/plan, repository file, approved issue/PR decision, and human-authored operational note.
3. Define retrieval output requirements: every answer must return source references, revision/date, confidence/uncertainty, and stale/conflicting-source warnings.
4. Create harmless fixtures covering: a current decision, a superseded decision, conflicting plans, an inaccessible source, and prompt-injected source text.
5. Define deletion/expiry semantics for internal notes and verify that source records can be re-indexed rather than silently overwritten.

**Revision gate:** founder approves the data classification and retention contract before any database, index, embedding model, or crawler is selected.

### Task A3: Write the harness action contract

**Objective:** constrain what an internal agent loop may do.

**Files:**
- Create: `docs/architecture/intelligence-harness-action-contract.md`

**Steps:**
1. Specify allowed initial actions: read approved company memory, summarize evidence, propose plans, create draft tickets/PR descriptions, run allowlisted checks in isolated worktrees, and produce evaluation reports.
2. Specify prohibited actions: direct production writes, secret access, user-data reads, user communications, database migrations, payment/account actions, and self-modifying policies without explicit approval.
3. Define a run record: declared objective, input sources, policy decision, tool calls, artifact paths, result, evaluator result, human approver, and expiration.
4. Require idempotency keys and a dry-run mode for every future side-effecting tool.
5. Define stop conditions for prompt injection, missing provenance, stale sources, scope escalation, or failed evaluation.

**Pre-flight pass:** a reviewer can determine from the contract which actions are allowed without reading code.

## 4. Phase B — direct remote MCP activation proof (product path)

### Task B1: Reconcile remote-MCP documentation and source of truth

**Objective:** make direct remote MCP—not local stdio—the only external/mobile-alpha route.

**Files:**
- Modify: `docs/adr/0003-remote-mcp-phase-b.md`
- Modify: `docs/deploy/remote-mcp-phase-b.md`
- Modify: `mcp/README.md`
- Modify: `docs/mobile/release-checklist.md`

**Steps:**
1. Preserve the local stdio process only as developer compatibility/testing documentation.
2. State that external agents use direct remote MCP through Supabase OAuth and Vercel.
3. Add a release-gate reference requiring an actual remote-client proof before claiming an agent-connected mobile alpha.
4. Keep the current RPC/grant/RLS boundaries unchanged.

### Task B2: Execute the direct remote MCP staging acceptance proof

**Objective:** prove the actual protocol and product authorization boundary, not merely route health.

**Files:**
- Create: `docs/evidence/YYYY-MM-DD-remote-mcp-staging-acceptance.md`
- Modify only if a verified defect is found: focused tests under `mcp/` or `api/`

**Steps:**
1. Use a compatible client’s real remote-connector UI to discover protected-resource metadata and complete DCR + authorization-code + PKCE S256.
2. Use two disposable accounts with disjoint non-sensitive fixture records.
3. Prove `get_context` denied before `read_context` grant, allowed after grant, and denied immediately after revocation.
4. Prove `create_proposed_plan` denied before `write_proposed_plan` grant, then produces only an `agent_written_plan` in `proposed` status after grant.
5. Prove neither client can read the other account and that audit records identify allowed/denied calls without tokens or private payloads.
6. Verify the mobile proposal review path with one resulting proposal.

**Abort gate:** any cross-user read/write, absent grant enforcement, token exposure, or non-proposed plan status blocks alpha activation and requires a security incident review.

## 5. Phase C — harness prototype selection (no production data)

### Task C1: Define three representative internal loops

**Objective:** select tools based on measured workflows rather than agent-framework marketing.

**Files:**
- Create: `docs/evals/intelligence-harness-loop-cases.md`

**Required loops:**
1. **Decision retrieval:** answer “what is the current AGym MCP architecture?” from conflicting docs with citations and a supersession warning.
2. **Delivery preparation:** turn an approved plan into scoped implementation tickets, test gates, and a human-review checklist without making repository changes.
3. **Quality sentinel:** inspect a proposed documentation/code change for source-of-truth conflicts, secret leakage, unsafe data flows, and missing evidence.

**Acceptance criteria:** each case defines inputs, expected cited output, forbidden claims, cost/latency budget, evaluator, and human acceptance condition.

### Task C2: Run a disposable, isolated harness bake-off

**Objective:** compare the smallest viable orchestration/storage candidates against the same fixtures.

**Files:**
- Create: `docs/evidence/YYYY-MM-DD-harness-bake-off.md`
- Create: `docs/evals/harness-scorecard.md`

**Steps:**
1. Evaluate no more than two candidate harness approaches plus a simple scripted baseline.
2. Use only repository/document fixtures; no production user data or production credentials.
3. Score citation precision, stale-decision detection, prompt-injection resistance, reproducibility, human-review burden, latency, cost, and operational complexity.
4. Record raw failures and disqualify any candidate that cannot provide provenance or honor tool policy.
5. Recommend one minimal prototype or explicitly recommend “stay with scripts + human review.”

**Revision gate:** founder approves a named technology stack only after reviewing the scorecard and operational cost.

## 6. Phase D — minimal Hetzner intelligence-plane implementation

### Task D1: Build the control plane before agent autonomy

**Objective:** deploy the smallest internal service that can run a read-only, audited, human-approved loop.

**Files:** exact paths and service topology are deferred until Phase C selects a stack.

**Required capabilities:**
- authenticated operator access;
- per-service identity and least-privilege secrets;
- append-only run metadata and redacted logs;
- provenance-preserving company-memory ingestion;
- read-only retrieval and policy enforcement;
- isolated job execution;
- explicit human approval before any GitHub, ticket, or deployment write.

**Required tests:**
- unauthorized operator denied;
- one source with prompt injection cannot override policy/system instructions;
- deleted/expired note disappears from retrieval;
- secret scanner blocks a fixture containing a credential-shaped value;
- a worker cannot reach Supabase user-data endpoints or production deployment credentials;
- failed job leaves no partial external side effect.

### Task D2: Add one human-approved write loop

**Objective:** prove useful delivery value without autonomous product control.

**Candidate first loop:** read approved company docs → draft a GitHub issue/implementation plan → human reviews → human triggers creation.

**Constraints:** no automatic issue creation, no automatic merge/deploy, every output cites sources, and every run retains an approval record.

**Escalation gate:** any request for autonomous code changes, merges, deployments, user messaging, or product-data access requires a separate ADR and threat-model amendment.

## 7. Operational gates and retirement decision

Before any Hetzner production-like intelligence-plane deployment:

1. Run a restore rehearsal from an encrypted backup.
2. Run a patch/rollback rehearsal.
3. Demonstrate service-account rotation without downtime or secret exposure.
4. Run a hostile-input/prompt-injection test suite.
5. Review retention/deletion behavior for every internal memory class.
6. Assign an owner for incidents, patching, cost review, and model-provider changes.
7. Decide explicitly whether the legacy Hetzner Keycloak staging service is retired, isolated, or retained for unrelated work. It must not share credentials, network trust, databases, or runtime with the intelligence plane until that decision is recorded.

## Definition of done for this planning phase

This planning phase is done when ADR 0004, this plan, the updated remote-MCP/developer documentation, and the mobile release gate agree on the direct product path and separate intelligence plane. No Hetzner service, model provider, company-memory store, OAuth configuration, or user-data integration is deployed by completing these documentation tasks.
