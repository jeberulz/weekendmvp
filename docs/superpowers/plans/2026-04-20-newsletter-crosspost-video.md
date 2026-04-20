# Newsletter Cross-Post + Video Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the `/newsletter today` skill with opt-in `--with-social` and `--with-video` flags that emit an AM-only X thread, LinkedIn post, and full YouTube production pack (Ali Abdaal voice), without changing the existing AM/PM email or web archive flow.

**Architecture:** Extend the existing markdown-spec skill at `.claude/skills/newsletter/` with four new sub-modules (social templates, video template, voice guide, voice samples) and update `SKILL.md` to document the new flags, a second approval gate, and regeneration commands. Output files are gitignored drafts under `content/social/` and `content/video/`. No code is written — the skill is a declarative markdown spec that Claude reads at invoke time.

**Tech Stack:** Markdown (skill spec), YAML frontmatter, existing bash scripts (unchanged), gitignore conventions.

**Spec reference:** `docs/superpowers/specs/2026-04-20-newsletter-crosspost-video-design.md`

---

## File Structure

Files this plan creates or modifies:

| Path | Action | Responsibility |
|------|--------|----------------|
| `.gitignore` | Modify | Append `content/social/` and `content/video/` patterns |
| `content/social/.gitkeep` | Create | Keep gitignored folder present in git |
| `content/video/.gitkeep` | Create | Keep gitignored folder present in git |
| `.claude/skills/newsletter/voice-ali-abdaal.md` | Create | Built-in Ali Abdaal style guide (rules table + examples) |
| `.claude/skills/newsletter/voice-samples.md` | Create | 3 seed anchor samples; user appends over time |
| `.claude/skills/newsletter/social-builders.md` | Create | X thread + LinkedIn post templates, CTA rules, char-count discipline, output file shape |
| `.claude/skills/newsletter/video-builder.md` | Create | Video chapter anatomy, production pack, Ali voice enforcement, output file shape |
| `.claude/skills/newsletter/SKILL.md` | Modify | Add flags to description; add Usage lines; add Gate 2 section; add regen commands; update files-touched table; update handoff output |

---

## Task 1: Scaffold gitignored output folders

**Files:**
- Modify: `.gitignore`
- Create: `content/social/.gitkeep`
- Create: `content/video/.gitkeep`

- [ ] **Step 1: Append gitignore rules**

Open `.gitignore`. After the existing newsletter block:

```
# Newsletter drafts (keep README + METRICS, hide per-send markdown)
content/newsletter/*.md
!content/newsletter/README.md
!content/newsletter/METRICS.md
```

Append:

```
# Social cross-posts (AM-only; hide per-send markdown)
content/social/*.md
!content/social/.gitkeep

# Video scripts (AM-only; hide per-send markdown)
content/video/*.md
!content/video/.gitkeep
```

- [ ] **Step 2: Create `.gitkeep` files**

Create `content/social/.gitkeep` with empty content.

Create `content/video/.gitkeep` with empty content.

- [ ] **Step 3: Verify gitignore behavior**

Run:
```bash
touch content/social/2026-04-20-am-x.md content/video/2026-04-20-am.md
git status --porcelain content/social/ content/video/
```

Expected output (exactly these two lines, no draft files listed):
```
?? content/social/.gitkeep
?? content/video/.gitkeep
```

Clean up the probe files:
```bash
rm content/social/2026-04-20-am-x.md content/video/2026-04-20-am.md
```

- [ ] **Step 4: Commit**

```bash
git add .gitignore content/social/.gitkeep content/video/.gitkeep
git commit -m "$(cat <<'EOF'
chore: gitignore content/social and content/video draft folders

Mirror the existing content/newsletter/ pattern. Per-send drafts are
ephemeral; only .gitkeep files ship.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Create `voice-ali-abdaal.md` (built-in style guide)

**Files:**
- Create: `.claude/skills/newsletter/voice-ali-abdaal.md`

- [ ] **Step 1: Write the voice guide file**

Create `.claude/skills/newsletter/voice-ali-abdaal.md` with exactly this content:

````markdown
# Ali Abdaal Voice Guide

Rules the video script generator MUST follow. This is the baseline; `voice-samples.md` holds 3+ curated anchor examples that further calibrate tone. Read both at draft time. Neither is copy-pasted verbatim — they are calibration references.

The goal: a viewer who already watches Ali Abdaal should feel at home. The goal is NOT to impersonate — it is to borrow the structural habits and register that make his videos feel measured, useful, and warm.

---

## Enforced rules

| Element | Rule | Example |
|---------|------|---------|
| Opener | "Hey friends, welcome back to the channel." Verbatim. No substitutes. | `Hey friends, welcome back to the channel.` |
| Roadmap | Chapter 2 always contains "In this video I'll show you [3 specific promises]" — numbered, specific, not vague. | `In this video I'll show you: one — the specific product we're building. Two — the exact 8-hour build plan. Three — how this gets to $1,000 a month.` |
| Frameworks | Give things names. Invent acronyms or brand-able phrases. | `I call this the 8-Hour Stack.` / `The Three-Prompt Build.` |
| Evidence | Claims with numbers get named sources. If no source is available, inline `[VERIFY STAT: <claim>]` — never fabricate. | `According to a 2025 Microsoft Work Trend study, 68% of knowledge workers...` NOT `studies show most workers...` |
| Transitions | Use 2-3 per script: "The thing is..." / "Here's where it gets interesting..." / "Let me show you what I mean." / "But here's the part I think most people miss." | `The thing is — the transcript already exists. The work is converting it.` |
| Enthusiasm register | Genuine, measured. "I think this is really exciting." Never caps, never "THIS CHANGES EVERYTHING." | `I genuinely think this is one of the most shippable ideas I've looked at this month.` |
| Self-deprecation | Exactly one small aside per script. Keeps warmth. | `I'm not a designer — my own landing pages look like they were built in 2007 — but...` |
| CTA energy | Soft. Invitational. Never aggressive. | Good: `If you're finding this useful, I send one of these every weekday morning — link in the description.` Bad: `SMASH that subscribe button!` |
| Closing formula | Chapter 9 must end with "The single most important thing you can do right now is..." followed by ONE concrete micro-action (not "go build it" — something you can do in the next 10 minutes). | `The single most important thing you can do right now is open a blank doc and write the first prompt you'd give to Claude. That's it. That's the first hour.` |
| Sign-off | Chapter 10 must end with "I'll see you in the next one." Verbatim. | `I'll see you in the next one.` |
| Pacing | Short sentences. Declaratives. Frequent paragraph breaks (every 2-4 sentences). | `The transcript exists. The decisions don't. That's the gap.` |

