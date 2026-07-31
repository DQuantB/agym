# AGym Social Visual Prompts v1

Status: created 2026-07-18. Prompt library for generating post/ad/profile visuals across Instagram, X, Reddit, and the landing page, under the approved Concept B system (`brand-system.md` v3, `docs/design/DESIGN.md`).

## How to use (non-negotiable rules from the brand system)

1. **Generated imagery = background/object layer only.** Never let the image model render readable text, logos, UI, or CTAs — all typography, training-log tokens, the `RAW > REVIEWED > READY` mechanism line, branding, and disclosures are composed deterministically afterward (Figma, the Python renderer pattern in `assets/meta-ads-v3/`, or equivalent). Each prompt below therefore has two parts: **[IMAGE PROMPT]** and **[OVERLAY SPEC]**.
2. Every finished asset needs **≥ 2 training anchors** from: plain-language training cue, compact training-log token (e.g. `SET 04 / 3 x 5 / ACTUAL`), non-branded movement/exertion cue, training-specific raw→confirmed progression.
3. The **fragmented → confirmed transformation** must stay visible in the composition.
4. Palettes only: **primary** cream `#F4EFE7` / charcoal `#1A1817` / electric orange `#FF4B19`; **secondary (variation only)** deep teal `#123C42` / shell `#F1E7D7` / coral `#F07C73`. One asset, one palette.
5. Naming: `agym-<channel>-<concept>-v<version>-<state>.<ext>`. New assets start as `draft`.
6. Internal review before anything is published; publishing needs founder approval.

## Universal negative prompt (append to every image prompt)

```text
No readable text, no letters, no numbers, no words, no logos, no watermarks, no user interface, no dashboards, no cards, no arrows, no anime, no manga, no comic style, no cartoon, no stock-photo realism, no staged gym photography, no influencer physiques, no before/after bodies, no doctors, no anatomy, no medical imagery, no robots, no AI trainer characters, no ripped paper, no collage of photos, no glassmorphism.
```

---

## A. Instagram feed — content pillar posts

### A1 — Pillar "The pain" (1:1, primary palette)

**[IMAGE PROMPT]**
```text
Editorial performance poster background, flat cream #F4EFE7 field. A dense cloud of small fragmented charcoal #1A1817 marks — broken dashes, scattered tally strokes, torn stroke fragments — drifts from the upper left, chaotic and irregular like shredded handwriting rhythm, without any readable characters. Moving toward the lower right, the fragments progressively align into a single precise orderly grid of electric orange #FF4B19 rectangular blocks with sharp registration-mark corners. High contrast, grainy risograph print texture, subtle halftone. Strong diagonal tension suggesting acceleration and effort. Minimalist, brutalist editorial layout with generous negative space reserved in the top third. Flat graphic design, screen-print aesthetic, no photography.
```
**[OVERLAY SPEC]** Headline (oversized, cropped display sans, charcoal): `STOP RE-EXPLAINING YOUR TRAINING TO AI.` Support line (utility sans, small): `Every chat starts from zero. Your training history shouldn't.` Training anchors: token `RAW TRAINING LOG — SESSION 12` near the fragment cloud; token `SET 04 / 3 x 5 / CONFIRMED` near the orange grid. Mechanism line bottom edge: `RAW > REVIEWED > READY`. Small `AGYM` wordmark.

### A2 — Pillar "Dogfood log" (4:5, primary palette)

**[IMAGE PROMPT]**
```text
Tall editorial poster background, cream #F4EFE7 base. Left half: an abstract exertion trace — a jagged charcoal line like a barbell velocity graph or interval effort curve, hand-drawn energy, breaking apart into loose fragments and stray marks. Right half: the same trace re-drawn as a clean continuous electric orange #FF4B19 line with precise tick marks and measured rhythm. A thin vertical charcoal rule divides the halves like a fold line. Grain and slight print misregistration. Athletic kinetic energy through line speed and repetition, not through human figures. Flat screen-print graphic style, large empty margins top and bottom.
```
**[OVERLAY SPEC]** Headline: `TRAINING HAPPENED. NOW MAKE IT USABLE.` Left label token: `RAW / what I scribbled after the session`. Right label token: `REVIEWED / what my AI gets next time`. Founder caption (in post text, not image) tells the real dogfooding story. Mechanism line: `RAW > REVIEWED > READY`.

### A3 — Pillar "Data ownership" (1:1, secondary night-field palette)

**[IMAGE PROMPT]**
```text
Editorial poster background, deep teal #123C42 night field. Center: a solid shell #F1E7D7 irregular organic shape like a compacted mass, its edges dissolving on one side into scattered drifting particles, and on the opposite side hardening into a precise geometric faceted edge outlined with thin coral #F07C73 contour lines and registration marks. Feels like raw material being claimed and given exact shape. Subtle film grain, deep matte shadows, restrained abstract energy. No figures, no objects, no text. Flat graphic poster style with strong single focal point and wide margins.
```
**[OVERLAY SPEC]** Headline: `YOUR TRAINING DATA SHOULD OUTLIVE THE CHAT.` Support: `Local-first. Yours to export. Yours to delete.` Anchors: token `TRAINING LOG / OWNED BY YOU`; token `SESSION 18 > EXPORTED`. Mechanism line in coral. Disclosure footer if used as ad.

### A4 — Pillar "Build in public" (4:5, primary palette)

