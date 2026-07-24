# AGym Mobile UI v2 Product Contract

Status: founder-directed mobile-alpha interaction contract. This document governs the native mobile information architecture and trust/status behavior. `APP-UI.md` remains the visual-system baseline for the current web app.

## Product boundary

AGym is the user-owned record and review layer between real training and an external LLM. It is not an in-app AI coach or chat client.

```text
external LLM proposes a plan → user reviews/accepts → user performs and logs actual training
→ user confirms outcome → AGym stores linked evidence/context → authorized LLM reads it
```

- Agent plans are proposals, never user-confirmed outcomes.
- A plan is immutable; actual performance is a separate user-owned execution.
- Raw notes remain verbatim evidence. A later user confirmation never overwrites raw evidence.
- No medical diagnosis, treatment, injury advice, or unsupported health claim is shown.
- A connected model may read or write only within explicit, user-revocable scopes.

## Native four-tab IA

| Tab | Job | First mobile-alpha content |
| --- | --- | --- |
| Today | Make the current next action unmistakable. | One workout-state hero plus a non-blocking proposal banner. |
| Calendar | Separate future intent from unapplied agent changes. | Date agenda/week strip; active scheduled Gym workout; proposal card/review entry. |
| Log | Show confirmed reality and its evidence. | Confirmed session list and session detail with linked plan, actuals, and raw note. |
| Data | Make ownership and model permissions legible. | Current model scopes, revocation entry, export/delete entry points, and only audit facts AGym can actually retrieve. |

No fifth Capture tab is introduced in this scope. Text capture is a contextual action from Today or Log when that feature is separately authorized.

## Today state model

Today has one hero card for the current workout state. All hero states are exclusive except `Proposal waiting`, which may stack as a banner above the hero. An in-progress/draft indication persists across tabs.

| State | Hero treatment | Primary action | Required copy/behavior |
| --- | --- | --- | --- |
| No session | Neutral rest-day/no-session card | None | Secondary `Log unplanned workout`; do not fabricate a workout. |
| Proposal waiting | `✧ Agent proposal` banner above another hero | `Review` | `Nothing applied yet`; a proposal is never a startable session. |
| Ready | Planned session card | `Start workout` | `◇ Planned`; only an accepted, active Gym plan reaches this state. |
| In progress | Active execution card with elapsed time | `Resume` | Shows actual logging progress and durable-save status. |
| Local draft | Draft-recovery card | `Finish & confirm` | Explicitly says the draft is saved locally, not yet a confirmed session. |
| Confirmed | Confirmed completion card | None | `✓ Confirmed · time`; secondary `View in Log`; never restart/completion CTA. |
| Sync failed | Warning card | `Retry sync` | State exactly whether data is saved locally and that an LLM cannot read it until sync succeeds. |

## Semantic status vocabulary

Every status uses label text, a recognizable icon, and stable placement; color reinforces but never supplies the only meaning.

| State | Required label | Visual role | Meaning and allowed action |
| --- | --- | --- | --- |
| Planned | `◇ Planned` | neutral outline/metadata | A user-accepted future baseline. It can be started on its scheduled day. |
| Agent proposal | `✧ Agent proposal · source · time` | orange pending-decision card/banner | Agent-authored candidate. Review or dismiss; no silent application. |
| User confirmed | `✓ User confirmed · time` | positive/confirmed card metadata | User-confirmed actual outcome. View evidence; a later correction must be a visible revision, not hidden overwrite. |
| Imported | `↓ Imported · source · unreviewed` | neutral/import metadata | External record, not user-confirmed fact. Import review is deferred. |
| Observation | `≈ Observation` | dashed/evidence-linked treatment | Non-medical derived correlation; inspect evidence or show insufficient data. |
| Local sync | `Saved locally`, `Syncing`, or `Sync failed — retry` | explicit text status | Durability/readability state; only retry when an outbox exists. |

Orange means pending user decision or live/in-progress work. Positive green is limited to a confirmed/successful state. Gold/warning is limited to sync/attention states. Screen-reader labels must include the text state, not only the color or icon.

## Planned versus actual training

1. An MCP-created Gym plan begins as `proposed`; it is visible for review only.
2. Only a user-controlled acceptance transition to `active` makes the plan a `◇ Planned` baseline and permits `Start workout`.
3. Starting creates or resumes a separate `workout_executions` record with an immutable `planned_snapshot` and editable actual data.
4. Changed loads/reps, user-added sets, skipped/substituted exercises, duration, and notes belong to the actual execution. Notes remain verbatim self-report.
5. `Confirm session` uses the existing protected completion boundary to create linked raw evidence and a `user_confirmed` outcome. It never updates the plan.
6. A completed execution is immutable in the normal UI. Any future correction must create visible revision history; revision UI is not in this first slice.

## v2 board mapped to the mobile alpha

The first proposal type is exactly **one structured Gym workout on one scheduled date**. The v2 board illustrates broader future behavior; it is not authorization to build it all now.

| Illustrated behavior | Mobile-alpha decision |
| --- | --- |
| Today state cards and planned-versus-actual execution | Included. |
| One Gym proposal review, accept, or dismiss | Included. |
| Four tabs: Today, Calendar, Log, Data | Included. |
| Confirmed-session history/evidence detail | Included. |
| Current model scope/revoke/export/delete entries | Included only where backed by real owner-scoped APIs. |
| Multi-week blocks, per-session selection, load deltas, 30-day rollback | Deferred. |
| Strava, Apple Health, Cronometer, and import review | Deferred. |
| Voice capture/transcription | Deferred pending device/privacy/cost spike. |
| Sleep, fueling, injury, or other derived health observations | Deferred until evidence/data-window contracts exist. |
| External self-serve remote MCP/OAuth connection | Planned direct product path; activation remains blocked on the real-client OAuth/DCR/PKCE, two-account, grant/revocation, and audit proof in `docs/deploy/remote-mcp-phase-b.md`. The phone never runs a local MCP bridge. |

## No in-app chat

`Ask for changes` is not a chat surface. AGym can prepare a structured reason plus an optional verbatim note for the user to copy/send to their external LLM. It must say what is shared, retain no hidden conversation, and never allow an external response to mutate AGym directly. A deep-link/open-model return flow is not claimed until it is proven on iOS and Android with proposal correlation, cancellation, and revised-proposal review.

## Accessibility and gym-floor requirements

- Interactive targets are at least 44×44 points.
- Support Dynamic Type without truncating provenance, warnings, or primary actions.
- Test text/icon contrast on near-black surfaces; do not bury safety, provenance, or consent copy in tiny low-contrast mono text.
- Give every icon-only control and every semantic state an accessible label.
- Never encode planned/confirmed/proposal/sync status through color alone.
- Support one-handed use and fast numeric entry under gym conditions; one obvious primary action per Today state.
- Show local-save and sync state explicitly. Network loss must not silently discard a set or note.
