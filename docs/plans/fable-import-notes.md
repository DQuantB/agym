# Fable Output Import Notes

Source folder on the founder machine:

- Windows: `C:\Users\Daniele\AGym\fable-outputs`
- WSL: `/mnt/c/Users/Daniele/AGym/fable-outputs`

Imported mapping:

| Source file | Repo destination |
|---|---|
| `01-product-loop-spec.md` | `docs/product/mvp.md` |
| `02-sample-logs-eval-dataset.md` | `docs/evals/sample-logs.md` |
| `03-json-schemas.md` | `docs/architecture/data-model.md` |
| `04-coach-briefing-v0.md` | `docs/product/coach-briefing.md` |
| `05-mvp-implementation-plan.md` | `docs/plans/mvp-implementation-plan.md` |
| `06-github-issues.md` | `docs/plans/github-issues.md` |

The imported Fable files are **historical/imported planning inputs**, not the current source of truth. Current v0 precedence is governed by `docs/adr/0001-v0-source-of-truth.md`.

For implementation, use in this order:

1. `docs/adr/0001-v0-source-of-truth.md` — precedence rules and hard v0 constraints
2. `docs/plans/mvp-implementation-plan.md` — authoritative v0 plan
3. `docs/architecture/v0-schema-deltas.md` — authoritative amendments (win over the plan)
4. `docs/plans/github-issues.md` — execution breakdown
5. `docs/plans/tickets-03-06.md`, `docs/plans/tickets-09-10.md`, and `docs/plans/tickets-15-16.md` — expanded, authoritative tickets for Issues 3–6, 9–10, and 15–16
6. `docs/evals/parser-fixtures-v0.md` — authoritative parser fixture set (PF-001…PF-025)
7. `docs/briefing/coach-briefing-v0-standard.md` — authoritative Coach Briefing v0 output standard

Reference docs (`docs/product/mvp.md`, `docs/architecture/data-model.md`, `docs/product/coach-briefing.md`, `docs/evals/sample-logs.md`) **lose on any conflict** with the documents above.