---

## Patterns to AVOID

- **Hype language**: "incredible," "insane," "mind-blowing," "game-changer," "10x," "literally." Use sparingly or not at all.
- **Generic YouTuber filler**: "What's up guys," "Don't forget to like and subscribe," "In today's video we're going to be talking about..."
- **Unsourced stats**: Never write "studies show" or "most people" without a named source or a `[VERIFY STAT]` marker.
- **Second-person lecturing**: "You need to..." — prefer "I think the move is..." or "The tactic that works for me is..."
- **All-caps emphasis**: Use italics via the production on-screen text layer, not written emphasis.
- **Rhetorical questions as filler**: "Right? Makes sense, yeah?" — Ali asks rhetorical questions sparingly and always answers them.

---

## Register checks (self-audit at draft time)

Before emitting a script, silently check each:

1. Does the opener match verbatim?
2. Does chapter 2 contain a numbered 3-item roadmap?
3. Are all numeric claims sourced or marked `[VERIFY STAT]`?
4. Is there at least one named framework or brand-able phrase?
5. Is there exactly one self-deprecating aside?
6. Does chapter 9 start with the closing-formula phrase?
7. Does chapter 10 end with the verbatim sign-off?
8. Are paragraph breaks frequent (no paragraph longer than ~4 sentences)?

If any check fails, revise before writing the file.

---

## Tone exemplar (synthesized, for calibration only — do not paste)

> Hey friends, welcome back to the channel.
>
> Today I want to walk you through a small idea that I think is genuinely one of the most shippable things I've looked at this month. In this video I'll show you: one — the specific product and who it's for. Two — the exact 8-hour build plan, including the prompts I'd use. Three — how it realistically gets to $1,000 a month.
>
> So let's start with the problem, because it's a problem I'm betting you've actually had.
>
> ...
>
> [mid-roll]
>
> If you're finding this useful, I want to let you know that I send one of these — one complete weekend-buildable idea — every weekday morning. It's free, it's short, and it takes about 90 seconds to read. The link is in the description below. Okay, back to it.
>
> ...
>
> The single most important thing you can do right now is open a blank doc and write the first prompt you'd give to Claude. That's the first hour. If you can't get through that hour, you weren't going to ship it anyway. And if you do — I bet you'll keep going.
>
> I'll see you in the next one.
````

- [ ] **Step 2: Verify the file**

Run:
```bash
wc -l .claude/skills/newsletter/voice-ali-abdaal.md
grep -c "^|" .claude/skills/newsletter/voice-ali-abdaal.md
grep -c "Register checks" .claude/skills/newsletter/voice-ali-abdaal.md
```

Expected: file has ~80+ lines, table rows are present (grep count ≥12), and the "Register checks" section exists (count 1).

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/newsletter/voice-ali-abdaal.md
git commit -m "$(cat <<'EOF'
newsletter: add Ali Abdaal voice guide

Built-in style guide the video-builder module reads at draft time.
Enforces opener, roadmap, frameworks, evidence-sourcing, transitions,
CTA tone, closing formula, and sign-off. Includes patterns-to-avoid
and a self-audit checklist.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Create `voice-samples.md` (3 seed anchors)

**Files:**
- Create: `.claude/skills/newsletter/voice-samples.md`

- [ ] **Step 1: Write the voice samples file**

Create `.claude/skills/newsletter/voice-samples.md` with exactly this content:

````markdown
# Ali Abdaal Voice — Anchor Samples

Three curated anchor examples that calibrate cadence, phrasing, and structural tics beyond what `voice-ali-abdaal.md` captures in rules. The video-builder module reads this file at draft time. Samples are **not** copy-pasted verbatim into scripts — they are calibration references for register.

**How to curate:** whenever you hear an Ali Abdaal line that nails a moment (cold open, a mid-roll, a closer, a transition), append it here with the chapter context. Over time the file becomes a tight voice fingerprint. Prune samples that stop feeling right.

**Format:** each sample is an `## Sample N — <chapter role>` heading followed by a blockquote. Keep samples 40-120 words. Shorter examples are higher-leverage than long ones.

---

## Sample 1 — Cold open (productivity)

> Imagine it's Monday morning. You sit down with your coffee, open your laptop, and you realize you have absolutely no idea what you agreed to do last week. You know you were in meetings. You have the transcripts. But somewhere between "let's circle back" and "I'll own that" — the actual decisions just evaporated.

## Sample 2 — Mid-roll CTA

> If you're finding this useful, I want to let you know that I send one of these — one complete weekend-buildable startup idea — every weekday morning. It's free, it's short, and it takes about 90 seconds to read. The link is in the description below. Okay, back to it.

## Sample 3 — Closing action step

> Here's the single most important thing you can do right now. Don't go build the whole thing. Open a blank document. Write the first prompt you'd give to Claude. That's it. That's the first hour. If you can't get through that hour, you weren't going to ship it anyway. And if you do get through it — I bet you'll keep going.

---

## Notes on using this file

- Samples are calibration, not source. Never paste a sample into a script.
- When adding samples, note the chapter role in the heading (`Cold open`, `Problem`, `Idea`, `Mid-roll CTA`, `Build`, `Money`, `Pitfalls`, `Action step`, `Outro`).
- If the file is empty, the video-builder falls back to `voice-ali-abdaal.md` alone and emits a one-line hint in the handoff: "No voice samples yet — add favorites to voice-samples.md to tighten tone over time."
````

- [ ] **Step 2: Verify the file**

Run:
```bash
grep -c "^## Sample" .claude/skills/newsletter/voice-samples.md
```

