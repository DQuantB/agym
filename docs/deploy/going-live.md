# AGym alpha — going live (deploy runbook)

Plain-language, step-by-step guide to putting the invite-only alpha online and
running the full agent loop against the hosted database. Follow top to bottom.

## Mental model (read this first)

Two pieces live in **different places**:

- **Web app** → deployed to **Vercel**. It only ever holds the *publishable*
  Supabase key, which is safe to expose in a browser. This is what you open on
  your phone.
- **MCP server** (`mcp/agym-server.ts`) → **stays on your local machine**, next
  to Hermes. It talks to the hosted database with the *secret service-role* key.
  It is **never** deployed to Vercel and its key **never** goes into Git or the
  web app.

Both read/write the same hosted Supabase Postgres, protected by RLS.

```
 phone browser ──(publishable key)──┐
                                     ├──▶ hosted Supabase (Auth + Postgres + RLS)
 Hermes + local MCP ─(service key)──┘
```

---

## Step 1 — Deploy the web app to Vercel

Prereqs: a Vercel account (free tier is fine), GitHub repo `DQuantB/agym`.

**Dashboard route (recommended for a first deploy):**
1. Go to vercel.com → **Add New… → Project** → import `DQuantB/agym`.
2. Vercel auto-detects Vite. `vercel.json` in the repo already sets the build
   command (`npm run build`), output dir (`dist`), and the SPA rewrite. Leave
   the defaults.
3. Under **Environment Variables**, add (these are the *public* values from
   Supabase → Project Settings → API):
   - `VITE_SUPABASE_URL` = `https://<project-ref>.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = the **anon / publishable** key
   > Do NOT add the service-role/secret key here. It has no place in the web app.
4. **Deploy**. You'll get a URL like `https://agym-xxxx.vercel.app`.

**CLI route (alternative):** `npm i -g vercel` → `vercel login` → `vercel` (link
project) → add env vars with `vercel env add VITE_SUPABASE_URL` etc. →
`vercel --prod`.

**Why the SPA rewrite matters:** the magic-link email sends the user back to a
URL like `/#access_token=…`. Without the catch-all rewrite to `/`, a page
refresh on any route would 404. `vercel.json` handles this.

---

## Step 2 — Configure hosted Supabase Auth (invite-only)

In the Supabase dashboard for the `agym-alpha` project:

1. **Authentication → Providers → Email**: enable Email; the app uses magic
   links (OTP), so a password isn't required.
2. **Authentication → Sign in / Providers → disable "Allow new users to sign
   up"** (public signup OFF). This is the invite-only guardrail — without it,
   anyone with the link could self-register.
3. **Authentication → URL Configuration**:
   - **Site URL** = your Vercel production URL.
   - **Redirect URLs** = add both the Vercel URL and (optionally) a local dev
     URL `http://localhost:5173` so you can test locally too. The app requests
     `emailRedirectTo: window.location.origin`, so the current origin must be on
     this allowlist or the link is rejected.
4. **Add yourself as tester #1**: Authentication → Users → **Add user → Send
   invitation** to your email. (With signup disabled, this admin invite is the
   only way in.)

---

## Step 3 — Prove export + delete BEFORE logging real data (non-negotiable)

Product constraint #8: users own their data; export and delete must work. Do
this on your test account while it's still empty-ish:

1. Sign in on the deployed app.
2. Log one throwaway entry, confirm it.
3. Go to the **Data** tab → run **Export** → confirm you get a JSON file with
   your raw logs + events.
4. Verify **deletion**: account-wide delete is a deliberate, audited workflow
   (not a browser one-click yet). Confirm the intended path works — see
   `docs/architecture/networked-alpha-schema.md` and the RLS rules. If a
   self-serve delete button isn't wired in the UI yet, that's the first Phase 5
   task to add before real testers.

> If export or delete can't be demonstrated, STOP and fix it before inviting
> anyone or logging real workouts.

---

## Step 4 — Wire the local MCP server to hosted Supabase

On your machine (where Hermes runs):

1. Get the **service-role/secret key**: Supabase dashboard → Project Settings →
   API → `service_role` secret. Treat it like a password.
