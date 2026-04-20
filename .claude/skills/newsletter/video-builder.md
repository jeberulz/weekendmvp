# Video Builder

Template and rules the `/newsletter today --with-video` path uses to emit the AM YouTube production pack: full word-for-word 10-15 minute script **plus** titles, thumbnails, chapters, B-roll cues, on-screen text, description, tags, and pinned comment.

The skill reads this file every run that enables `--with-video` (and for regen via `/newsletter video {date}`).

Voice calibration: MUST read both `voice-ali-abdaal.md` (rules) and `voice-samples.md` (anchor examples) at draft time. Every rule in `voice-ali-abdaal.md`'s "Register checks" section must pass before writing.

---

## Inputs (from Gate 2 angle + AM draft)

- From Gate 2 angle: `hook`, `pain`, `build hook`, `video promise`
- From `ideas/manifest.json[idea]`: `title`, `slug`, `summary`, `category`, `buildTime`, `revenueGoal`, `tools[]`, `audiences[]`, and (if present) `techStack`, `buildPrompts`
- From draft: `content/newsletter/{date}-am.md` frontmatter and BODY for consistency reference
- `date` — ISO `YYYY-MM-DD`

---

## Video anatomy — 10 chapters, target ~14 min

Target ~2,100 words spoken at ~150 WPM. Fits the 10-15 min band.

