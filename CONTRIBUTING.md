# Contributing to AGym

AGym is built through small, reviewable, issue-linked changes.

## Branch naming

Use one branch per issue:

```text
issue/<issue-number>-<short-slug>
```

Examples:

- `issue/3-scaffold-vite-react-ts`
- `issue/6-domain-schemas`

If a change intentionally covers more than one small documentation issue, name both in the PR body and keep the diff narrow.

## Commit style

Use concise conventional-style commits:

- `docs: ...`
- `chore: ...`
- `feat: ...`
- `test: ...`
- `fix: ...`

Prefer one focused commit per issue-sized change.

## Definition of done

A PR is done only when:

- it links the GitHub issue it addresses;
- scope matches the issue and clearly states out-of-scope items;
- relevant docs are updated;
- relevant checks have been run and pasted into the PR;
- the diff contains no secrets;
- product/privacy/no-medical-claims constraints are preserved;
- lint, typecheck, tests, and build are green when those commands exist.

## Dependency policy

Do not add new runtime or development dependencies unless the issue explicitly allows them or a maintainer approves in the issue/PR.

When adding a dependency, explain:

- why it is needed;
- why a simpler local implementation is not enough;
- whether it affects privacy, bundle size, or future portability.

## Domain logic rule

Domain logic belongs in pure functions outside React components.

React components should orchestrate UI and call domain/store functions. They should not contain parsing rules, storage rules, Coach Briefing math, privacy rules, or schema definitions.

Expected locations:

- `src/domain/` for schemas, types, IDs, and business invariants;
- `src/parser/` for parsing contracts and parser implementations;
- `src/storage/` for persistence adapters;
- `src/briefing/` for Coach Briefing generation;
- `src/state/` for application state wiring;
- `src/components/` for UI.

## Label definitions

Type labels:

- `type:docs` — documentation-only or documentation-led work.
- `type:infra` — build, tooling, CI, repository infrastructure.
- `type:feature` — user-facing or product feature work.
- `type:test` — testing, fixtures, evaluation, QA.

Area labels:

- `area:domain` — schemas, types, business rules.
- `area:storage` — persistence, adapters, export/delete behavior.
- `area:parser` — raw-log parsing.
- `area:state` — app store and state wiring.
- `area:ui` — React UI and interaction flows.
- `area:briefing` — Coach Briefing generation and UI.
- `area:privacy` — privacy, export, deletion, no-medical-claims behavior.

Size labels:

- `size:S` — small issue.
- `size:M` — medium issue.

Milestone label:

- `mvp` — required for the first useful MVP.

## Out-of-scope defaults

Unless an issue explicitly says otherwise, do not add:

- backend/auth;
- deployment;
- paid APIs;
- analytics/tracking;
- wearable integrations;
- medical claims;
- recommendation/coaching behavior;
- CSS frameworks or routers;
- broad refactors unrelated to the issue.
