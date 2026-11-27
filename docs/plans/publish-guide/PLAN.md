# /publish-guide skill plan (draft)

Status: draft for John's review. No code written. Proposed package: WP103 (last story file on disk is wp102).
Lane: Work Package. Branch: cut a new branch from `main` after PR 331 lands. Do not stack on the draft.
Reference implementation: `/guides/5-to-9-builder` (PR 331).

## Goal

One skill, `/publish-guide {topic}`, that takes a topic and produces a finished, sourced, on-brand guide page.
Claude runs the research, drafting and build. Checks fail closed on facts. John signs off on facts, evidence and voice.

Success test: the second guide (proposed topic: mastering Claude Code) ships through the skill with no hand edits to
layout code, and every number on the page traces to a dated source or to John's own evidence file.

## What we borrow from the Dave Brown marketing-engineer page (patterns only)

We take the structure. We do not take his words, headings, visual identity or data.

| Pattern | Becomes in our schema | Priority |
|---|---|---|
| Full outline visible on the first screen | `outlineStrip` rendered in the hero, above any gate | High |
| Plan with a deliverable every week | `plan[].doThis[]` and required `plan[].shipBy` | High |
| Proof projects each tied to a number | `projects[]` with required `metric` slot filled from evidence | High |
| Dated, cited evidence layer | `sources[]`, `claims[]`, `lastVerified` | High |
| "How to use this page" routing box | `readerRoutes[]` | Medium |
| Skills that end in a test | `skills[].readyWhen` (already in 5-to-9) | Required |
| Starting point by role | `roles[]` with headStart, gap, leanOn | Required |
| Self-check that saves on device | `selfCheck[]` | Required |
| A copy-paste asset that does real work | `asset` (prompt, rules file or template) | Required |
| One thesis as the spine | `thesis`, one line, set before research | Required |
| Upsell box inside the guide | `upsells[]` (see below) | Required |

Kept from our own guide as the signature: honest-catch asides, first-sale style scripts, the sceptical-reviewer prompt.
Cap honest-catch asides so ten guides do not read alike.

## Do we need an API for deep research?

Short answer: no new API is needed to start. Claude can run research end to end inside a Claude Code session.

Tier A, default, zero new keys
- Claude uses WebSearch and the web-fetch agent to gather sources and writes a research record.
- The fetch tool summarizes pages, so it cannot be the proof. Each claim stores a verbatim excerpt. The audit then
  re-fetches the URL itself and checks the excerpt appears on the page. The Idea Engine already does this for quotes
  (`audit.quotes`, `ENGINE_QUOTE_FETCH_UA`).
- Limits: slower, less repeatable, and some sites block bots or sit behind paywalls. Blocked sources are marked
  unverified and cannot back a claim.

Tier B, optional, for unattended or scheduled runs
- Reuse the existing engine providers: Perplexity for search citations (`PERPLEXITY_API_KEY`), OpenAI for synthesis
  (`OPENAI_API_KEY`), Reddit for community text (optional keys). DataForSEO only if a guide needs keyword data.
- Use this for the freshness re-check job, where no one is in a session.

Decision for John: start on Tier A. Add Tier B only if re-check runs need to be unattended.

## Architecture

Data first, layout shared, prose in a slotted copy deck (the pattern `guideCopy.ts` already uses).

```
app/(marketing)/guides/_shared/        shared blocks: Hero, OutlineStrip, Section, Skills, Roles, Plan,
                                       Projects, Checklist, Asset, UpsellCard, Gate, Faq, Sources, HonestCatch
app/(marketing)/guides/{slug}/         guide.spec.ts (typed GuideSpec) + guide.copy.ts (slot deck) + page.tsx (thin)
lib/guides/offers.ts                   offers registry (paid, waitlist, free asset)
lib/guides/audit.ts                    audit rules, run by `npm run audit:guide -- --slug={slug}`
guides/records/{slug}.json             research record (sources, claims, excerpts)
guides/records/{slug}.source-review.json   sealed Source Critic result
guides/records/{slug}.evidence.json    John's first-hand evidence (screenshots, numbers, prompts)
```

GuideSpec fields: slug, title, thesis, archetype, audience, lastVerified, outlineStrip, readerRoutes, skills, roles,
plan, projects, selfCheck, asset, upsells, gate, faq, sources, claims.

Archetypes: start with one, `skill-ladder` (fits mastering a tool). The 5-to-9 guide is a `method` archetype.
Add a second archetype only after guide two ships.

## Pipeline (each step has an owner and a gate)

