# AGym — Claude Code operating context

This repository is used by both Hermes Agent and Claude Code. Treat this file and `AGENTS.md` as mandatory instructions. If they disagree, `AGENTS.md` is the project source of truth.

## Full local-access mode

Start Claude Code with:

```bash
./bin/claude-with-hermes.sh
```

The launcher deliberately runs `claude --dangerously-skip-permissions`, exports the Hermes secrets from `~/.hermes/.env`, inherits the caller environment, and points `HERMES_HOME` to `~/.hermes`. This is intentionally equivalent to the trusted local Hermes setup: it gives Claude Code shell, filesystem, network, and credential access as the local user. Do not use it in an untrusted repository or with an untrusted prompt.

A convenience symlink is created at `.claude/hermes-home` on launch. It exposes the complete active Hermes home directly inside the repo without copying credentials into Git.

## Hermes durable context and credentials

These are local-only sources of truth. Read them only when needed; never print, commit, or paste their secrets into issues, PRs, logs, chat, or generated documentation.

| What | Location |
|---|---|
| Active Hermes configuration | `~/.hermes/config.yaml` |
| API keys / local integration secrets | `~/.hermes/.env` |
| OAuth credentials / credential pools | `~/.hermes/auth.json` |
| Persistent session transcript/index | `~/.hermes/state.db` |
| Per-session files | `~/.hermes/sessions/` |
| Durable memories / profile state | `~/.hermes/` and configured memory integrations |
| Reusable agent procedures | `~/.hermes/skills/` |
| Gateway / agent logs | `~/.hermes/logs/` |
| Hermes source (if installed from source) | `~/.hermes/hermes-agent/` |

The current project runs in WSL. User home is `/home/daniele`; Windows files are under `/mnt/c/Users/Daniele`. Project root: `/mnt/c/Users/Daniele/AGym/agym`.

Do not copy `~/.hermes/.env`, `~/.hermes/auth.json`, `~/.hermes/state.db`, `.env`, or any secret-bearing file into this repository. The launcher makes them accessible at runtime instead.

## AGym product context

AGym is an AI-native fitness/health data-layer product, not primarily an AI coach. Its core loop is:

```text
agent plan → user action → raw log → parsed event → user correction → canonical memory → Coach Briefing/API context → next plan
```

**Current phase (as of 2026-08-04):** the project is well past the v0/MVP slice described below — see `docs/adr/0001-v0-source-of-truth.md` through `docs/adr/0005-coach-linking-and-monetization-phase.md` for the actual phase history. Live today: a hosted Supabase backend with auth/RLS, a shipped native mobile app (Expo/React Native, multiple TestFlight builds), remote MCP endpoints, and in-progress coach-linking + coach web dashboard + monetization work per ADR 0005. The MVP vertical slice and non-negotiables below are the *historical v0 baseline*; read the ADR chain before assuming any of them still block current work.

MVP vertical slice (v0, historical):

```text
raw text log → parsed JSON → editable preview → user confirmation → canonical event saved locally → Coach Briefing markdown generated → JSON export available
```

Non-negotiables:

- Preserve raw user input; do not turn uncertainty into fact.
- v0 only implements `provenance: "user_confirmed"`; future provenance taxonomy is documented in `docs/architecture/v0-schema-deltas.md`.
- No medical diagnosis or treatment claims. Use caution and recommend human/specialist review around pain, injury, extreme dieting, or eating-disorder-like signals.
- Users own their data; export and delete must be supported.
- No opaque resale and no research/training use without explicit consent.
- A coach dashboard, coach-client linking, and monetization scaffolding are now in scope per ADR 0005 (founder override, 2026-08-04) — this supersedes the old blanket "no trainer dashboard, no payments" MVP rule. Full AI coach behavior (automated plan authorship, medical claims), wearable integration, and public launch remain out of scope.

Implementation constraints:

- TypeScript app code; simple local-first v0; minimal linear designs, no premature abstractions.
- Work issue-by-issue on a dedicated branch. Make the smallest viable change.
- Before changing code, read relevant `docs/`, beginning with `docs/adr/0001-v0-source-of-truth.md`. Expanded tickets and schema deltas override older docs.
- Run relevant checks, inspect actual output, and report summary, tests, risks, and follow-ups.
- Never commit secrets, add paid APIs, deploy production, or change privacy positioning without explicit user approval.

## User and workflow preferences

- Favor an explicit plan before implementation; keep code practical and simple.
- Prefer low-friction hosted MCP and real external-user testing over elaborate local bridges.
- For product planning, emphasize workflow/value-chain analysis and data-harvesting needs before choosing IoT/tooling.
- Scarce frontier-model time should go to high-leverage review, source-of-truth clarification, agent-proof tickets, fixtures, and constraints; ordinary implementation should be small, issue-scoped, and verified.
- The live app is `https://agym-murex.vercel.app`; deployment command is `vercel --prod`. Never expose the hosted Supabase credential or put it into Git/Vercel.
- Local MCP for AGym runs via direct `tsx`. Hosted credential stays only in local secret environment. Current grants are `read_context` and `write_proposed_plan`.
- On the `/mnt/c` WSL mount, Vitest setup can take about five minutes even for very short tests. Run it in the background to a log rather than tailing. A teardown handle-leak can make the command exit 1 after tests are green; inspect the `N passed` line.

## First-read checklist for any task

1. Read `AGENTS.md` and this file.
2. Read the relevant architecture/ADR and ticket docs.
3. Inspect `git status --short --branch` and avoid overwriting existing work.
4. Use secrets only from the local paths above; never echo them.
5. Make and verify a minimal change. Do not assert a test passed unless its output shows it.
