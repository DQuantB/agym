# External Gym Plan Revision Contract

Status: mobile-alpha UI contract; no revision request is persisted or delivered by AGym in this slice.

## Boundary

AGym is not a chat client and does not call an external model from the mobile app. A Gym plan stays an immutable agent-authored `proposed` record until the user accepts it through `accept_gym_workout_plan`. A revision request never mutates that proposal, creates an active plan, or confirms an outcome.

## User-visible handoff

`Ask for changes` prepares text the user may copy and send through their chosen external LLM. It contains:

- the AGym proposal ID (correlation ID);
- the scheduled date;
- one user-provided reason;
- an optional verbatim user note;
- an instruction that any return must be a **new AGym proposal**.

AGym does not claim the external app opened, received the request, or will return a revision.

## Required future return behavior

Before any persisted/deep-link handoff ships, the implementation must prove on iOS and Android that:

1. a request correlation ID and proposal version are retained without exposing other-account data;
2. cancellation or an unavailable external app leaves the original proposal unchanged and still reviewable;
3. an external response cannot update an existing proposal or activate a plan directly;
4. a returned revision is created through the existing authorized proposal-write path as a distinct `proposed` plan;
5. the user reviews and explicitly accepts that new proposal before it can become planned training;
6. any future delivery/audit record contains only bounded metadata, never the full free-text user note unless the user explicitly chooses to store it.

## Current dismissal behavior

`Dismiss for now` closes the review screen without a database mutation. The proposal remains unapplied and visible on the Calendar until a separately authorized archival/dismissal lifecycle is designed and protected by RLS.