0. Brief. Skill drafts audience, outcome, archetype, gate mode and offer shortlist. Gate: John approves.
1. Thesis and outline. One-line thesis and the outline strip. Gate: John approves.
2. Research. Claude gathers sources into the record. Every claim has id, text, sourceId, kind, dateChecked, excerpt.
3. Source Critic. Re-fetch each excerpt and check topicality and context. Seals a PASS bound to the record hash.
   No PASS, no draft. Same fail-closed rule as `lib/engine/source-review.ts`.
4. Evidence intake. John supplies his own builds, numbers, screenshots and prompts. Claude never invents these.
   If the file is empty the guide is flagged `noFirstHandProof` and cannot publish without John's explicit override.
5. Draft. Claude fills the spec and copy deck from the sealed record and the evidence file only.
6. Audit (fails the run). See rules below.
7. Build and preview. Typecheck, tests, `a11y-check`, screenshots at phone (390px) and desktop width, taken with the
   consent banner open and again with it dismissed. A human looks at the hero image.
8. Private candidate. CLAUDE.md says site publishing is paused and new engine content stays private until John says
   go. The skill never deploys on its own. A noindex tag and a draft flag are not access control: anyone with the URL
   of a deployed page can open it. Until a mechanism is chosen (open question 6), review the candidate from a local
   build, with no deploy. If a preview deployment is used later, it needs deployment protection that is confirmed on
   for this project before the first candidate goes up.
9. John signs off on facts, evidence and voice. Only then does anyone ask to publish.
10. Live acceptance after any deploy: `npm run audit:guide -- --slug={slug} --live`. It loads the live URL in a
    headless browser. Checks that run for every guide: no page errors, no sideways scroll at 390px, no placeholder
    text in copy or alt text, one currency, and prices match config.
    Checks that run only when `gate.mode` is `after-section-N` or `full`: the locked state shows only the open
    sections, one submit returns 200 from `/api/subscribe`, the unlocked state shows every section, and a reload reads
    as returning. A guide with `gate.mode: none` never submits a subscription, because the page does not ask for one.
    Use a test address the owner controls. The gated run subscribes it, so never run it with a reader's address.

## Audit rules (examples, to be finalised in story S2)

- No placeholder text, no placeholder alt text, no "TODO" or "COPY TO WRITE".
- Every number in copy maps to a claim id or an evidence entry. Unmapped numbers fail.
- Every skill has a `readyWhen`. Every week has a `shipBy`. Every project has a metric or an explicit `noResultYet`.
- One currency per guide. Prices come from `lib/live/config.ts`, never typed into copy.
- Every claim has a `dateChecked`. Warn at 60 days, fail at 120 days (thresholds to confirm).
- Section count, word floor per section and a cap on honest-catch asides.
- At most two upsell cards plus one soft link. Offer status must match the registry.
- Internal labels never render publicly (for example "guide draft, Day 5" in a Receipt). Structural fix: a Receipt
  `source` is a typed reference to a claim id or a URL, never free text.
- Hero asset must carry `assetStatus: approved`. Fail on inline data images, files named or commented as draft, and any
  alt text that describes a stand-in. A text audit alone misses a placeholder drawn inside a picture, so a human
  confirms the hero in the preview step.
- Cookie banner check: at 390px with the consent banner open, the hero headline and the primary button stay visible.

## Upsell system

Upsells vary per guide. The skill suggests, John approves.

Offers registry entry:
- id, kind (`paid`, `waitlist`, `free-asset`), status (`open`, `waitlist`, `closed`)
- title, one-line promise, three bullets, notFor line
- price source (key into `lib/live/config.ts`) for paid offers
- url, topic tags, audience tags, and a `fit` note the skill can read

How the skill picks:
- Match guide topic and audience tags to offers, then rank by fit. Suggest the top two with one sentence each on why.
- Allow an elevating pick: an offer that is the natural next rung above the guide's outcome, not just a topical match.
- Waitlist offers are allowed for future products. They may not state a price or seat count unless a data source
  backs it. Paid offers must read their price from config.

Placement and rules:
- mid card after the plan, close card after the self-check and asset, optional soft link in the footer.
- Each card links to the guide's own outcome, for example "You finished week 2. Do week 3 live."
- Urgency lines (seats, price rises) need a backing data source, or the audit fails.
- An offer can sit behind a named on/off switch in `lib/live/config.ts` (WP103-S3.1). Off hides the offer's cards and
  any copy that links to it. The audit then skips its sale status and warns that no upsell is showing. `--offers-on`
  judges a guide as if the switch were on, to check before flipping it. A switched-off offer must not be linked from copy.