2. Add the AGym server to your Hermes MCP config (see `mcp/README.md` for the
   exact shape). Point it at the **hosted** URL, not localhost:
   ```yaml
   mcp_servers:
     agym:
       command: npm
       args: ["run", "mcp"]
       env:
         AGYM_SUPABASE_URL: "https://<project-ref>.supabase.co"
         AGYM_SUPABASE_SERVICE_ROLE_KEY: "<service-role secret>"
         AGYM_USER_ID: "<your auth user UUID from Supabase → Auth → Users>"
         AGYM_AGENT_IDENTIFIER: "hermes"
   ```
3. Create your authorizations (the agent can't grant itself — you do it as the
   user). In Supabase SQL editor, insert two rows into `agent_authorizations`
   for your `user_id`: one `read_context`, one `write_proposed_plan`.
4. Restart Hermes; confirm it discovers `mcp_agym_get_context` (+ list_plans,
   create_proposed_plan).

---

## Step 4b — Push new migrations to hosted (Gym workout execution)

Only do this after every local check in
`docs/architecture/networked-alpha-verification.md` is green — local
`supabase db reset --local`, the RLS/account-deletion/gym-workout-execution
SQL suites, `mcp:smoke`/`mcp:e2e`, lint, typecheck, `test:run`, and `build`.
Do not push migrations against a hypothesis; push them after they've already
proven themselves locally.

1. Link the CLI to the hosted project if you haven't already:
   `supabase link --project-ref <project-ref>`.
2. Apply the pending migrations (currently through
   `20260714131000_schedule_mcp_gym_plans.sql`): `supabase db push`.
3. Confirm parity between what's local and what's hosted:
   `supabase migration list --linked` — the local and remote migration lists
   must match exactly through the latest timestamp. If they don't, stop and
   reconcile before continuing; do not force-push a mismatch.

## Step 5 — The live founder-proof loop

1. On your phone: log a real workout in plain text → confirm the parsed event.
2. Ask Hermes to read your AGym context → it calls `get_context` → sees your
   confirmed event + raw note (labelled, uncertain-preserving).
3. Ask Hermes to propose next session → it calls `create_proposed_plan`.
4. Refresh the app's **Plans** tab → the agent's proposal appears, clearly
   marked as a proposal (not a confirmed outcome).
5. Check `agent_audit_log` in Supabase — every read/write is recorded.

That loop is the product working end to end with real data. 🎯

### Steps 6–9 — The Gym workout execution loop

Do this after Step 4b has applied the Gym migrations to hosted.

6. Ask Hermes to create a **structured** Gym plan for today via
   `create_proposed_plan` with a `gym_workout` `plan_data` payload (see the
   product contract in `docs/plans/2026-07-14-gym-workout-execution.md`) —
   not a free-text plan.
7. Open the app's **Workout** tab (now the first/default tab). The proposal
   should auto-appear for today's date, labelled **Agent proposal**, with an
   editable baseline pre-filled from the plan. If nothing appears, confirm the
   plan's `scheduled_for` is today and that its `plan_data.kind` is exactly
   `gym_workout`.
8. Edit actual values (reps/weight), add an exercise, complete a set to
   trigger the rest timer for its planned `rest_seconds`, and add a note in
   **Additional notes**. Click **Finish workout**.
9. Verify in Supabase:
   - `workout_executions` for that plan now has `status = 'completed'` and a
     `completed_at` timestamp;
   - a new `raw_logs` row exists with `source_hint = 'workout'`, holding the
     immutable execution transcript;
   - a new `canonical_events` row exists with `event_type = 'workout_execution'`,
     `provenance = 'user_confirmed'`, and `plan_id` linking back to the agent's
     original proposal;
   - `agent_audit_log` recorded the `create_proposed_plan` call from step 6.

---

## Safety recap

- Publishable key → web app / Vercel. Service-role key → local machine only.
- Never commit either the service-role key or a filled-in `.env.local`.
- Invite-only stays ON (public signup disabled) for the whole alpha.
- No real logs until export + delete are demonstrated (Step 3).