Expected: `3`

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/newsletter/voice-samples.md
git commit -m "$(cat <<'EOF'
newsletter: seed voice-samples.md with 3 anchor examples

Cold open, mid-roll CTA, and closing action step samples. Used as
calibration references by video-builder.md. User appends or prunes
over time.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Create `social-builders.md`

**Files:**
- Create: `.claude/skills/newsletter/social-builders.md`

- [ ] **Step 1: Write the social builders file**

Create `.claude/skills/newsletter/social-builders.md` with exactly this content:

````markdown
# Social Builders

Templates and rules the `/newsletter today --with-social` path uses to emit AM X threads and LinkedIn posts. AM only. One file per platform per day.

The skill reads this file every run that enables `--with-social` (and for regen via `/newsletter social {date}`).

---

## Inputs (from Gate 2 angle)

- `hook` — one-line surprising stat / contrarian take / specific scenario
- `pain` — one-line visceral single-customer moment
- `idea.title`, `idea.slug`, `idea.summary` — from `ideas/manifest.json`
- `build` — `{buildTime}h MVP, {formatRevenue(revenueGoal)} target, stack: {formatTools(tools)}`
- `whoFor` — one-line specific buyer (derived from `idea.audiences[]`)
- `date` — ISO `YYYY-MM-DD`

---

## X thread — 5-7 tweets

### Shape

| Tweet | Role | Char limit | Constraint |
|-------|------|------------|------------|
| 1/N | Hook | 280 | Surprising stat / contrarian / specific scenario. Ends with `🧵`. |
| 2/N | Pain | 280 | Visceral single-customer moment. Not abstract category pain. |
| 3/N | Idea | 280 | Name the product. One-line value prop. No jargon. |
| 4/N | Build | 280 | Time, money, stack. "Weekend" must feel literal. |
| 5/N | Who for (optional) | 280 | Specific buyer. Compress into tweet 4 if that keeps the thread under 7. |
| 6/N | Primary CTA | 280 | Idea page URL with X UTM. **Only** external link in the thread. |
| 7/N | Soft subscribe close | 280 | Zero links. "Reply KEYWORD and I'll DM" pattern OR "link in bio". |

### Rules