- Click tracking keeps the event name `guide_sprint_click` and carries `placement`, `guide` and `offerId`
  (WP103-S3). Rename the event when a second offer exists.
- An offer's status can be derived from config instead of typed (WP103-S3). The Build-Along reads
  `BUILD_ALONG`, `NEXT_BUILD_ALONG` and `NEXT_SESSION_CHECKOUT_ENABLED` in `lib/live/config.ts`. A guide whose offer
  is closed fails the audit. It reads config only, so a seat counter that is sold out is not seen.

## Gate options per guide

`gate.mode`: `none`, `after-section-N`, or `full`.
When gated, the outline strip and first plan weeks render above the gate so the reader sees the depth.
Keep today's behavior (email unlocks, starts the 5-day Starter) as the default for the 5-to-9 guide.

## Freshness

- Every claim carries `dateChecked`. The page shows a single "last verified" date.
- A re-check command re-fetches excerpts and reports drift. Tool-based guides (Claude Code) get a 30 day cadence.
- Re-check can run as a session task (Tier A) or a scheduled job (Tier B).

## What the live check of PR 331 taught us (2026-11-26)

Found on the deployed page, none caught by the PR checks:
- The hero image had "PLACEHOLDER HERO" drawn into the picture, with matching alt text.
- Receipt boxes showed internal labels.
- Mixed currency: 19 uses of the pound sign beside dollar prices.
- The cookie banner covered the primary button and stats on a phone.
- The preview before the gate was one section and a locked list. Depth was not visible.
Worked as intended: unlock opens in place, state persists on reload, no page errors, no sideways scroll at 390px.
Each item above now has an audit rule or a pipeline step in this plan.
Fixed on branch `claude/magical-dirac-f4ehf2`: hero now uses `/image/john-portrait.webp` with real alt text, and the
draft data-image file is deleted. Receipt labels, currency and the gate preview are still open.

## Stories (WP103, proposed)

- S1 Extract shared blocks and per-guide spec from 5-to-9. No visual change. Existing guide tests still pass.
  Done when: the 5-to-9 page renders from `guide.spec.ts` and the built-HTML copy check passes.
- S2 GuideSpec schema (zod) and `audit:guide`, including the `--live` mode from pipeline step 10.
  Done when: the audit fails on each rule above with a fixture, and `--live` passes against the 5-to-9 guide.
- S3 Offers registry and `UpsellCard`. Done when: price mismatch, over-cap cards and missing offer each fail the audit.
- S4 Extend Source Critic claim kinds. Today it covers market stats, competitor prices and community quotes. Guides
  need stats, pay or job data, tool facts, dates and quotes. Done when: sealed PASS gates the draft step.
- S5 Write `.claude/skills/publish-guide/SKILL.md`, following `publish-article` and `publish-idea`.
  Done when: a dry run walks steps 0 to 7 with the human gates stopping the run.
- S6 Pilot: guide two (mastering Claude Code). Needs John's evidence file. Done when: private candidate passes audit.
- S7 Re-check command and cadence. Done when: a stale claim is reported with the old and new excerpt.

## Prerequisites

Fix PR 331 first, because the template copies whatever it ships:
- Replace the draft hero image and its placeholder alt text.
- Remove internal source labels from the Receipt boxes.
- Choose one currency.
- Add an evidence layer and a real worked example (or label it clearly as hypothetical).
- Rebuild the 30-day plan with do-this tasks and ship-by deliverables.
- Decide gate placement and test the outline strip above it.

## Risks

- Source Critic is built for idea records. Extending its claim kinds (S4) is the biggest unknown. Not yet verified.
- Sameness across guides. Mitigation: thesis per guide, archetype-specific section order, cap on asides.
- Stale tool guides. Mitigation: dated claims and the re-check cadence.
- Crowded topic. A Claude Code guide wins only with John's first-hand evidence. No evidence, no authority claim.
- Copying risk. Keep structure only. Review each guide for any phrasing or look that echoes a source page.
- Research spend and time. Tier A costs session time. Tier B adds API spend, so cap it per run like `lib/engine/cost.ts`.

## Open questions for John

1. Start on Tier A only, or also wire Tier B now?
2. Which offers go in the first registry (sprint, Starter Kit, any future community waitlist)?
3. Do you have first-hand Claude Code results to use as evidence for guide two?
4. Gate mode for guide two: none, partial or full?
5. Is the 30 day re-check cadence right for tool guides?
6. How should a private candidate stay inaccessible before approval: local build only, or a protected preview deployment? If a preview, confirm deployment protection is on for this project.