**[IMAGE PROMPT]**
```text
Poster background, cream #F4EFE7. A field of repeated thin charcoal horizontal rules like a technical notebook grid, interrupted mid-page: several rules bend, fracture and scatter into short fragments around an off-center zone, and inside that zone a bold electric orange #FF4B19 rectangular frame sits precisely aligned to the grid, empty, waiting for content. Print grain, brutalist minimalism, engineering-drawing rhythm, kinetic tension between broken and exact. No text, no numbers, no UI.
```
**[OVERLAY SPEC]** Headline: `BUILDING THE MEMORY LAYER YOUR AI COACH IS MISSING.` Inside the orange frame: this week's real build note (short, factual, e.g. `this week: the parser now survives my worst gym notes`). Anchors: `RAW NOTE > PARSED > CONFIRMED` progression string + one log token. Mechanism line.

## B. Instagram story / Reel cover (9:16)

### B1 — Story teaser (9:16, primary palette)

**[IMAGE PROMPT]**
```text
Vertical editorial poster background, cream #F4EFE7. A cascade of fragmented charcoal marks falls from the top edge like scattered debris, accelerating downward, and resolves in the lower third into three stacked precise electric orange #FF4B19 horizontal bars of increasing width, aligned to a strict grid with registration marks. Strong vertical motion energy, grain texture, flat screen-print style, generous clear space in the middle third for overlay text. No readable characters anywhere.
```
**[OVERLAY SPEC]** Top: `YOUR AI FORGOT YOUR LAST SESSION.` Middle: `AGYM REMEMBERS WHAT YOU CONFIRM.` Bars labeled with tokens: `RAW`, `REVIEWED`, `READY`. Swipe/CTA zone bottom (story-native sticker, not baked into image).

## C. Ads (Reddit promoted post / IG feed ad)

### C1 — Reddit-native ad (1:1 or 1200×628, primary palette)

Reddit rewards plain, unpolished-looking content; keep the poster energy but reduce it.

**[IMAGE PROMPT]**
```text
Simple flat editorial graphic, cream #F4EFE7 background. Left side: a loose cluster of small charcoal fragment marks suggesting a scribbled note torn into pieces, no readable characters. A single thin charcoal line travels rightward and becomes a clean electric orange #FF4B19 line ending in a small precise square. Lots of empty space. Screen-print grain, minimal, almost diagrammatic but hand-finished, no UI, no cards, no arrows with heads, no text.
```
**[OVERLAY SPEC]** Headline (plain, not shouty): `Messy gym notes in. AI-ready context out.` Sub: `Paste a real log. Fix what the parser got wrong. Keep the context.` Anchors: one log token + plain-language cue. Disclosure: `v0 in development — local-first, no advice, no coaching.` CTA: `Try the demo`.

### C2 — IG ad variant (4:5) — reuse S4 system

Use the existing approved-for-internal-review S4 night-field execution (`assets/meta-ads-v3/agym-meta-m1-training-nightfield-v3-*`) as the base; only the CTA/footer changes per placement. No new generation needed — extend via the deterministic renderer.

## D. Profile assets

### D1 — Avatar (X, IG, Reddit — 1:1, works at 48px)

**[IMAGE PROMPT]**
```text
Minimal mark on flat charcoal #1A1817 square: a single bold electric orange #FF4B19 geometric form — a fragmented square whose left edge breaks into three small drifting shards while the right edge is perfectly sharp and complete. Centered, huge, flat vector style, no gradient, no texture at this size, no letters.
```
**[OVERLAY SPEC]** None, or a deterministic `A` glyph integrated into the sharp edge if legibility at 48px allows. Test at 48/96/400 px.

### D2 — X / Twitter banner (1500×500, primary palette)

**[IMAGE PROMPT]**
```text
Wide editorial banner background, cream #F4EFE7. Across the full width, a horizontal narrative in three zones: left zone dense chaotic charcoal fragment marks; middle zone the fragments thinning and beginning to align; right zone a strict row of electric orange #FF4B19 blocks locked to a grid with fine registration marks. Continuous grain, screen-print texture, strong left-to-right momentum, clear space along the bottom third. No text or characters.
```
**[OVERLAY SPEC]** Bottom-left, utility sans: `AGym — your training memory layer for AI.` Right: `RAW > REVIEWED > READY`. Nothing else; bios do the talking.

## E. Landing page hero (16:9 and mobile crop)

Prefer adapting the existing S3 background (`agym-meta-m1-training-translation-v3-background.png`). If regenerating:

**[IMAGE PROMPT]**
```text
Wide hero background, cream #F4EFE7, very quiet: faint charcoal fragment marks scattered in the upper left at low density, resolving into a sparse, precise electric orange #FF4B19 grid fragment in the lower right. Extremely restrained — the background must not compete with foreground text and a product demo module. Fine grain, flat print aesthetic, 70% of the canvas effectively empty. No text, no UI, no cards.
```
**[OVERLAY SPEC]** Handled by the page itself (hero copy = M1 control; demo module sits over the quiet center).

---

## QA checklist per generated asset

- [ ] No readable text/logos/UI came out of the model (regenerate if any)
- [ ] Palette matches exactly one approved set
- [ ] Fragmented→confirmed transformation visible
- [ ] ≥ 2 training anchors present after overlay
- [ ] Nothing from the prohibited-territory list (`brand-system.md` §Prohibited)
- [ ] No outcome/availability/medical claims in overlay copy
- [ ] Saved under `assets/` with correct name + prompt recorded here or alongside the asset
