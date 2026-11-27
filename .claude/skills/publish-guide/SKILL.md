---
name: publish-guide
description: "Research, draft and audit a sourced, gated guide page at /guides/{slug} from a topic, using the shared guide template (spec, copy deck, shared blocks), the owned Source Critic gate (guide:source-review) and audit:guide. Claude does the research itself with WebSearch and web fetch, no new API. The owner approves the brief, thesis, offers, first-hand evidence and voice. The output is a private candidate reviewed from a local build. It never deploys, never seeds, never publishes, and never invents first-hand evidence. Usage: /publish-guide {topic}"
---

# Publish Guide Skill

Turn a topic into a finished, sourced, on-brand guide at `/guides/{slug}`. Claude runs the research, the draft and the checks. The owner signs off on facts, evidence and voice. Checks fail closed on facts.

Truth docs: `docs/plans/publish-guide/PLAN.md` (design), `docs/wp/wp103-stories.md` (what is built). Reference guide: `/guides/5-to-9-builder`.

## How a guide actually renders (read this first)

A guide is data plus a copy deck plus a thin composition of shared blocks. The skill never writes HTML, CSS, layout components, `<head>`, schema, analytics or the gate.

| Layer | File | This skill writes? |
|---|---|---|
| **Data** (title, sections, hero, gate, steps, skills, roles, weeks, FAQ, upsells) | `app/(marketing)/guides/{slug}/guide.spec.ts`, typed `GuideSpec`, data only, no value imports | Yes |
| **Prose** (every paragraph, keyed by slot name) | `app/(marketing)/guides/{slug}/guideCopy.ts` | Yes |
| **Section order** (which shared block goes where, this guide's own headings and pull quotes) | `app/(marketing)/guides/{slug}/_sections.tsx`, composed only from `../_shared/blocks` | Yes, by copying the 5-to-9 pattern. No new components, no new CSS |
| **Page** | `app/(marketing)/guides/{slug}/page.tsx`, thin: `GuideLayout` plus `buildGuideMetadata` | Yes, copy the 5-to-9 page |
| **Layout, gate, checklist, prompt box, FAQ, SEO metadata, JSON-LD** | `app/(marketing)/guides/_shared/*` | No. If a guide needs a block that does not exist, stop and ask |
| **Upsell cards** | `lib/guides/offers.ts` registry, `UpsellCard` | No. The skill suggests, the owner approves |
| **Research record and sealed review** | `guides/records/{slug}.json`, `guides/records/{slug}.source-review.json` | Yes, with the rules in Step 2 and Step 3 |
| **Sitemap** | `app/sitemap.ts` | No. A route under `app/` is picked up when it deploys |

Facts about the template:
- Slugs match `^[a-z0-9]+(?:-[a-z0-9]+)*$`. Section ids run `s01`, `s02`, in order, at least two.
- `gate.mode` is `after-section-1` or `none`. The layout does not render `none` yet, and the audit says so. Use `after-section-1` unless the owner decides otherwise.
- Slot names come from `lib/guides/slots.ts` (`requiredSlots(spec)` lists every slot the shared blocks read). A missing slot throws at render, so a bad guide fails the build.
- `headline` needs a first sentence and an emphasis tail, split at `". "`.
- The hero image must be a real asset with `assetStatus: "approved"`. The owner's portrait `/image/john-portrait.webp` (1000 by 1250) is approved. Never mark a stand-in approved.
- One currency per guide. This site uses dollars. A price is never typed into copy: paid offers read theirs from `lib/live/config.ts`.
- Reader-facing text must not contain `TODO`, `TBD`, `FIXME`, `placeholder`, `COPY TO WRITE`, `lorem ipsum`, or our internal labels (for example `guide draft`).

---

## Usage

```
/publish-guide {topic}
```

Examples:
- `/publish-guide mastering Claude Code`
- `/publish-guide pricing your first offer`

| Situation | Path |
|---|---|
| The owner gives a topic | Run Step 0 and stop at the gate |
| The owner says "use placeholders" for their own evidence | Placeholder mode (Step 4). The run continues, and the candidate can never publish |
| A guide with this slug already exists | Ask. Never overwrite a guide folder or a record without an explicit go |
| A step fails | **STOP.** Report the failure. Do not paper over it, loosen a rule or patch a record to pass |

**Runtime:** Node 22.6 or newer (`package.json` engines). The CLIs run with `node --experimental-strip-types` through `npm run`. In a cloud session set `NODE_USE_ENV_PROXY=1` so `--fetch` goes through the session proxy. Nothing here needs a new API key.

---

## Hard rules

- **Never invent first-hand evidence.** No builds, numbers, screenshots, prompts, quotes or "I did X" lines the owner did not supply. A gap stays a gap, and the claim is dropped or the evidence is marked as a stand-in (Step 4).
- **Never invent an outside fact.** Every statistic, pay figure, tool fact, date and quote is a claim in the research record with a verbatim excerpt from a page you read.
- **Never copy another site's words, headings, visual identity or data.** Borrow structure only (an outline above the gate, a deliverable every week, a test at the end of each skill). Review the draft for phrasing that echoes a source page.
- **Never deploy, push to `main`, seed Convex or ask for publication.** Site publishing is paused. A noindex tag or a draft flag is not access control. Review the candidate from a local build (Step 8).
- **Never skip a gate.** Steps 0, 1, 4 and 9 stop for the owner.
- **Never hand-edit a sealed review, and never patch a record to make a bad source pass.** Re-research instead.
- **Never type a price, seat count or deadline into copy.** Urgency needs a data source in the offers registry.

---

## Step 0 — Brief (GATE: owner approves)

Write a short brief and stop. Do not research yet.

- Audience, in one line, and the single outcome they leave with.
- Working title and slug.
- Gate mode (default `after-section-1`).
- Offer shortlist (see Offers below), or "no offer fits".
- First-hand evidence the owner would need to supply (builds, numbers, screenshots). If none exists, say the guide will have no authority claim.
- Any existing guide or page this overlaps, from `app/(marketing)/guides/`, `content/articles/` and `app/solve|build-with|ideas-for/`.

## Step 1 — Thesis and outline (GATE: owner approves)

One line thesis, set before research. Then the outline: the 2 to 11 sections (ids `s01...`), the steps (or rungs), skills, roles, weeks and FAQ questions. Each skill ends with a test the reader can run (`Readiness test` slot). Each week ends with a shipped proof. Stop for approval.

## Step 2 — Research (Tier A: no new API)

Use WebSearch and the web fetch agent to gather sources. A fetch summary is never the proof. For every outside claim, open the page and copy a verbatim excerpt (a sentence or a clear phrase).

Write `guides/records/{slug}.json` (`lib/guides/research-record.ts`, `RECORD_CONTRACT_VERSION = 1`):

- `sources[]`: `id`, `url` (https), `publisher`, `title`, `dateChecked` (today), `published` if the page says.
- `claims[]`, each with `id` and `text` (the sentence the guide will use):
  - `stat`, `pay`: need `display` (the figure exactly as the page prints it). `pay` also needs `asOf`.
  - `tool-fact`, `date`: need `asOf`.
  - `quote`: needs `speaker`.
  - all five outside kinds need `sourceId` and a verbatim `excerpt`.
  - `first-hand`: needs `evidenceId`, no source.
- `evidence[]`: the owner's own proof, each with `verify` of one kind:
  - `file-count`: counts files in a repo folder (for example idea pages in `content/ideas`). Reproduced by the CLI.
  - `git-count`: commits or merged pull requests. Reproduced only with full git history. A shallow clone reports "unverifiable".
  - `owner-statement`: something only the owner can say, such as "built solo". A reviewer confirms it. Nothing checks it by machine.
- `allowedNumbers[]`: figures in the copy that are structure, such as "5 steps". Listing one is a choice, so keep the list short.

Rules: only whole figures match (a claim saying 1200 does not back a 200). Prefer primary sources (vendor docs, the original study). A page you cannot read cannot back a claim. Leave it out.

Run the mechanical checks:

```bash
NODE_USE_ENV_PROXY=1 npm run guide:source-review -- verify --record=guides/records/{slug}.json --fetch
```

`verify` fails on an inconsistent record, a mismatched count, an excerpt that is not on the page, a page that could not be read, and placeholder evidence. Fix the record or drop the claim. Do not weaken the excerpt to make it match.

## Step 3 — Source Critic (no PASS, no draft)

The review must be independent of the writer. Spawn a fresh agent (the `general-purpose` agent type) and give it only: the record, the instruction to open every cited page itself, and the checklist below. Do not give it the outline, the thesis or your opinion. A reviewer shown your conclusion tends to confirm it.

```bash
npm run guide:source-review -- draft --record=guides/records/{slug}.json --reviewer="Source Critic"
```

The reviewer edits `guides/records/{slug}.source-review.json`, setting each applicable check to `true` or leaving it `false`, with a note for each claim. Checks by kind:

- All outside kinds: `excerptMatchesPage` (the page contains it), `topical` (it is about this subject, not a side mention).
- `stat`, `pay`: `figureMatchesExcerpt` (subject, metric, year, measurement versus projection, currency and billing basis), `sourceCredible`.
- `pay`, `tool-fact`, `date`: `asOfStated`.
- `tool-fact`, `date`: `sourceCredible`.
- `quote`: `wholeStatementInContext`, `speakerNamed`.
- `first-hand` with an owner statement: `topical`, `ownerConfirmed` (the owner said it, in this conversation or the evidence file, and the sentence does not claim more). A stand-in is never confirmed.
- `first-hand` with a counted evidence: `topical`, `reproducible` (`verify` reproduced it).

A matching excerpt proves the page said it when it was read. It does not prove the source is credible. Vendor marketing, a review site and a user anecdote are different things, so note which.

Then seal and check:

```bash
npm run guide:source-review -- seal  --record=guides/records/{slug}.json
npm run guide:source-review -- check --record=guides/records/{slug}.json
```

`seal` sets the verdict from the checks, so a false check cannot be sealed as a PASS. It refuses a review drafted from an older record: if the record changed, run `draft --force` and judge every claim again. `check` exits 0 only for a sealed PASS on exactly this record. A source last checked more than 120 days ago fails, more than 60 warns.

**If `check` does not exit 0, stop. Do not draft.** In placeholder mode a FAIL is the expected result (Step 4).

## Step 4 — Evidence intake (GATE: owner supplies or chooses placeholders)

The owner supplies first-hand evidence: what they built, the real numbers, the prompts they used, the screenshots. Ask for it. Record each item as `evidence[]` and tie each `first-hand` claim to it. If the evidence is a count the repo can reproduce, use `file-count` or `git-count`.

**Placeholder mode.** When the owner says to use placeholders (for testing the skill, or because the evidence is not ready):

1. Write each missing item as an evidence entry whose `statement` or `label` says `PLACEHOLDER:` and what is needed, for example `PLACEHOLDER: John describes the first project he built with Claude Code and what it shipped`.
2. Write the `first-hand` claim that will use it with a clear stand-in sentence, also marked `PLACEHOLDER:`.
3. Continue to the draft, so the owner can see the shape of the guide.

Placeholder mode is a test run, not a draft of a publishable guide. Placeholder evidence fails `verify` (`evidence-placeholder`), and a reviewer cannot confirm it, so the sealed review is a FAIL. Placeholder text in copy fails `audit:guide` (`placeholder-text`). So a placeholder guide **cannot pass the audit and cannot publish**. That is the point. Say this in the report. Real evidence replaces every placeholder, the review is drafted again with `--force`, and the audit is run again before anything is considered ready.

Never make up a plausible-sounding evidence entry. A placeholder says it is one.

## Step 5 — Draft

Draft only from the sealed record and the evidence. In placeholder mode, draft from the record and mark the stand-ins.

1. Copy the 5-to-9 folder structure for `app/(marketing)/guides/{slug}/`: `guide.spec.ts`, `guideCopy.ts`, `_sections.tsx`, `page.tsx` (and `ideaCount.ts` only if the guide shows a live idea count).
2. Fill `guide.spec.ts` as data. Set `lang`, `authorName`, `utmCampaign`, `checklistKey`, `promptFileName`, `ogImagePath`. Choose `hero.image` as above. Add `upsells` only for offers the owner approved.
3. Write `guideCopy.ts`. Every slot in `requiredSlots(spec)` must exist, plus this guide's own slots (leds, pull quotes, FAQ answers, prompt text, self-check items, founder note). Every figure in the copy must be a claim's sentence or an `allowedNumbers` entry. Put each claim's `text` into the copy word for word, so the audit can trace it.
4. Write `_sections.tsx` by copying the 5-to-9 composition and changing only the slots, headings and pull quotes. Use only `../_shared/blocks` and `../_shared/GuideInteractions`.
5. Voice: plain sentences, concrete examples, an honest-catch aside only where the truth is uncomfortable. Use them sparingly so ten guides do not read alike. The audit has no cap yet (the plan waits for a second guide to set one), so this is judgment.
6. Do not edit anything under `_shared/`, `lib/guides/`, `app/sitemap.ts`, or `lib/live/config.ts` in this step.

## Step 6 — Audit (fails the run)

```bash
npm run audit:guide -- --slug={slug}
```

It checks: spec schema and section ids, every required slot present and not empty, placeholder wording, internal labels, one currency, the hero asset (approved, a real file, honest alt text), upsell rules (offer exists and is open or switched off, at most two cards, links resolve, price from config), and, because a record exists, the research rules: a sealed PASS on exactly this record, no stale source, every figure in the copy traces to a claim.

An error stops the run. Fix the cause. Never set a rule to a lower severity and never delete a check. A warning is reported to the owner.

## Step 7 — Build and preview

```bash
npm run typecheck
npx eslint "app/(marketing)/guides/{slug}" lib/guides
npm run test:home
npm run build
```

Then run the `a11y-check` skill on the new page (WCAG 2.1 AA, project rules in `CLAUDE.md`). Start the production server and take screenshots at 390 pixels and at 1280 pixels, once with the consent banner open and once dismissed. Confirm the hero headline and the primary button stay visible with the banner open. Look at the hero image yourself.

Run the live checks against the **local** server:

```bash
npm run audit:guide -- --slug={slug} --live --url=http://localhost:3000/guides/{slug}
```

This never submits a subscription unless `--email` is passed. Do not pass `--email` with a reader's address.

## Step 8 — Private candidate

The candidate exists only on a branch and in a local build. Do not deploy it, do not open a pull request that would merge a public route, and do not push to `main`. Anyone with the URL of a deployed page can open it, so a draft flag or noindex is not protection. A preview deployment needs deployment protection confirmed on for this project first. Until the owner chooses a mechanism (PLAN open question 6), review locally.

If the candidate is a placeholder run, the branch must never be merged. Say so in the report.

## Step 9 — Owner sign-off (GATE)

Report, then stop. The owner reviews facts (the record and the sealed review), evidence (every owner statement and screenshot), voice (the copy), and the hero image. Only after sign-off does anyone ask to publish, and publishing is its own decision.

## Step 10 — Live acceptance (only after a deploy the owner asked for)

```bash
npm run audit:guide -- --slug={slug} --live --url=https://www.weekendmvp.app/guides/{slug}
```

Checks for every guide: no page errors, no sideways scroll at 390 pixels, no placeholder text, one currency. For a gated guide it also checks the locked state, the unlocked state and a reload as a returning reader. Pass `--email` only with a test address the owner controls, because the gated run subscribes it.

---

## Offers (upsell cards)

The registry is `lib/guides/offers.ts`. `rankOffers({ topics, audiences })` ranks offers that are not closed by topic and audience overlap. An offer can sit behind an on/off switch in `lib/live/config.ts`. A switched-off offer shows no card and must not be linked from copy.

- Read the registry, rank by topic and audience, and suggest the top two with one sentence each on why they fit. An elevating pick (the natural next step above the guide's outcome) is allowed.
- At most two cards, one per placement (`mid`, `close`). The owner approves the choice.
- A waitlist offer cannot state a price or seat count. A paid offer reads its price from config. Urgency needs a backing data source.
- If no offer fits, or the only fitting one is switched off, say so. The guide ships with no upsell and the audit warns `upsell-none-shown`. That is the owner's call.
- Do not write offer copy the owner has not approved. Bullets and the "not for" line stay empty until then, and the audit reports a thin offer as a warning.

---

## Error handling

- `verify` reports `excerpt-not-found` or `excerpt-unreachable`: the page does not say it, or could not be read. Re-find the source or drop the claim. Never edit the excerpt to fit.
- `verify` reports `evidence-mismatch`: the owner's number is wrong, or the repo changed. Ask the owner. Never edit the number to fit.
- `verify` reports `evidence-placeholder`: expected in placeholder mode. Otherwise the owner has not supplied the evidence. Ask.
- `seal` refuses a stale review: the record changed. Run `draft --force` and have the reviewer judge again.
- `check` fails: read each reason. Stale hash, a false check, a source older than 120 days. Re-research or re-review. Do not draft.
- `audit:guide` fails: fix the cause (Step 6). `research-none` is information, not an error. It means the guide has no record yet, which is the case for the 5-to-9 guide only.
- A guide needs a block the template does not have: stop and tell the owner. Do not write a component or CSS inside a guide folder.
- Playwright is missing for `--live`: report that the live check did not run. It is not a pass.
- `build` fails on a missing slot: add the slot to the copy deck. Do not add a default.

---

## Output report

```
## Guide candidate: {title}  (/guides/{slug})

Status: PRIVATE CANDIDATE. Not deployed. Not merged. {PLACEHOLDER RUN: cannot publish}
Branch: {branch}

Source Critic: {sealed PASS | FAIL (reasons) | not run}   Claims: {n} ({outside n}, first-hand n)
Audit: {PASS | FAIL: n errors, n warnings}   Live (local): {PASS | not run}
Build, typecheck, tests: {results}   a11y-check: {result}

Owner to supply: {every PLACEHOLDER: item, or "none"}
Owner to decide: {gate mode, offers, thresholds}
Not run: {anything that did not run, and why}
```

---

## Checklist

- [ ] Brief approved (Step 0). Thesis and outline approved (Step 1).
- [ ] Research record written. `verify --fetch` clean.
- [ ] Independent reviewer judged every claim. `seal` then `check` exits 0 (or placeholder mode is stated).
- [ ] First-hand evidence supplied by the owner, or marked `PLACEHOLDER:`. Nothing invented.
- [ ] Spec, deck, sections and page written with shared blocks only. Nothing under `_shared/` changed.
- [ ] `audit:guide` clean, or its failures listed.
- [ ] Typecheck, lint, tests and build run. `a11y-check` run. Screenshots at 390 and 1280 checked, banner open and closed.
- [ ] Not deployed, not seeded, not merged to `main`.
- [ ] Owner sign-off asked for (Step 9).
