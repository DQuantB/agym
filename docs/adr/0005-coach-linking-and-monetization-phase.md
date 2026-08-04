# ADR 0005 — Coach Linking, Coach Dashboard, and Monetization Supersede the Multi-User/Payments Non-Goal

Status: accepted
Date: 2026-08-04
Supersedes: ADR 0002's non-goal on "multi-user sharing, trainer dashboard, payments" only. Public launch remains a non-goal. Overrides the Gate 0 validation step and the consent/scope-based sharing architecture proposed in `docs/plans/2026-07-23-trainer-dashboard.md` (see Relationship to the prior trainer-dashboard plan, below).

## Decision

AGym now builds toward a coach-facing product surface and a revenue mechanism, ahead of the founder-run coach validation interviews that the prior plan and the coach-first marketing pivot (`docs/agents/marketing-agent.md`, merged 2026-08-02) both treated as a precondition. This is a conscious founder decision made in-session on 2026-08-04, trading validation-first sequencing for development speed, not a discovery that validation is unnecessary.

Scope now includes:

1. **Coach–client linking via a redeemable code**, not the consent/scope-grant model in the 2026-07-23 plan. A coach (or the founder, on a coach's behalf) generates a code; a client redeems it from the mobile app's Data/Settings screen to create a link.
2. **A `requires_payment` flag on each code**, defaulting to `false`. This is the entire seam between the linking mechanism and monetization: redemption logic checks the flag and, when true, requires a successful charge before the link is created. No payment processor is wired in yet — the flag exists so the linking mechanism does not need to change shape when one is chosen.
3. **A coach dashboard as a web page** in the existing Vite/React app (not the native mobile app), reusing existing Supabase auth. A coach account is an existing AGym account with a coach flag/profile, not a separate identity system.
4. **Revenue model is explicitly undecided.** Functionality ships ahead of the pricing/revenue-share decision by design (founder's stated sequencing: build the mechanism, decide monetization after).

## Relationship to the prior trainer-dashboard plan

`docs/plans/2026-07-23-trainer-dashboard.md` remains a valid reference for a more privacy-conservative design (per-scope consent, revocable grants, audit log, no raw health data ever exposed) and is not deleted. It is superseded for the current build:

- Its Gate 0 (show de-identified sample briefings to 5-10 real coaches before writing schema/UI) was not run. This ADR is the founder's explicit override of that gate, not evidence it was satisfied.
- Its invitation/consent/scope data model was not adopted. The current mechanism is a simpler redeemable code with no per-scope consent and no audit log in the first cut.
- If real coach usage later surfaces the privacy/trust problems that plan was designed to prevent (a coach seeing more than a client expected, no way to audit what a coach read, no clean revocation story), that plan's RLS/consent/audit design is the intended fallback rather than something to redesign from scratch.

## What a coach can access (first cut)

A linked coach may read the same kind of data the product already exposes to the client themselves via the Coach Briefing concept (confirmed outcomes, accepted-plan history) — not raw, unconfirmed logs or parse drafts. This mirrors the "Preserve raw user input; do not turn uncertainty into fact" and provenance non-negotiables already in `CLAUDE.md`; it is a deliberate limit even though full per-scope consent was not implemented.

## Non-goals still in force

- Public launch, self-serve coach signup, and an open coach marketplace remain out of scope for this phase. A coach account is provisioned by the founder.
- A real payment processor integration is not part of this phase; `requires_payment` is a schema seam, not a working checkout.
- Trainer-authored plan writes, medical/clinical claims, and automated recommendations remain non-goals per ADR 0002 and `CLAUDE.md`'s non-negotiables — a coach dashboard is a read surface, not a plan-writing surface, in this phase.

## Required follow-up

Update `CLAUDE.md` and `README.md` non-goal lists to point here instead of silently contradicting current work (done alongside this ADR). Future coach/payment work should reference this ADR rather than re-litigating the override.
