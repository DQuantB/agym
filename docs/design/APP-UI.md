# AGym App UI Design Spec

Status: **v1 — founder-directed product UI system**. Governs the application interface only. Marketing/campaign creative remains governed by `DESIGN.md` (Concept B). This doc was derived from founder-supplied UI inspiration (2026-07-13): dark workout dashboards with hero numerals and folder cards, a brutalist cream/black task app, and a glass plan-vs-outcome run card.

> **Native mobile compatibility:** This document remains the web-v1/current-web visual baseline. Native mobile v2 IA and status behavior live in [MOBILE-UI-v2.md](MOBILE-UI-v2.md). Its dark-first tokens and raw/draft/canonical principles remain reusable; its web top-pill navigation does not prescribe native navigation.

## Relationship to the brand system

The brand (DESIGN.md) is cream / charcoal / electric orange, type-led, editorial. The app inverts it: **dark-first surfaces, cream as the type color, orange as the single accent**. Marketing shouts on cream; the product stays quiet on near-black. Same three colors, opposite polarity — one brand, two volumes.

## Brand attribute anchors

The UI should read as: optimistic over serious, futuristic over classic, supportive over authoritative, trustworthy over unknown, tech-driven but leaning human. In practice: friendly rounded geometry and plain language (supportive, human), precise numerals and mono metadata (tech-driven, trustworthy), no clutter or gamification (futuristic calm).

## Core principle

**The data is the interface.** AGym's product is confirmed events; the UI's job is to make confirmed numbers feel monumental and unconfirmed ones feel visibly provisional. Big numerals are the hero of every screen. Chrome recedes.

Three UI states must always be distinguishable at a glance:

1. **Raw** — user text, untouched. Rendered in mono, muted.
2. **Draft / uncertain** — parsed but unconfirmed. Orange-flagged, dashed or hollow.
3. **Canonical** — confirmed. Solid, bright, typographically heavy.

## Tokens

```css
:root {
  /* Surfaces */
  --bg:            #0B0B0D;  /* app background, near-black */
  --surface-1:     #141417;  /* cards */
  --surface-2:     #1E1E22;  /* nested cards, inputs, hover */
  --surface-3:     #2A2A2F;  /* pressed / active fills */
  --border:        #2A2A2F;  /* hairline borders */
  --border-strong: #3A3A40;

  /* Type */
  --text:          #F4EFE7;  /* brand cream, primary text */
  --text-dim:      #A8A29A;  /* secondary */
  --text-faint:    #6B6660;  /* metadata, placeholders */

  /* Accent — use sparingly */
  --accent:        #FF4B19;  /* electric orange: primary action, uncertainty, live state */
  --accent-soft:   rgba(255, 75, 25, 0.14); /* accent washes */
  --positive:      #E8FF5A;  /* optional: confirmed-delta highlights only */

  /* Geometry */
  --radius-card:   20px;
  --radius-control: 12px;
  --radius-pill:   999px;
  --gap:           12px;
  --pad-card:      16px;
}
```

Rules:

- One accent. Orange means "needs you or is happening now": primary CTA, uncertainty flags, in-progress session. Never decorative.
- No gradients, no glows, no shadows for elevation. Elevation = surface step (`bg → surface-1 → surface-2`) plus hairline border.
- Cream (`--text`) is the only bright value. Pure white is not used.
- The light/cream theme (PLANFORM-style) is a permitted future variant; do not build it until the dark system ships.

## Typography

Two roles, same as the brand doc:

- **Display / numerals:** the utility sans at heavy weight and large size. Numbers use `font-variant-numeric: tabular-nums`. No serif in the product UI — the editorial serif belongs to marketing.
- **Utility:** Inter (current) for everything else.
- **Mono:** `ui-monospace` for raw log text, JSON, parser metadata, timestamps, and log tokens (`SET 04`, `3 × 5`). Mono signals "machine-touched, verify me."

Scale:

