# Signed-in home contract

Status: **accepted product thinking** (2026-08-14). Not implemented.
Branch: `design/platform-experience`.
Visual spec: [`signed-in-home-wireframe.html`](./signed-in-home-wireframe.html).
Supersedes, for signed-in **home and chrome only**: the Hilos dual-rail dashboard in `docs/wp/platform-ux-brief.md` (Desktop Shell, dashboard-as-command-center, Saved/Interested as nav, bounded composer on home). Public idea pages, preview isolation, billing rules, and `noindex` on private routes are unchanged.

Do not implement this file as a work package until a later build pass. This document exists so the thinking cannot be rebuilt as Hilos-by-default.

## Job

Take the idea I just chose and turn it into a real page I can keep, then a live URL when I say so. One confirmed step at a time.

Business translation (never on the screen): preview is free, signup keeps it, payment publishes it.

## Product goal vs user goal

| | |
|---|---|
| Product | Convert the public idea library into paid published sites. Wedge vs Polsia: validate first, then build. |
| User | A solo builder who chose one idea wants to see it as a page, keep it, and know the next confirmed step. They are not administering a workspace. |

## Chrome (all days)

One top bar: wordmark · **current object name** · Library · Account (Research is an exit from Day 1, not a peer of the canvas).

No icon rail. No duplicate sidebar. No header search that is only a link. No composer. No Saved / Interested / For you as destinations. Billing is not a peer in the chrome; it appears when they hit Publish.

Mobile: Home, Library, Account.

## States

### Day 0 from preview

Home **is** the idea whose keep they asked for (the preview whose keep / email-me-a-link / continue they used). Last **explicit keep** wins. Viewing is not choosing.

Primary: Keep this preview. Secondary: Read the research. Exit: Not this one? Browse the library.

No credits. No Saved/Interested. No gallery of every anonymous preview they bounced off.

Anonymous previews are bearer tokens, 7 days. We have no identity before signup, so we do not invent a cross-device preview history. A this-tab recents list (max ~5, labeled as this visit) is optional later; it is not Day 0.

If magic-link opens in another browser, the stash is gone. They look cold unless they reopen that preview URL while signed in.

**Mechanism vs frame:** today’s claim mutation creates a project. Auto-claim on signup is an acceptable mechanism. If claim already succeeded, this frame is skipped and they land on Day 1 of that object. The product rule is still last explicit keep, not last viewed.

### Day 0 cold

No return idea. Job is pick one.

Corpus: the published library only. Same `ideas` rows as `/ideas/{slug}` / `ideas/manifest.json`. No second catalog. No LLM pick. No “For you.”

Rank: existing canonical scores (opportunity, pain, timing, builder confidence average), recency as tiebreak. Filter to ideas that can start `/build/{slug}`. Show **three**. Own-idea is a text link, not a nav item.

### Day 1 (unpublished project)

This is the page. **Kill the rest of this screen only** (not Day 0, not Day n): no welcome, no empty lists, no three equal CTAs, no blocked-on box, no shortcuts.

Layout: live preview canvas (the real render, watermarked, not a fake screenshot) plus **one proposal rail**. One card, one verb, confirm to apply. Examples: headline variant, slug taken, add price from the idea page, checklist green → Publish.

The agent’s context is this idea’s research snapshot + this preview’s customisation + this site spec. Not a user embedding.

Billing waits until Publish.

### Day n (live)

Live URL is the title. Next is a revision (diff, confirm, then credits) or start another idea. Other projects are a list under the current object. Switching objects changes the chrome name. Library adds another.

## Agentic rules (this surface)

The wow is the site in the room, not a chat.

Allowed: live canvas; one proposal; confirm-to-apply; publish as a prepared packet they scan; Day n revisions as before/after diffs.

Forbidden on this surface: home chat, “Morning John,” autonomous night shifts, God mode, credit spend after the fact, fake memory of every preview they viewed.

## Kill list

- Hilos dual rail + labeled sidebar with the same links
- Saved vs Interested as destinations
- For you
- Header search that is a link to Explore
- Composer / “supported shortcuts” / “we are not an agent” copy
- Credit balance on Day 0
- Project rows that do not open
- “Move one idea forward” over empty lists
- Day 1 workspace furniture once the live canvas exists

## Build-later acceptance (when we leave thinking mode)

A later implementation fails the spec if any of these are true:

1. Signed-in home is still a command-center of empty lists and policy copy.
2. Dual nav (icon rail + duplicate sidebar) ships.
3. Day 1 does not show the real preview render as the primary canvas.
4. Day 1 has more than one competing primary action besides the single proposal + eventual Publish.
5. Cold start personalizes with “For you” or any profile other than canonical scores.
6. Home treats last-viewed preview as the object instead of last explicit keep.
7. Tests pass by substring-matching component source instead of rendering the states above.

Walk localhost against the wireframe. Taste is the gate. `npm run typecheck` is not.

## Out of scope (this freeze)

Library is frozen separately: [`signed-in-library.md`](./signed-in-library.md). Preview/customisation is frozen separately: [`preview.md`](./preview.md). Publish checkout packet. Account menu. Own-idea Validation Report path (v1.1). Visual design system / production styling. Coding.

## Decision log

| When | Decision |
|---|---|
| 2026-08-14 | Job sentence accepted as law for signed-in home. |
| 2026-08-14 | Chrome is one bar. Current object in the middle. |
| 2026-08-14 | Cold start: three canonical-score cards, same corpus, no For you. |
| 2026-08-14 | Multiple previews: last explicit keep wins. No anonymous cross-device gallery. |
| 2026-08-14 | Day 1 is live canvas + one proposal. “Kill the rest of the page” means Day 1 furniture only. |
| 2026-08-14 | Agentic = proposal rail inside the artifact. Not a composer. |