| # | Chapter | Duration | Word budget | Purpose |
|---|---------|----------|-------------|---------|
| 1 | Cold open | 0:00-0:45 | 90-110 | Works muted (hard-hitting title card). Vivid scenario or surprising stat. NO channel intro yet. |
| 2 | Welcome + roadmap | 0:45-1:15 | 60-75 | "Hey friends, welcome back" + numbered 3-item roadmap. |
| 3 | The problem | 1:15-3:00 | 250-300 | Relatable anecdote → zoom out to category → evidence (named source, else `[VERIFY STAT]`). |
| 4 | The idea | 3:00-5:30 | 350-400 | Name the product. One-line value prop. "Here's how it works" first-time-user walkthrough (narrate the user's first session). |
| 5 | Mid-roll soft CTA | 5:30-6:00 | 60-80 | Newsletter sub. Ali pattern: "If you're finding this useful, I send one of these every weekday — link in the description." Never aggressive. |
| 6 | The build | 6:00-9:30 | 450-525 | The meat. Stack (Cursor/Claude/Bolt/etc). Hour-by-hour breakdown of an 8-hour build. Read the key AI prompts verbatim. |
| 7 | The money | 9:30-11:00 | 200-250 | Pricing model. Path to target revenue (how many customers × what price = goal). Honest caveats ("this is the optimistic case..."). |
| 8 | Pitfalls | 11:00-12:30 | 200-250 | 2-3 specific failure modes + sidesteps. Builds trust via honesty. |
| 9 | Action step | 12:30-13:30 | 130-150 | MUST start with "The single most important thing you can do right now is..." followed by ONE concrete 10-minute micro-action — not "go build it." |
| 10 | Outro | 13:30-14:30 | 120-150 | End-screen CTAs (idea page + newsletter). 2-sentence recap. MUST end verbatim with "I'll see you in the next one." |

### Word-budget enforcement

If any chapter exceeds its word budget by >20%, tighten before writing. If under by >30%, expand with more specific detail (not filler). Chapters within ±20% of budget are accepted as-is.

---

## Chapter-specific guidance

### Chapter 1 — Cold open (90-110 words)

Three patterns to choose from, pick the one that fits the idea:

- **Scenario pattern:** "Imagine it's [specific day/time]. You [specific action]. You realize [specific painful realization]."
- **Stat pattern:** "[Specific sourced number] of [specific population] [experience specific pain]. [Editorial beat]. [Tease]."
- **Contrarian pattern:** "[Common belief]. [Setup turn]. [Surprise reveal that inverts it]."

End the cold open with a tease line that points at the idea without naming it yet. The welcome in Chapter 2 does the formal reveal.

### Chapter 2 — Welcome + roadmap (60-75 words)

Required structure:

```
Hey friends, welcome back to the channel.

[1-sentence reason-this-topic-matters bridge from the cold open.]

In this video I'll show you:
  One — [specific promise 1, usually "the product + who it's for"].
  Two — [specific promise 2, usually "the exact [N]-hour build plan"].
  Three — [specific promise 3, usually "how this realistically gets to ${target}/month"].

[Optional 1-sentence tee-up.]
```

The numbered "One — Two — Three —" phrasing is the Ali roadmap pattern. Use em-dashes, not colons.

### Chapter 3 — The problem (250-300 words)

Structure:
1. Anecdote (1-2 paragraphs, relatable specific moment, ~100 words)
2. Zoom out (1 paragraph, category pain, ~80 words)
3. Evidence (1 paragraph, numeric claim with named source OR `[VERIFY STAT]` marker, ~80 words)

Every number in this chapter MUST have a source or a marker.

### Chapter 4 — The idea (350-400 words)

Structure:
1. Name reveal: "The idea is called [product name]." (1 sentence)
2. Value prop: "Here's what it does in one sentence: [value prop]." (1 sentence)
3. First-time-user walkthrough: narrate opening the product and performing the core job-to-be-done, beat by beat. (~250 words)
4. "That's the whole product." (closing beat, underlines simplicity)

Include at least one named framework from `voice-ali-abdaal.md` (e.g., "I call this the [descriptor] pattern").

### Chapter 5 — Mid-roll soft CTA (60-80 words)

Required structure (adapt wording to taste, keep register):

```
[1-sentence bridge — "before I keep going" / "quick thing" type lead-in]

If you're finding this useful, I send one of these — one complete
weekend-buildable idea — every weekday morning. It's free, it's
short, and it takes about 90 seconds to read. The link is in the
description — weekendmvp.app.

[1-sentence "okay, back to it" transition into Chapter 6.]
```

No "SMASH," no capitalization emphasis, no guilt ("if you haven't subscribed yet..."). Pure invitational.

### Chapter 6 — The build (450-525 words)

Structure:
1. Stack intro: "I'd build this with [tools]. Here's why." (~50 words)
2. Hour-by-hour breakdown: 8 one-sentence entries (or however many hours the manifest's `buildTime` value implies — defaults to 8).
3. Verbatim prompts: read 1-2 of the actual prompts you'd give to the AI. Format in the script as indented blocks with quote marks.
4. "That's the build."

If the manifest lacks `techStack` or `buildPrompts` for this idea, insert `[VERIFY BUILD: manifest missing techStack and/or buildPrompts]` and fall back to a generic stack derived from `tools[]`. The handoff warning surfaces this.

### Chapter 7 — The money (200-250 words)

Structure:
1. Pricing model: "$N/mo" or "$N one-time" — be specific; derive from `revenueGoal` and common SaaS ratios. (1 paragraph)
2. The math: "$target/mo requires N customers at $price. CAC realistically is $X. Here's how I'd get the first 10." (1-2 paragraphs)
3. Caveat: "This is the optimistic case. More realistically, month one is [realistic beat]. The path works, but the timeline is [honest reframe]."

### Chapter 8 — Pitfalls (200-250 words)

Structure: 2-3 specific failure modes, each with a 1-sentence "here's how to sidestep it." Common patterns:
- "People build [shiny feature] instead of [unglamorous core]. Don't. The core is the only thing that matters for the first 10 customers."
- "The pricing page is always the last thing built. Flip that — build pricing first. If you can't explain who pays and why in one sentence, you don't have a product yet."
- "Launch-day traffic is a vanity metric. Day-30 retention is the real signal. Build the retention loop before you build the launch."

### Chapter 9 — Action step (130-150 words)

MUST start: **"The single most important thing you can do right now is..."**

Followed by ONE concrete 10-minute micro-action. NOT "go build it." Example candidates:
- "Open a blank doc and write the first prompt you'd give to Claude."
- "Search on Twitter for [specific phrase] and DM the first 3 people complaining about this problem."
- "Open the idea page, copy the pricing table, and paste it into your notes app."

End with the Ali-style encouragement beat: "If you can't get through [that small thing], you weren't going to ship it anyway. And if you do — I bet you'll keep going."

### Chapter 10 — Outro (120-150 words)

Structure:
1. End-screen CTAs: "The full teardown with stack, prompts, and pricing lives at [idea page URL]. And the newsletter — one of these every weekday — is at [newsletter URL]." (~60 words)
2. 2-sentence recap of what the video taught.
3. Sign-off: MUST end verbatim with **"I'll see you in the next one."**

---

## Production pack

Shipped inline in the same output file, below the script.

### Title options (3)

Pattern options:
- Curiosity-gap: `"I'd Build This $1K/mo App This Weekend (Full Stack Breakdown)"`
- Number + outcome: `"This 8-Hour AI Side Project Could Make $1,000/month"`
- Format + noun: `"The AI Tool Every Remote Team Needs (Weekend MVP #{N})"`

Generate one of each pattern.

### Thumbnail concepts (3)

Each concept is a text description — image/text/mood. Example shape:
```
Concept 1 — Split screen
  Left: exhausted-looking person at laptop, Zoom call visible
  Right: clean Notion doc with bulleted action items
  Text overlay: "$1K/mo IN 8 HOURS" (high-contrast, top-left)
  Mood: before/after contrast
```

### Chapter list (paste into YouTube description)

```
0:00 <chapter 1 title — concise, curiosity-rewarding>
0:45 <chapter 2 title>
1:15 <chapter 3 title>
3:00 <chapter 4 title>
5:30 <chapter 5 title — keep this one low-key, not "SPONSOR">
6:00 <chapter 6 title>
9:30 <chapter 7 title>
11:00 <chapter 8 title>
12:30 <chapter 9 title>
13:30 <chapter 10 title>
```

### B-roll cues (by timestamp)

Format: `<timestamp> <type>: <description>`. Types: `Stock`, `Screen recording`, `Product mockup`, `Text overlay`, `Graph/diagram`. Aim for 6-10 cues across the video.

Example:
```
0:05 Stock: overflowing Zoom transcript scrolling
0:22 Stock: frustrated person closing laptop
1:30 Screen recording: real Notion doc with dead action items
3:15 Product mockup: paste-transcript UI (static image OK)
6:30 Screen recording: Cursor IDE with extraction prompt visible
7:45 Text overlay: tech stack logos (Cursor + Claude + Whisper)
9:45 Graph/diagram: "$29 × 35 = $1,015/mo"
11:30 Text overlay: bullet list of pitfalls
```

### On-screen text callouts

Short 1-5 word text beats to appear at specific moments. Aim for 5-8 callouts.

Example:
```
At 0:30: "47 hours — Zoom/year per team (est.)"
At 3:25: "The product: AI Meeting Notes Cleaner"
At 5:45: "weekendmvp.app"
At 6:15: "STACK: Cursor + Claude 3.5 + Whisper"
At 9:50: "$1K/mo = 35 paying customers"
At 13:00: "YOUR TURN: open a doc"
```

### YouTube description (~200 words)

Structure:
1. 1-paragraph restatement of the hook (≤50 words)
2. Idea page link (with `utm_source=youtube&utm_medium=video&utm_campaign=am-{YYYYMMDD}`)
3. Newsletter link (same UTM pattern)
4. Chapter list (paste the chapter block)
5. 3-5 plain-text tags line (same as tags field below)

### Tags block (paste into YouTube tags)

Comma-separated, plain text, 8-12 tags. Mix category tags (`startup ideas`, `side project ideas`) with tool tags (`cursor ai`, `claude ai`) and branded tags (`weekend mvp`).

### Pinned comment

90-150 words. Links to the idea page AND the newsletter. Ends with an open-ended question to seed comments: "What would you change about this idea? 👇"

---

## Output file shape

Path: `content/video/{YYYY-MM-DD}-am.md`

```markdown
---
date: {YYYY-MM-DD}
slot: am
idea_slug: {idea.slug}
idea_title: "{idea.title}"
target_duration_min: 14
word_count_target: 2100
word_count_actual: {NNNN}
cta_primary_midroll: "newsletter"
cta_primary_endscreen: "idea_page"
utm_source: "youtube"
utm_medium: "video"
utm_campaign: "am-{YYYYMMDD}"
verify_stat_count: {N}         # count of [VERIFY STAT] markers remaining
youtube_video_id: null         # fill after publishing
---

## TITLE OPTIONS

1. <title 1>
2. <title 2>
3. <title 3>

## THUMBNAIL CONCEPTS

1. <concept 1>
2. <concept 2>
3. <concept 3>

## SCRIPT

### 1. Cold Open (0:00-0:45)  [words: NNN]

<verbatim script>

### 2. Welcome + Roadmap (0:45-1:15)  [words: NNN]

<verbatim script>

### 3. The Problem (1:15-3:00)  [words: NNN]

<verbatim script>

### 4. The Idea (3:00-5:30)  [words: NNN]

<verbatim script>

### 5. Mid-Roll Soft CTA (5:30-6:00)  [words: NNN]

<verbatim script>

### 6. The Build (6:00-9:30)  [words: NNN]

<verbatim script>

### 7. The Money (9:30-11:00)  [words: NNN]

<verbatim script>

### 8. Pitfalls (11:00-12:30)  [words: NNN]

<verbatim script>

### 9. Action Step (12:30-13:30)  [words: NNN]

<verbatim script>

### 10. Outro (13:30-14:30)  [words: NNN]

<verbatim script>

## CHAPTERS (paste into YouTube description)

0:00 <chapter 1 title>
0:45 <chapter 2 title>
... (through 13:30)

## B-ROLL CUES

<timestamp/type/description list>

## ON-SCREEN TEXT

<At TIMESTAMP: "TEXT" list>

## YOUTUBE DESCRIPTION

<200-word description>

## TAGS

<comma-separated tags>

## PINNED COMMENT

<verbatim comment>

## PRODUCTION CHECKLIST

- [ ] Read script cold once (feel for flow, flag awkward lines)
- [ ] Verify every `[VERIFY STAT]` marker has a real source before recording
- [ ] Record in one sitting (flow > takes)
- [ ] Pull b-roll per cue list
- [ ] Edit: chapter markers, on-screen text, end-screen
- [ ] Upload with chosen thumbnail
- [ ] Paste chapters, description, tags
- [ ] Publish + paste pinned comment
- [ ] Copy YouTube video ID into frontmatter: `youtube_video_id: "..."`
```

---

## `[VERIFY STAT]` handling

Every unsourced numeric claim in chapters 3, 4, 6, 7 gets a `[VERIFY STAT: <claim>]` marker inline. At write time:

1. Count total markers across the script.
2. Write that count into frontmatter as `verify_stat_count: N`.
3. In the handoff message, surface: "Video script contains {N} unverified stats. Search for `[VERIFY STAT` in the file and replace before recording."

Markers never block writing. The human is the verification layer.

---

## Steps the skill performs on `--with-video`

1. Load the AM draft at `content/newsletter/{date}-am.md`.
2. Load manifest entry for `idea.slug`.
3. Read `voice-ali-abdaal.md` and `voice-samples.md` for voice calibration.
4. Apply the Gate 2 angle.
5. Draft chapter-by-chapter, counting words per chapter and checking each against its budget.
6. Run the "Register checks" self-audit from `voice-ali-abdaal.md`. Revise any failing check.
7. Generate production pack (titles, thumbnails, chapters, B-roll, on-screen text, description, tags, pinned comment).
8. Count `[VERIFY STAT]` markers.
9. Write the output file. If it exists, prompt: **"Overwrite? [overwrite / backup / cancel]"**.
10. Append the output path to the handoff summary with word count, duration estimate, and verify-stat count.

---

## Do / Don't

- **Do** read both `voice-ali-abdaal.md` and `voice-samples.md` every run.
- **Do** run the voice-guide "Register checks" self-audit before writing.
- **Do** count words per chapter; enforce ±20% of budget.
- **Do** mark every unsourced numeric claim with `[VERIFY STAT]`.
- **Don't** paste samples from `voice-samples.md` into the script.
- **Don't** fabricate stats. Ever.
- **Don't** exceed 15:00 total duration. Trim chapter 6 first if over.
- **Don't** vary the verbatim opener or sign-off phrases.
