# Wizard Step 1: where the own-idea example chips come from

Status: recommendation, implemented in WP99 (`docs/wp/wp99-stories.md`).
Surface: `/start/own`, "Try one of these" under the idea field (`OwnIdeaStart` in
`components/workspace/wizard/WizardFlow.tsx`).

## The problem

The three chips were a hard-coded constant (`OWN_IDEA_EXAMPLES`: packing list, invoice reminders, meal-prep planner).
Every founder saw the same three lines on every visit. The owner wants them to come from an LLM or a real data source.

## What the chips are for

The design direction (`wizard-step1-visual-direction.md` §6) adds them to lower the blank-page cost: they show what
"one sentence" looks like and give a founder without a sharp idea something to start from. A tap fills the field and
focuses it, so the founder can edit before Continue. They are inspiration. Whatever a chip puts in the box is not the
founder's own idea until they change it.

## Options weighed

### (a) A live LLM call per page view

- Cost: a paid call on every `/start/own` render, including reloads and back-navigation. Even at a fast tier that is
  spend with no product upside over a pool.
- Latency: the page renders at request time (`await connection()`). Either the render waits for the model, or the chips
  stream in after the field and shift the layout.
- Quality: unreviewed output shown to every founder. It can duplicate itself, repeat a library idea, or make market
  claims (D15 forbids those on the own path). The meter refuses calls when a budget is hit, so the chips would also
  flicker on and off with spend.
- Plumbing: it needs a new prompt spec, a version-lock entry, an eval suite, fixtures and an owner for the reservation.
  `/start/own` has no business yet, so the per-business meter has nothing to charge against.

Rejected. Every cost is real and every benefit is also available from (b) or (c).

### (b) An LLM-generated pool in Convex, refreshed on a schedule or by an operator

- Cost: small. One call writes ~50 lines, a few cents per refresh.
- Build cost: large for what it is. It needs a new table (schema changes go through Codex), a new prompt and version
  lock, a platform-owned reservation like the crew seeds (`convex/crew/seeds.ts`), an operator command or cron, an audit
  pass (length, market claims, near-duplicates of library ideas) and an empty-pool fallback. That is a WP90-sized
  pipeline for three pills.
- Product: the lines are made up and unresearched. A founder who taps one and continues gets a light "Not yet
  validated" blueprint of an idea nobody checked.

Viable but not worth it now. Revisit if the chips should one day be personalised (for example to the founder's
interests).

### (c) Lines from the real ideas library

- Source: every idea that is live in the public library (`ideas/manifest.json` merged with editorial releases, the
  exact rule `/ideas` and the homepage use: `mergeHomeIdeas` + `liveIdeas`). Titles are already one-line pitches. 219
  of the 231 manifest titles fit in 60 characters, for example "Widget that picks your top 3 tasks each morning".
- Cost: zero. No model call and no new table. The pool is cached (`"use cache"`, tag `ideas`, hours), and the three
  are drawn per request from the cached pool, so each visit shows a different three.
- Quality: these ideas passed the publish pipeline, so they are real, varied and free of AI filler. The pool grows as
  the library does, and an idea withdrawn in editorial drops out on the next cache refresh.
- The catch the brief names: a tapped chip is a validated library idea. If it only fills the own-idea box, a founder
  who keeps it as written builds a light, unvalidated blueprint of an idea we have already researched. That is strictly
  worse than the library path.

## Recommendation: (c), with a route back to the researched version

1. **Source.** Draw three chips per visit from the live library. Keep titles of 60 characters or fewer (cut at the
   first `:` / dash, as the homepage's `shortTitle` does). Only use slugs the wizard can start from (`isBuildCtaSlug`:
   no engine drafts). Never show the same idea twice.
2. **Click keeps `applyExample`.** A tap still fills the field and focuses it, as the brief requires. The founder can
   edit it into their own idea; that is the point of the box.
3. **Offer the researched version.** While the field still holds a tapped chip's exact text, a quiet line under the
   chips says the idea is already researched, with a link, "Build the researched version", to `/start/{slug}`. Once the
   founder edits the text the line goes away: it is their idea now. This answers "should a click go to the library
   idea?" without taking the box away from founders who want to riff.
4. **Never block the field.** The draw happens on the server, before the page HTML is sent, from a cached pool. There
   is no client fetch, no loading state and no layout shift. The field renders exactly as it did.
5. **Fallback.** If the pool can't be read (Convex down: the manifest-only pool is used, as on `/ideas`) or has fewer
   than three usable ideas, the gaps are filled from the old static list, kept only as a last resort. The fallback
   chips have no slug, so they never show the researched-version line.

### What this does not do

- No paid call, no new prompt and no schema change.
- No change to what Continue sends: the session still starts from the text in the field as an own idea.
- No personalisation. If the owner later wants chips tuned to the founder, option (b) is the path, and the WP99 seam
  (`OwnIdeaExample[]` passed in as a prop) lets a Convex pool replace the library draw without touching the UI.
