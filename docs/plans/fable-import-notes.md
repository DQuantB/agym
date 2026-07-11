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

The imported Fable files are **historical/imported planning inputs**, not the current source of truth. Current v0 precedence is governed by `docs/adr/0001-v0-source-of