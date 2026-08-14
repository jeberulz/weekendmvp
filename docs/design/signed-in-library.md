# Signed-in library contract

Status: **accepted product thinking** (2026-08-14). Not implemented.
Branch: `design/platform-experience`.
Visual spec: [`signed-in-library-wireframe.html`](./signed-in-library-wireframe.html).
Companion: [`signed-in-home.md`](./signed-in-home.md) (chrome, days, last explicit keep).
Supersedes, for signed-in **Explore / Library only**: `All` / `For you` / `Saved` / `Interested` / `Building` views, Save/Interested as card actions, and Explore-as-workspace in `docs/wp/platform-ux-brief.md`. Public `/startup-ideas` and `/ideas/{slug}` are unchanged. Home/chrome remain the home contract.

Do not implement this file as a work package until a later build pass.

## Job

This isn’t the one. Pick another from the same public library and preview it. Then leave.

Home owns *this idea → a page*. Library owns *not this idea → pick one and preview*. After Preview, they are on Day 0/1 (or Open project if they already have one). Library does not keep them.

## Product vs public

| | |
|---|---|
| Public `/startup-ideas` | SEO + strangers. Marketing chrome. Card click is research. |
| Signed-in Library | Product-chrome *exit* from the current object. Same corpus. Preview is keepable. Then home. |

Do not put product chrome on `/startup-ideas`. Do not deep-link chrome **Library** to the public index.

## Chrome

Same one bar as home: wordmark · **current object name** · Library · Account.

While on Library, Library is the here-state (underline). The object name in the bar is the way back to home. No extra Back. No fourth chrome item.

Mobile: Home, Library, Account — Library is this picker.

## Arrivals

Signup never lands here. Home is the default (last explicit keep, or cold). Library is always a click: chrome **Library**, or Day 0 “Not this one? Browse the library.”

One body. Three frames only change chrome and what happens after keep:

| Frame | Came from | Chrome while browsing | After preview + keep |
|---|---|---|---|
| **Replace** | Day 0 / Day 1, this isn’t it | Unpublished name stays until the new keep | New keep becomes current. Old unpublished is **not** deleted and is **not** a Library view. |
| **Add** | Day n, start another | Live URL / name stays | New keep becomes current. Live one moves to the other-projects list under the object. |
| **First pick** | Cold home, skipped the three (or went straight to Library) | “Choose an idea” | First keep → Day 0/1. Full corpus instead of three cards. |

Cold home’s three cards are a shortcut into the same rank, not a fourth Library. Library shows the full list including those three.

Not arrivals: For you / Saved / Interested / Building as places; “continue Explore after signup”; search-as-a-state; a tab for leftover WP23 `idea_intents`.

## Corpus and rank

Same published `ideas` rows as `/ideas/{slug}` / `ideas/manifest.json` / `/startup-ideas`. No second catalog. No LLM pick. No “For you.”

Default order: existing canonical scores (opportunity, pain, timing, builder confidence average), recency as tiebreak — unlabeled. Same rank as home’s three. Alternate sort: newest. No Recommended. No oldest.

Search: title + description over the **whole** published library. Category: same allowlist as public. Search and category are not per-page.

Filter to ideas that can start `/build/{slug}` for Preview. Own-idea is a text link, not nav (same as home cold). v1.0 is still repository ideas.

## Card

Scannable row. Title + description + category + build time.

- **Preview this idea** is the only primary. Goes to `/build/{slug}` (then home law: last explicit keep).
- Title is the one research path → `/ideas/{slug}`. No second Read research button.
- Do not print canonical score on the card.
- No Save. No Mark Interested.

Signed-in-only marks (public cannot do these):

- **Current** (Replace): this is the idea already in the chrome. Action is inert (“This is the one you’re on”). Do not preview it again.
- **Building**: they already have an active project for this idea. Action is **Open project** (that object’s Day 1 or Day n). Do not mint a second preview.

Do not hide current or building ideas from the list.

## Empty

“Nothing matches. Clear filters.” No policy copy. No “saved state unchanged.”

## Kill list

- All / For you / Saved / Interested / Building as destinations
- Save and Mark Interested on the card
- Sort: Recommended
- Canonical score on the card
- Duplicate Preview + Read research CTAs
- “Search loaded idea metadata” / per-indexed-page filters
- Landing on Library after signup
- A second catalog or personalized corpus
- Re-showing home’s three cards at the top of Library
- Credits, billing, composer, header search
- Library listing projects (that’s Day n / Account)

## Build-later acceptance (when we leave thinking mode)

A later implementation fails the spec if any of these are true:

1. Signed-in Library still has For you / Saved / Interested / Building views.
2. Cards still expose Save or Mark Interested.
3. Preview is not the only primary on a pickable card.
4. Search or category only apply to the current loaded page.
5. Default order is labeled “For you” or “Recommended.”
6. Signup lands on Library instead of home.
7. Chrome **Library** is a deep-link to public `/startup-ideas`.
8. Tests pass by substring-matching ExploreWorkspace source instead of rendering the picker above.

Walk localhost against the wireframe. Taste is the gate.

## Out of scope (this freeze)

Preview is frozen separately: [`preview.md`](./preview.md). Publish packet is frozen separately: [`publish.md`](./publish.md). Account menu. How Day n’s other-projects list is reached from Account. Own-idea Validation Report path (v1.1). Visual design system. Coding. Whether leftover `idea_intents` rows are ever deleted (ignore them; do not surface).

## Decision log

| When | Decision |
|---|---|
| 2026-08-14 | Job: this isn’t the one; pick another from the public library; preview; leave. |
| 2026-08-14 | Keep a signed-in Library page (product chrome). Do not deep-link to `/startup-ideas`. |
| 2026-08-14 | One body. Replace / Add / First pick are chrome + after-keep, not tabs. |
| 2026-08-14 | Signup never lands on Library. |
| 2026-08-14 | Replace does not delete the old unpublished project. |
| 2026-08-14 | No destination tabs. No Save / Interested actions. |
| 2026-08-14 | Default rank = canonical scores + recency, unlabeled. Alternate = newest. |
| 2026-08-14 | Signed-in-only marks: Current (inert), Building → Open project. |
| 2026-08-14 | Title = research. Preview = only primary. Search is corpus-wide. |