- **Total tweets:** ≤7. Prefer 6 by compressing "who for" into the build tweet.
- **Exactly one external link** across the whole thread, in tweet 6.
- **No hashtags.** Zero. Not at the end, not inline.
- **Minimal emoji.** The `🧵` on tweet 1 is required. One more emoji anywhere else is allowed. Zero is better.
- **Every tweet standalone-readable.** X engagement may surface only one tweet; each must make sense alone.
- **Char counting:** UTF-16 code units (matches X's counting for basic Latin). Emoji may read as 2+ code units — count accordingly.

### Char limit overflow handling

If a drafted tweet exceeds 280:
1. Attempt 1: tighten phrasing (remove hedges, collapse "that is" → "that's", drop the article "the" where natural).
2. Attempt 2: shorter sentences; remove the least-load-bearing clause.
3. Attempt 3: if still over, emit the tweet as-is with trailing `[OVER BY N CHARS — EDIT]` marker. Do not block the rest of the thread.

### CTA URL formula (tweet 6)

```
https://weekendmvp.app/ideas/{idea.slug}.html?utm_source=x&utm_medium=social&utm_campaign=am-{YYYYMMDD}
```

### Subscribe close patterns (tweet 7 — pick the one that fits the thread)

- `Two ideas like this in your inbox every weekday. Reply "NEWSLETTER" and I'll DM the link.`
- `I send one of these every weekday morning. Signup link is in my bio.`
- `Free daily newsletter — 90 seconds to read, one weekend-buildable idea. Bio link.`

---

## LinkedIn — single post, ~1,000-1,500 chars

### Shape

```
<Hook line — single line, no lead-in>

<blank line>

<Story beat — 2-3 sentences, pain as narrative>

<blank line>

<The idea, named and scoped — 1-2 sentences>

<blank line>

The weekend-build math:
→ {buildTime}h to MVP
→ {formatRevenue(revenueGoal)} revenue target
→ Stack: {formatTools(tools)}
→ $0 infra until your first paying customer

<blank line>

<Who for — 1-2 lines, specific buyer>

<blank line>

<Primary CTA — newsletter sub via "comment KEYWORD" pattern, 2-3 lines>

<blank line>

<Soft secondary CTA — text-only site reference, 1-2 lines>
```

### Rules

- **Char budget:** 1,000-1,500 characters is the target band. Soft upper cap is 2,800 (LinkedIn hard limit is 3,000; leave a buffer for edits).
- **Blank lines:** LinkedIn collapses double-breaks to single — use blank lines generously for visual rhythm.
- **Links:** zero or one link in the body. The recommended pattern is the "comment KEYWORD" call-to-action with NO inline link, PLUS a text-only site reference ("search 'Weekend MVP <idea slug>' on the site"). LinkedIn's algorithm penalizes posts with external links, so the "search for it" close is the trick to drive intent without paying the link tax.
- **Hashtags:** start with zero. A/B over time. If added, max 5 at the very bottom, space-separated, topic-relevant (`#startupideas #buildinpublic #weekendmvp`). Never mid-post.
- **Emoji:** `→` is allowed as a bullet marker. Other emoji: zero.
- **Register:** measured, useful, zero hype. Match the `voice-ali-abdaal.md` rules on enthusiasm and hype avoidance (even though this file isn't Ali-voice-specific, the hype-avoidance carries over).

### Char overflow handling

If the drafted post exceeds 2,800:
1. Attempt 1: tighten the story beat and the who-for section.
2. Attempt 2: drop the soft secondary CTA.
3. Attempt 3: truncate to the last complete paragraph under 2,800, preserving the primary CTA.

### CTA URL formula (when a link is included)

```
https://weekendmvp.app/?utm_source=linkedin&utm_medium=social&utm_campaign=am-{YYYYMMDD}
```

(Site root, not idea page — the primary LinkedIn CTA is newsletter sub. If you include a link, it goes to the site homepage where the subscribe module is prominent.)

---

## Output file shape — X

Path: `content/social/{YYYY-MM-DD}-am-x.md`

```markdown
---
date: {YYYY-MM-DD}
slot: am
platform: x
idea_slug: {idea.slug}
cta_url: https://weekendmvp.app/ideas/{idea.slug}.html?utm_source=x&utm_medium=social&utm_campaign=am-{YYYYMMDD}
x_thread_id: null   # fill after posting, so /newsletter stats can find it later
---

## X THREAD (paste one tweet at a time)

### Tweet 1/N  [chars: NNN]
<body>

### Tweet 2/N  [chars: NNN]
<body>

... (through tweet N)

## CHECKLIST

- [ ] Open https://x.com/compose/post
- [ ] Paste tweet 1, click "Add post"
- [ ] Paste tweets 2-N in order (one per "Add post" click)
- [ ] Publish the thread
- [ ] Copy the thread's first-tweet URL
- [ ] Extract the numeric tweet ID from the URL and paste it into frontmatter: `x_thread_id: "..."`
```

---

## Output file shape — LinkedIn

Path: `content/social/{YYYY-MM-DD}-am-linkedin.md`

```markdown
---
date: {YYYY-MM-DD}
slot: am
platform: linkedin
idea_slug: {idea.slug}
cta_url: https://weekendmvp.app/?utm_source=linkedin&utm_medium=social&utm_campaign=am-{YYYYMMDD}
linkedin_post_id: null
---

## LINKEDIN POST  [chars: NNNN]

<full post body>

## CHECKLIST

- [ ] Open https://linkedin.com/feed/
- [ ] Click "Start a post"
- [ ] Paste the post body (not the char count marker)
- [ ] Publish
- [ ] Copy the post URL
- [ ] Extract the numeric post ID and paste it into frontmatter: `linkedin_post_id: "..."`
```

---

## Steps the skill performs on `--with-social`

For each platform in `[x, linkedin]`:

1. Load the AM draft at `content/newsletter/{date}-am.md`, parse frontmatter and the BODY section.
2. Apply the Gate 2 angle (hook, pain, idea, build, whoFor).
3. Draft the thread/post using this file's templates.
4. Count characters per tweet (X) or total (LinkedIn). Apply overflow handling if needed.
5. Write the output file. If the file already exists, prompt: **"Overwrite? [overwrite / backup / cancel]"**. `backup` renames the existing file to `{name}.bak` before writing.
6. Append the output path to the handoff summary.

---

## Do / Don't

- **Do** compute char counts at draft time — never trust LLM self-counts.
- **Do** keep tweet 6 as the only external link in the X thread.
- **Do** use the LinkedIn "comment KEYWORD" pattern as the primary newsletter CTA.
- **Don't** use hashtags on X. Ever.
- **Don't** use more than 5 hashtags on LinkedIn, and never mid-post.
- **Don't** include the idea page URL on LinkedIn as the primary CTA — it'll get throttled.
- **Don't** paste voice-samples.md content into a post. Samples are calibration for the video, not source text for social.
````

- [ ] **Step 2: Verify the file**

Run:
```bash
grep -c "^## " .claude/skills/newsletter/social-builders.md
grep -c "utm_source=x" .claude/skills/newsletter/social-builders.md
grep -c "utm_source=linkedin" .claude/skills/newsletter/social-builders.md
```

Expected: top-level `## ` heading count ≥8, `utm_source=x` appears ≥2 times, `utm_source=linkedin` appears ≥2 times.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/newsletter/social-builders.md
git commit -m "$(cat <<'EOF'
newsletter: add social-builders.md

X thread (5-7 tweets) + LinkedIn single-post templates. Platform-
specific CTA rules: X thread links to idea page (single external
link rule); LinkedIn uses comment-keyword pattern for newsletter
sub to preserve reach. Output file shapes mirror the newsletter
draft file pattern with frontmatter + body + checklist.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Create `video-builder.md`

**Files:**
- Create: `.claude/skills/newsletter/video-builder.md`

- [ ] **Step 1: Write the video builder file**

Create `.claude/skills/newsletter/video-builder.md` with exactly this content:

````markdown
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
````

- [ ] **Step 2: Verify the file**

Run:
```bash
wc -l .claude/skills/newsletter/video-builder.md
grep -c "^### " .claude/skills/newsletter/video-builder.md
grep -c "VERIFY STAT" .claude/skills/newsletter/video-builder.md
grep -c "voice-ali-abdaal.md" .claude/skills/newsletter/video-builder.md
```

Expected: file has 300+ lines, `### ` heading count ≥20, `VERIFY STAT` appears ≥5 times, `voice-ali-abdaal.md` referenced ≥2 times.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/newsletter/video-builder.md
git commit -m "$(cat <<'EOF'
newsletter: add video-builder.md

10-chapter, ~14-minute YouTube script template with production pack
(titles, thumbnails, B-roll, on-screen text, chapters, description,
tags, pinned comment). Chapter word budgets and Ali-voice register
checks enforced at draft time. [VERIFY STAT] marker pattern for
unsourced numeric claims.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Update `SKILL.md` with flags, Gate 2, regen commands, updated files table + handoff

**Files:**
- Modify: `.claude/skills/newsletter/SKILL.md`

This task performs multiple edits to `SKILL.md`. Each step is a single `Edit` operation. Read the file first to verify anchor strings match.

- [ ] **Step 1: Read the current SKILL.md**

Open `.claude/skills/newsletter/SKILL.md` and confirm the following anchor strings exist verbatim (from the file we reviewed):

- `description: "Drafts and dual-publishes the Weekend MVP twice-daily newsletter.` (line 3)
- `## Usage` (line 16)
- `/newsletter today                 # draft AM + PM, open both for paste` (line 19)
- `### 5. On \`draft\` — emit paste-ready markdown` (line 92 area)
- `### 6. Hand off` (line 132 area)
- `| `content/newsletter/*.md`                         | read + write (draft files) |` (files table, line 221)

If any anchor differs, update the Edit `old_string` in the following steps to match the current text.

- [ ] **Step 2: Update the `description:` frontmatter to advertise the new flags**

Edit `.claude/skills/newsletter/SKILL.md`:

**old_string:**
```
description: "Drafts and dual-publishes the Weekend MVP twice-daily newsletter. AM = Idea of the Day, PM = Builder Brief. Pairs fresh Ideabrowser MCP signals with owned ideas/articles, emits paste-ready markdown for the Beehiiv web editor, AND publishes a public archive page at weekendmvp.app/newsletter/{date}-{slot}.html with a subscribe funnel. Usage: /newsletter today (drafts both slots + publishes web). API sending to Beehiiv is disabled because POST /posts is Enterprise-only."
```

**new_string:**
```
description: "Drafts and dual-publishes the Weekend MVP twice-daily newsletter, with optional AM cross-posts (X thread, LinkedIn) and a full YouTube production pack (10-15 min script, titles, thumbnails, chapters, B-roll cues, description, tags, pinned comment) in Ali Abdaal voice. AM = Idea of the Day, PM = Builder Brief. Pairs fresh Ideabrowser MCP signals with owned ideas/articles, emits paste-ready markdown for the Beehiiv web editor, AND publishes a public archive page at weekendmvp.app/newsletter/{date}-{slot}.html with a subscribe funnel. Usage: /newsletter today (drafts both slots + publishes web). Opt in with --with-social and/or --with-video for AM downstream content. API sending to Beehiiv is disabled because POST /posts is Enterprise-only."
```

- [ ] **Step 3: Expand the Usage section**

Edit `.claude/skills/newsletter/SKILL.md`:

**old_string:**
```
## Usage

```
/newsletter today                 # draft AM + PM, open both for paste
/newsletter today --slot am       # draft AM only
/newsletter today --slot pm       # draft PM only
/newsletter stats 2026-04-20      # pull Beehiiv stats for posts sent that day
```

No arguments → treat as `today`.
```

**new_string:**
````
## Usage

```
/newsletter today                                  # draft AM + PM, open both for paste
/newsletter today --slot am                        # draft AM only
/newsletter today --slot pm                        # draft PM only
/newsletter today --with-social                    # + AM X thread + LinkedIn post
/newsletter today --with-video                     # + AM YouTube script + production pack
/newsletter today --with-social --with-video       # all downstream AM content
/newsletter today --no-web --with-social           # flags compose (skip web, make social)

# Regeneration (on an existing AM draft; no re-picking):
/newsletter social 2026-04-20                      # regen both X + LinkedIn
/newsletter social 2026-04-20 --platform x         # regen X only
/newsletter social 2026-04-20 --platform linkedin  # regen LinkedIn only
/newsletter video 2026-04-20                       # regen video pack only

/newsletter stats 2026-04-20                       # pull Beehiiv stats for posts sent that day
```

No arguments → treat as `today`.

**Flag rules:**
- `--with-social` and `--with-video` are AM-only. Passing them with `--slot pm` is an error.
- Both flags require Gate 1 to reach `draft` (the AM pick must be approved). They add a second approval step (Gate 2) for the downstream angle.
- Regen commands (`/newsletter social`, `/newsletter video`) require an existing AM draft at `content/newsletter/{date}-am.md`. They prompt on overwrite.
````

- [ ] **Step 4: Insert Gate 2 section after the existing step 5b**

Edit `.claude/skills/newsletter/SKILL.md`:

**old_string:**
```
### 6. Hand off
```

**new_string:**
````
### 5c. Gate 2 — downstream angle approval (only if `--with-social` or `--with-video`)

After step 5b completes (email markdown + web HTML written), if either downstream flag is set, the skill presents the AM idea's angle for cross-post + video. This is a second, narrower approval gate.

```
AM picked: "<idea title>"

Downstream angle for social + video:
  Hook:          <one-line hook — MCP-derived>
  Primary pain:  <one-line pain — manifest summary-derived>
  Build hook:    <buildTime>h MVP, <formatRevenue(revenueGoal)>, stack: <formatTools(tools)>
  Video promise: <one-line "by the end of this video you'll know..." — derived from Gate 1>

Reply with:  generate  |  edit hook  |  edit pain  |  edit build  |  edit promise  |  skip social  |  skip video  |  abort
```

- `generate` → emit all enabled downstream artifacts
- `edit <field>` → inline single-pass edit (mirrors Gate 1's `edit am` pattern), then re-show the panel
- `skip social` / `skip video` → suppress that artifact only; continue with the other
- `abort` → stop; email + web from step 5b remain on disk

### 5d. Emit downstream artifacts (only if Gate 2 reached `generate`)

**If `--with-social` is enabled** (and `skip social` was not chosen):
  - Follow `social-builders.md` step-by-step for each platform in `[x, linkedin]`.
  - Write `content/social/{date}-am-x.md` and `content/social/{date}-am-linkedin.md`.
  - If an output file already exists, prompt: "Overwrite `{path}`? [overwrite / backup / cancel]". `backup` renames the existing file to `{path}.bak` before writing.

**If `--with-video` is enabled** (and `skip video` was not chosen):
  - Read `voice-ali-abdaal.md` (rules) and `voice-samples.md` (anchor calibration).
  - Follow `video-builder.md` step-by-step: chapter-by-chapter script, production pack, `[VERIFY STAT]` marker count.
  - Write `content/video/{date}-am.md`.
  - Same overwrite-prompt rule as social.

### 5e. `/newsletter social {date}` and `/newsletter video {date}` (regeneration)

These commands re-run steps 5d's social or video branch against an already-drafted AM:

1. Verify `content/newsletter/{date}-am.md` exists. If not: "No AM draft found for {date}. Run `/newsletter today` first."
2. Re-derive the Gate 2 angle from the AM draft's frontmatter + BODY (no MCP re-query). Show it and allow the same `edit <field>` loop.
3. On `generate`: write the output file(s), prompting on overwrite.
4. Print a one-line handoff.

Regen never touches email markdown, web HTML, `sitemap.xml`, or `newsletter.html`. It only writes to `content/social/` or `content/video/`.

### 6. Hand off
````

- [ ] **Step 5: Update the step 6 handoff output to include downstream artifacts**

Edit `.claude/skills/newsletter/SKILL.md`:

**old_string:**
````
### 6. Hand off

Print a confirmation with both the web URLs and the Beehiiv paste steps:

```
✓ AM drafted → content/newsletter/2026-04-20-am.md
✓ PM drafted → content/newsletter/2026-04-20-pm.md
✓ Web archive generated:
    - /newsletter/2026-04-20-am.html
    - /newsletter/2026-04-20-pm.html
    - Archive feed regenerated (2 sends total)
    - Sitemap updated

Commit + push so the web archive goes live:
    git add newsletter.html newsletter/ sitemap.xml
    git commit -m "newsletter: 2026-04-20"
    git push

Then paste into Beehiiv (manual, ~90s per send):
  1. Open https://app.beehiiv.com/publications/pub_5fbc631f-.../posts
  2. New Post → Start from template "AM — Idea of the Day"
  3. Paste SUBJECT, SUBTITLE, BODY from the AM draft file
  4. (If running an ad) Insert Ad block → pick from active opportunities
  5. Schedule AM at 07:30 local
  6. Repeat for PM at 17:00 local
  7. Paste each post's ID back into the draft file's `beehiiv_post_id:`
     frontmatter so /newsletter stats can find it tomorrow.
```
````

**new_string:**
````
### 6. Hand off

Print a confirmation listing everything generated. The social and video lines only appear if those flags were set and Gate 2 reached `generate`.

```
✓ AM drafted → content/newsletter/2026-04-20-am.md
✓ PM drafted → content/newsletter/2026-04-20-pm.md
✓ Web archive generated:
    - /newsletter/2026-04-20-am.html
    - /newsletter/2026-04-20-pm.html
    - Archive feed regenerated (2 sends total)
    - Sitemap updated

[conditional — only if --with-social was enabled and generated]
✓ AM X thread  → content/social/2026-04-20-am-x.md  (6 tweets, 1,247 chars total)
✓ AM LinkedIn  → content/social/2026-04-20-am-linkedin.md  (1,247 chars)

[conditional — only if --with-video was enabled and generated]
✓ AM video     → content/video/2026-04-20-am.md  (10 chapters, 2,087 words, ~13:55)
  ⚠ 2 [VERIFY STAT] markers remain — search and replace before recording.

Commit + push so the web archive goes live:
    git add newsletter.html newsletter/ sitemap.xml
    git commit -m "newsletter: 2026-04-20"
    git push

Then paste into Beehiiv (manual, ~90s per send):
  1. Open https://app.beehiiv.com/publications/pub_5fbc631f-.../posts
  2. New Post → Start from template "AM — Idea of the Day"
  3. Paste SUBJECT, SUBTITLE, BODY from the AM draft file
  4. (If running an ad) Insert Ad block → pick from active opportunities
  5. Schedule AM at 07:30 local
  6. Repeat for PM at 17:00 local
  7. Paste each post's ID back into the draft file's `beehiiv_post_id:`
     frontmatter so /newsletter stats can find it tomorrow.

[conditional — only if social files were generated]
Social posts (manual):
    X:        https://x.com/compose/post
              Paste tweets from content/social/2026-04-20-am-x.md one at a time.
    LinkedIn: https://linkedin.com/feed/
              Paste post from content/social/2026-04-20-am-linkedin.md.

[conditional — only if video file was generated]
Video:
    Script:   content/video/2026-04-20-am.md
    Record, edit, upload — full checklist inside the file.
    Remember: verify the N [VERIFY STAT] markers before recording.
```
````

- [ ] **Step 6: Update the "Files this skill touches" table**

Edit `.claude/skills/newsletter/SKILL.md`:

**old_string:**
```
| Path                                              | Access                     |
| ------------------------------------------------- | -------------------------- |
| `ideas/manifest.json`                             | read                       |
| `articles/markdown/*.md`                          | read                       |
| `content/newsletter/*.md`                         | read + write (draft files) |
| `content/newsletter/METRICS.md`                   | append                     |
| `.claude/skills/newsletter/selection-rules.md`    | read (every run)           |
| `.claude/skills/newsletter/body-builders.md`      | read (every run)           |
| `.claude/skills/newsletter/web-publish.md`        | read (every run)           |
| `newsletter/{date}-{slot}.html`                   | write (one per send)       |
| `newsletter.html`                                 | regenerated via script     |
| `sitemap.xml`                                     | append/update per send     |
| `scripts/update-newsletter-archive.js`            | invoke                     |
| `scripts/inject-analytics.js`                     | invoke                     |
| Ideabrowser MCP tools (`mcp__ideabrowser__*`)     | call                       |
| `https://api.beehiiv.com/v2/.../posts/{id}?expand=stats` | GET (stats only)     |
```

**new_string:**
```
| Path                                                | Access                                  |
| --------------------------------------------------- | --------------------------------------- |
| `ideas/manifest.json`                               | read                                    |
| `articles/markdown/*.md`                            | read                                    |
| `content/newsletter/*.md`                           | read + write (draft files)              |
| `content/newsletter/METRICS.md`                     | append                                  |
| `.claude/skills/newsletter/selection-rules.md`      | read (every run)                        |
| `.claude/skills/newsletter/body-builders.md`        | read (every run)                        |
| `.claude/skills/newsletter/web-publish.md`          | read (every run)                        |
| `.claude/skills/newsletter/social-builders.md`      | read (runs with `--with-social` or regen) |
| `.claude/skills/newsletter/video-builder.md`        | read (runs with `--with-video` or regen)  |
| `.claude/skills/newsletter/voice-ali-abdaal.md`     | read (runs with `--with-video` or regen)  |
| `.claude/skills/newsletter/voice-samples.md`        | read (runs with `--with-video` or regen)  |
| `newsletter/{date}-{slot}.html`                     | write (one per send)                    |
| `newsletter.html`                                   | regenerated via script                  |
| `sitemap.xml`                                       | append/update per send                  |
| `content/social/{date}-am-x.md`                     | write (on `--with-social` or regen)     |
| `content/social/{date}-am-linkedin.md`              | write (on `--with-social` or regen)     |
| `content/video/{date}-am.md`                        | write (on `--with-video` or regen)      |
| `scripts/update-newsletter-archive.js`              | invoke                                  |
| `scripts/inject-analytics.js`                       | invoke                                  |
| Ideabrowser MCP tools (`mcp__ideabrowser__*`)       | call                                    |
| `https://api.beehiiv.com/v2/.../posts/{id}?expand=stats` | GET (stats only)                   |
```

- [ ] **Step 7: Update the "Critical references" section**

Edit `.claude/skills/newsletter/SKILL.md`:

**old_string:**
```
## Critical references

- Plan (original workflow): `/Users/jeberulz/.claude/plans/logical-stargazing-sutton.md`
- Plan (dual-publish extension): `/Users/jeberulz/.claude/plans/dual-publish-newsletter-archive.md`
- Beehiiv rules: `BEEHIIV_CURSOR_RULES.md` (see Section 6)
- Selection logic: `.claude/skills/newsletter/selection-rules.md`
- Email body templates (markdown): `.claude/skills/newsletter/body-builders.md`
- Web page template + markdown→HTML rules: `.claude/skills/newsletter/web-publish.md`
```

**new_string:**
```
## Critical references

- Plan (original workflow): `/Users/jeberulz/.claude/plans/logical-stargazing-sutton.md`
- Plan (dual-publish extension): `/Users/jeberulz/.claude/plans/dual-publish-newsletter-archive.md`
- Plan (cross-post + video extension): `docs/superpowers/plans/2026-04-20-newsletter-crosspost-video.md`
- Spec (cross-post + video extension): `docs/superpowers/specs/2026-04-20-newsletter-crosspost-video-design.md`
- Beehiiv rules: `BEEHIIV_CURSOR_RULES.md` (see Section 6)
- Selection logic: `.claude/skills/newsletter/selection-rules.md`
- Email body templates (markdown): `.claude/skills/newsletter/body-builders.md`
- Web page template + markdown→HTML rules: `.claude/skills/newsletter/web-publish.md`
- Social templates + platform CTA rules: `.claude/skills/newsletter/social-builders.md`
- Video script template + production pack: `.claude/skills/newsletter/video-builder.md`
- Ali Abdaal voice guide (rules): `.claude/skills/newsletter/voice-ali-abdaal.md`
- Ali Abdaal voice samples (anchors): `.claude/skills/newsletter/voice-samples.md`
```

- [ ] **Step 8: Verify all edits landed**

Run:
```bash
grep -c "with-social" .claude/skills/newsletter/SKILL.md
grep -c "with-video" .claude/skills/newsletter/SKILL.md
grep -c "Gate 2" .claude/skills/newsletter/SKILL.md
grep -c "social-builders.md" .claude/skills/newsletter/SKILL.md
grep -c "video-builder.md" .claude/skills/newsletter/SKILL.md
grep -c "voice-ali-abdaal.md" .claude/skills/newsletter/SKILL.md
grep -c "5c. Gate 2" .claude/skills/newsletter/SKILL.md
grep -c "5d. Emit downstream" .claude/skills/newsletter/SKILL.md
grep -c "5e. \`/newsletter social" .claude/skills/newsletter/SKILL.md
```

Expected: every count is ≥1. `with-social` and `with-video` should appear ≥4 times each across description, usage, handoff, and files table.

- [ ] **Step 9: Commit**

```bash
git add .claude/skills/newsletter/SKILL.md
git commit -m "$(cat <<'EOF'
newsletter: wire SKILL.md to --with-social and --with-video flags

- Expand frontmatter description to advertise cross-post + video
- Add Usage entries for flags and regen commands (/newsletter social,
  /newsletter video)
- Insert Gate 2 (5c) for downstream angle approval; 5d for artifact
  emission; 5e for regen command behavior
- Update handoff output with conditional social/video sections and
  [VERIFY STAT] count surfacing
- Expand files-touched table with new sub-modules and output paths
- Expand Critical references with new spec, plan, and sub-modules

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: End-to-end verification run

This is a manual QA task — no automated tests for a markdown-spec skill.

**Files:**
- No writes. Reads only. Output files in `content/social/` and `content/video/` are ephemeral.

- [ ] **Step 1: Regression check (existing flow unchanged)**

Invoke the skill without flags against tomorrow's date (or a test date, if today has been run):

```
/newsletter today
```

Verify:
- Gate 1 still presents AM + PM picks with the same format as before.
- On `draft`, `content/newsletter/{date}-am.md` and `content/newsletter/{date}-pm.md` are written.
- `newsletter/{date}-am.html` and `newsletter/{date}-pm.html` are written.
- `newsletter.html` and `sitemap.xml` are updated.
- No files are written to `content/social/` or `content/video/`.
- No Gate 2 appears.

If any step differs from the pre-extension behavior, the new `SKILL.md` conditional logic is wrong. Fix in SKILL.md and re-run.

Abort the run before committing the test content (or clean it up):
```bash
git checkout -- newsletter.html sitemap.xml
rm -f newsletter/{TEST-DATE}-*.html content/newsletter/{TEST-DATE}-*.md
```

- [ ] **Step 2: Full extension run**

Invoke:

```
/newsletter today --with-social --with-video
```

Verify (in order, each MUST pass):

1. **Gate 1** presents AM + PM picks as normal.
2. On `draft`, email markdown and web HTML are written (same as regression).
3. **Gate 2** appears with the 4-field angle panel and the 8 reply options from SKILL.md 5c.
4. Try `edit hook` → edit prompt appears → provide new hook → panel re-shows with new hook.
5. Reply `generate` → three new files appear:
   - `content/social/{date}-am-x.md`
   - `content/social/{date}-am-linkedin.md`
   - `content/video/{date}-am.md`
6. Open each new file and verify:
   - X file has 5-7 `### Tweet N/M  [chars: NNN]` sections.
   - Every X tweet char count is ≤280. If any shows `[OVER BY N CHARS — EDIT]`, note it — that's expected overflow behavior, not a failure, but flag for review.
   - X file has exactly one URL in tweet 6 (the idea page URL with `utm_source=x`).
   - LinkedIn file has a `## LINKEDIN POST [chars: NNNN]` header with count between 1,000 and 2,800.
   - Video file has all 10 `### N. <Chapter>` sections and a `## PRODUCTION CHECKLIST` at the bottom.
   - Video file frontmatter has `verify_stat_count: N` matching the actual number of `[VERIFY STAT]` markers in the body.
7. Handoff output lists all 5 files (2 newsletter + 2 web + 1 video... wait — 2 newsletter MD + 2 web HTML + 2 social + 1 video = 7 artifacts). Check the conditional social/video lines appear.

- [ ] **Step 3: Voice calibration spot-check (video)**

Open `content/video/{date}-am.md` and verify against `voice-ali-abdaal.md` "Register checks":

1. Chapter 1 (cold open) opens cold — no "welcome back" yet.
2. Chapter 2 starts **exactly** with `Hey friends, welcome back to the channel.`
3. Chapter 2 contains a numbered 3-item roadmap using "One — Two — Three —" phrasing.
4. Every numeric claim in chapters 3, 4, 6, 7 is either sourced (named study/company) or marked `[VERIFY STAT: ...]`.
5. At least one named framework/phrase appears.
6. Exactly one self-deprecating aside appears somewhere.
7. Chapter 9 opens with `The single most important thing you can do right now is`.
8. Chapter 10 ends with `I'll see you in the next one.`
9. No paragraph in any chapter is longer than 4 sentences.

If any check fails, the voice module isn't being read correctly. Debug: re-read `voice-ali-abdaal.md` and ensure SKILL.md 5d lists it as a required read for `--with-video`.

- [ ] **Step 4: Regen exercise**

Invoke:

```
/newsletter social {date} --platform x
```

Verify:

1. Skill reads the existing AM draft (no MCP call).
2. Gate 2 angle panel appears, pre-filled from the previous run's draft.
3. On `generate`, overwrite prompt fires for `content/social/{date}-am-x.md`.
4. Reply `backup` → file is renamed to `content/social/{date}-am-x.md.bak`, new file is written.
5. `content/social/{date}-am-linkedin.md` and `content/video/{date}-am.md` are untouched (mtime unchanged).
6. Handoff lists only the X file.

- [ ] **Step 5: Skip-path check**

Invoke:

```
/newsletter today --with-social --with-video
```

At Gate 2, reply `skip video`. Verify:
- Social files are written.
- Video file is NOT written.
- Handoff lists social lines but not the video line.

Then reply `skip social skip video` in a fresh Gate 2 (or simulate by running again with both skips). Verify no downstream files are written, handoff omits both sections.

- [ ] **Step 6: AM-only enforcement**

Invoke:

```
/newsletter today --slot pm --with-social
```

Expected: error message before any work — "Social/video flags are AM-only. Remove --slot pm or drop --with-social." Skill exits cleanly. No files written.

- [ ] **Step 7: Clean up test artifacts**

After all verifications pass, remove the test-run files so they don't pollute:

```bash
# Remove test-run drafts (all gitignored, but tidy up)
rm -f content/newsletter/{TEST-DATE}-*.md
rm -f content/social/{TEST-DATE}-*
rm -f content/video/{TEST-DATE}-*

# Revert archive/sitemap if the test run touched them
git checkout -- newsletter.html sitemap.xml

# Remove web HTML the test generated (if any committed by accident)
git clean -n newsletter/
# review the list, then:
git clean -f newsletter/{TEST-DATE}-*.html 2>/dev/null || true
```

- [ ] **Step 8: No-op commit to close out the task**

All verification passed, nothing to commit for Task 7 itself. Confirm clean worktree:

```bash
git status
```

Expected: `nothing to commit, working tree clean` (modulo legitimate non-test changes).

---

## Completion checklist (self-review after all tasks)

After Task 7 passes, verify all spec requirements are implemented:

- [ ] `--with-social` flag → AM X thread + LinkedIn post (Tasks 1, 4, 6)
- [ ] `--with-video` flag → AM video pack (Tasks 1, 5, 6)
- [ ] Flags compose with each other and with `--no-web` (Task 6 Usage section)
- [ ] AM-only enforcement on flags (Task 6 flag rules + Task 7 Step 6)
- [ ] Two-gate approval structure (Task 6 step 4)
- [ ] Gate 2 angle editing and skip options (Task 6 step 4)
- [ ] X thread rules: 5-7 tweets, one external link, no hashtags, 280-char enforcement (Task 4)
- [ ] LinkedIn post rules: 1,000-1,500 char target, comment-keyword CTA (Task 4)
- [ ] Video: 10 chapters, ~2,100 words, target ~14 min (Task 5)
- [ ] Video production pack: titles, thumbnails, chapters, B-roll, on-screen text, description, tags, pinned comment (Task 5)
- [ ] Ali Abdaal voice: opener, roadmap, transitions, closing formula, sign-off, hype avoidance (Task 2)
- [ ] Voice samples seeded with 3 anchors (Task 3)
- [ ] `[VERIFY STAT]` marker convention + count in frontmatter + handoff warning (Tasks 5, 6)
- [ ] Output paths `content/social/` and `content/video/`, gitignored with .gitkeep (Task 1)
- [ ] Regen commands `/newsletter social {date}` and `/newsletter video {date}` (Task 6 step 4)
- [ ] Overwrite prompt (overwrite / backup / cancel) on existing output files (Tasks 4, 5, 6)
- [ ] Handoff output updated with conditional social/video sections (Task 6 step 5)
- [ ] Files-touched table updated with new sub-modules and output paths (Task 6 step 6)
- [ ] Critical references updated with new spec, plan, and sub-modules (Task 6 step 7)
- [ ] End-to-end + regression + regen + skip + enforcement tests all pass (Task 7)

If any box is unchecked after Task 7, revisit the implementing task, fix, and re-verify.

---

## Out of scope (per spec)

Do NOT implement any of the following in this plan:

- PM cross-posting or PM video scripts (AM only)
- Automated posting to X, LinkedIn, or YouTube (all manual paste)
- Multi-language drafts
- Thumbnail image generation (concepts remain text-described)
- Feeding YouTube/X/LinkedIn analytics back into selection scoring
- A/B subject line variants (separate future improvement)

If during implementation you feel pulled toward any of these, stop and flag it for a follow-up spec.