| Role | Size / weight | Use |
| --- | --- | --- |
| Hero numeral | clamp(2.5rem, 8vw, 4rem) / 800 | one per card max: bodyweight, timer, count |
| Screen title | 2rem / 700 | tab headline ("Log", "Timeline") |
| Card title | 1.05rem / 600 | event kind, section names |
| Body | 0.95rem / 400 | copy, descriptions |
| Meta | 0.78rem / 500, mono or caps + letterspacing | dates, units, flags, parser version |

Units are always smaller and dimmer than their number (`190` big cream, `lbs`/`kg` meta-dim beside it).

## Components

### Cards

Rounded 20px, `--surface-1`, 1px `--border`, no shadow. Variants:

- **Event card (canonical):** kind label top-left in caps-meta, hero value if the payload has one, date/time bottom in mono meta. Solid border.
- **Draft card:** same layout, **dashed 1px `--accent` border** and an orange uncertainty badge count. Nothing dashed is stored.
- **Stat card:** hero numeral + unit + "31 min ago"-style relative meta. Max one per row on mobile-width.
- **Folder/plan card (future plan-intake):** the folder-tab silhouette from ref 1 is reserved for *plans* — an agent-written plan is a folder containing prescribed items; its item count sits in a thin progress ring.

### Buttons

- **Primary:** `--accent` fill, near-black text, `--radius-control`, weight 700. One per view.
- **Secondary/ghost:** `--surface-2` fill, cream text, hairline border.
- **Danger:** hollow, `--accent` border and text (destructive = deliberate, not loud).
- Icon buttons are 40px circles on `--surface-2` (ref 1's `+` / filter buttons).

### Inputs

`--surface-2` fill, hairline border, `--radius-control`, cream text, `--text-faint` placeholder. Focus: 1px `--accent` border, no glow. The log textarea is the app's front door — generous (≥180px), mono, placeholder shows a real messy example log.

### Navigation

Bottom-feel tab bar rendered as a top pill row for the web MVP: pill buttons on `--surface-1`, active = `--surface-3` fill with cream text (not orange — orange is not a "selected" color). Tabs: Log · Timeline · Briefing · Data.

### Status / toast

Slim bar, `--surface-2`, orange left rule, mono text. Auto-dismiss; never modal.

### Data visual language (Timeline & future stats)

- **Dot-grid calendar** (ref 3) is the canonical density visual: one dot per day, lit cream when events exist, orange when a pain event exists. No line charts in v1.
- **Progress rings** are reserved for plan adherence (prescribed vs done) — not streaks. AGym never guilt-trips.
- Deltas print as text (`Δ −0.4 kg`), tabular mono, `--positive` only when user-relevant.

### Briefing view

The briefing is a document, not a dashboard: render the markdown on `--surface-1` in a readable measure (~70ch), cream on dark, mono for quoted user text. Copy/download buttons are secondary style.

## Screen guidance (current MVP tabs)

- **Log:** title, textarea, single orange "Parse" primary. Draft previews appear below as dashed cards with per-field confirm; "Confirm all" is primary once drafts exist, "Discard" ghost.
- **Timeline:** dot-grid month header, then canonical event cards newest-first, grouped by date with mono date rules.
- **Briefing:** date range controls (ghost pills), document panel, Copy / Download secondary buttons.
- **Data:** the trust screen. Plain sentences about what's stored and where, export button, and typed-confirmation delete. This screen may use the most words in the app; keep them human.

## Voice in the UI

Short, factual, non-coaching. "Parsed 3 draft events. Review before confirming." — never "Great job!" No streaks, badges, or motivational copy. The supportive attribute comes from respecting the user's control, not cheerleading.

## Guardrails (inherited)

No medical claims or advice framing anywhere in UI copy. No fake data in empty states — empty states say what will appear and how to get it. No third-party brand mimicry; the refs inform structure, not skins.

## Non-goals for v1

Light theme, animations beyond 150ms ease fades, charts, avatars/social, onboarding tours, custom icon set (use minimal inline SVG or text glyphs).
