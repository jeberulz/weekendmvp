# Newsletter Cross-Post + Video Extension — Design Spec

**Date:** 2026-04-20
**Status:** Approved, pending implementation plan
**Owner:** John (hello@switchtoux.com)
**Extends:** `.claude/skills/newsletter/` (existing `/newsletter today` workflow)

---

## Problem

The `/newsletter today` skill currently produces two inbox sends and two public web archive pages per day. Each AM "Idea of the Day" deserves broader distribution: an X thread, a LinkedIn post, and a 10-15 minute YouTube video. Today, writing those artifacts is ad-hoc, time-consuming, and inconsistent in voice.

## Goal

Extend the existing skill so one command can emit the newsletter **plus** social posts **plus** a full YouTube production pack for the AM idea — in a single author-in-the-loop session — while preserving the existing flow when the new features aren't invoked.

## Non-goals (v1)

- PM cross-posting or PM video scripts (AM only)
- Automated posting to X/LinkedIn/YouTube (all manual paste)
- Multi-language output
- Thumbnail image generation (concepts as text only)
- Feeding social/YouTube analytics back into selection scoring
- A/B subject line variants

---

## Decisions (all user-approved via brainstorming)

1. **Trigger:** opt-in flags — `/newsletter today --with-social --with-video`
2. **Scope:** AM only (Idea of the Day). PM Builder Brief unchanged.
3. **Social shape:** X thread (5-7 tweets) + single LinkedIn post (~1,000-1,500 chars)
4. **CTA direction:** platform-specific
   - X thread → idea page (the one external link in the thread)
   - LinkedIn → newsletter subscribe (on-platform reach preserved)
   - Video → mid-roll newsletter + end-screen idea page
5. **Video depth:** "ultraplan" — full word-for-word script **plus** production pack (titles, thumbnails, B-roll cues, on-screen text, chapters, description, tags, pinned comment)
6. **Voice:** hybrid — built-in `voice-ali-abdaal.md` style guide + curated `voice-samples.md` anchors (3 seed samples; user appends over time)
7. **File layout:** separate folders, gitignored — `content/social/` and `content/video/`
8. **Approval gate:** two gates — Gate 1 (existing) approves picks; Gate 2 (new) approves the downstream "angle" for social + video
9. **Architecture:** extend the existing `newsletter` skill with new sub-modules; SKILL.md delegates, new files hold template/voice knowledge

---

## Architecture

### Commands

```
/newsletter today                                  # unchanged
/newsletter today --with-social                    # + AM X thread + LinkedIn post
/newsletter today --with-video                     # + AM video script + production pack
/newsletter today --with-social --with-video       # both
/newsletter today --no-web --with-social           # composable with existing flags

# Regeneration (existing AM draft required):
/newsletter social 2026-04-20                      # regen both social platforms
/newsletter social 2026-04-20 --platform x         # regen X only
/newsletter social 2026-04-20 --platform linkedin  # regen LinkedIn only
/newsletter video 2026-04-20                       # regen video only
```

### Flow

```
User: /newsletter today --with-social --with-video
  │
  ├─ Load context (manifest, articles, recent drafts)
  ├─ Pull MCP signals (Ideabrowser)
  ├─ Apply selection-rules.md
  │
  ▼
Gate 1 (existing): approve AM + PM picks
  │ → user: draft
  ▼
Write content/newsletter/{date}-am.md + {date}-pm.md
Write newsletter/{date}-am.html + {date}-pm.html  (unless --no-web)
Update newsletter.html archive + sitemap.xml
  │
  ├─ if not (--with-social or --with-video): DONE
  │
  ▼
Gate 2 (new): present AM downstream angle
  │  Editable fields: hook, pain, build hook, video promise
  │ → user: generate
  ▼
if --with-social:
  Write content/social/{date}-am-x.md
  Write content/social/{date}-am-linkedin.md
if --with-video:
  Write content/video/{date}-am.md
  │
  ▼
Print unified handoff (git commit, Beehiiv paste, X paste, LinkedIn paste, video record)
```

### Files & modules

**Existing skill files (unchanged content, SKILL.md grows):**

| File | Role |
|------|------|
| `.claude/skills/newsletter/SKILL.md` | Top-level flow; adds Gate 2 section + regen command docs |
| `.claude/skills/newsletter/selection-rules.md` | Unchanged |
| `.claude/skills/newsletter/body-builders.md` | Unchanged |
| `.claude/skills/newsletter/web-publish.md` | Unchanged |

**New skill files:**

| File | Role |
|------|------|
| `.claude/skills/newsletter/social-builders.md` | X thread + LinkedIn templates, CTA rules, char-count discipline |
| `.claude/skills/newsletter/video-builder.md` | Video chapter anatomy, production pack shape, file output contract |
| `.claude/skills/newsletter/voice-ali-abdaal.md` | Built-in style guide — opener, roadmap, transitions, CTA tone, closing formula |
| `.claude/skills/newsletter/voice-samples.md` | 3 seed anchor samples; user appends over time |

**New output files (per run, gitignored):**

| Path | Written when |
|------|--------------|
| `content/social/{date}-am-x.md` | `--with-social` flag (or regen) |
| `content/social/{date}-am-linkedin.md` | `--with-social` flag (or regen) |
| `content/video/{date}-am.md` | `--with-video` flag (or regen) |

**One-time setup:**

- Append to `.gitignore`: `content/social/` and `content/video/`
- Create `content/social/.gitkeep` and `content/video/.gitkeep` (committed)

---

## Social artifact specs

### X thread — 5-7 tweets

| Tweet | Role | Constraint |
|-------|------|------------|
| 1/N | Hook | ≤280 chars. Surprising stat / contrarian take / specific scenario. Ends with "🧵". |
| 2/N | Pain | ≤280 chars. Visceral single-customer moment. |
| 3/N | Idea | ≤280 chars. Name product. One-line value prop. |
| 4/N | Build | ≤280 chars. Time, money, stack. Makes "weekend" literal. |
| 5/N | Who for (optional, compress into 4 if tight) | ≤280 chars. Specific buyer. |
| 6/N | Primary CTA | ≤280 chars. **Only** external link in the thread — idea page with X UTM. |
| 7/N | Soft subscribe close | ≤280 chars. Zero links. Reply-to-DM signup pattern. |

**Constraints:**
- Total thread ≤7 tweets
- Exactly one external link across the thread (tweet 6)
- No hashtags, minimal emoji
- Every tweet standalone-readable (engagement may surface only one)

### LinkedIn post — single post, ~1,000-1,500 chars

**Structure:** hook line → story beat (2-3 sentences) → named idea → build proof (4 bullets) → who-for (1-2 lines) → primary CTA (newsletter sub via "comment KEYWORD" pattern) → soft secondary (text-only site reference).

**Constraints:**
- Generous blank lines (LinkedIn collapses doubles to singles)
- Zero or one link in body (the "search for it" close avoids link penalty)
- Max 5 hashtags at bottom or zero (start with zero; A/B over time)
- Zero hype language, zero emoji except `→` as bullet markers

### Social output file shape

Both files share frontmatter + body section + checklist pattern mirroring newsletter draft files:

```markdown
---
date: YYYY-MM-DD
slot: am
platform: x | linkedin
idea_slug: <slug>
cta_url: <full URL with platform UTM>
x_thread_id | linkedin_post_id: null
---

## {X THREAD | LINKEDIN POST}

### Tweet N/M  [chars: NNN]   (X only; LinkedIn shows one total char count)
<body>

## CHECKLIST
- [ ] <paste steps>
```

### Character counting

The skill prints per-tweet char counts inline and total for LinkedIn. Auto-retry compression up to 2 times on overages; 3rd attempt ships with `[OVER BY N CHARS — EDIT]` marker rather than blocking the run.

---

## Video artifact spec

### Anatomy — 10 chapters, target ~14 min

| # | Chapter | Duration | Word budget | Purpose |
|---|---------|----------|-------------|---------|
| 1 | Cold open | 0:00-0:45 | 90-110 | Works muted. Vivid scenario or surprising stat. |
| 2 | Welcome + roadmap | 0:45-1:15 | 60-75 | "Hey friends, welcome back" + 3 explicit promises. |
| 3 | The problem | 1:15-3:00 | 250-300 | Anecdote → category → evidence (named source). |
| 4 | The idea | 3:00-5:30 | 350-400 | Name product. Value prop. First-time-user walkthrough. |
| 5 | Mid-roll CTA | 5:30-6:00 | 60-80 | Soft newsletter sub. |
| 6 | The build | 6:00-9:30 | 450-525 | Stack, hour-by-hour, verbatim key prompts. The meat. |
| 7 | The money | 9:30-11:00 | 200-250 | Pricing, path to $1K/mo, honest caveats. |
| 8 | Pitfalls | 11:00-12:30 | 200-250 | 2-3 failure modes + sidesteps. |
| 9 | Action step | 12:30-13:30 | 130-150 | "Single most important thing right now is..." (one micro-action) |
| 10 | Outro | 13:30-14:30 | 120-150 | End-screen CTAs, 2-sentence recap, "I'll see you in the next one." |

**Total: ~1,900-2,300 words, ~14 minutes @ 150 WPM. Fits the 10-15 min target band.**

### Production pack (shipped inline with script)

- 3 title options
- 3 thumbnail concepts (text-described, not generated)
- YouTube chapter list (timestamps + chapter titles)
- B-roll cues by timestamp
- On-screen text callouts by timestamp
- 200-word YouTube description
- Tags block (plain text, comma-separated)
- Pinned comment draft
- Production checklist

### Video output file shape

Full layout in `video-builder.md`. Key sections: frontmatter (date, idea_slug, target_duration, CTA map, UTM, `youtube_video_id: null`) → TITLE OPTIONS → THUMBNAIL CONCEPTS → SCRIPT (10 chapters, verbatim) → CHAPTERS → B-ROLL CUES → ON-SCREEN TEXT → YOUTUBE DESCRIPTION → TAGS → PINNED COMMENT → PRODUCTION CHECKLIST.

### `[VERIFY STAT]` markers

When the script claims a stat without a named source in MCP output, the skill inlines `[VERIFY STAT: <claim>]`. Handoff warns how many markers remain. Does not block generation — forces manual verification before recording.

---

## Voice module

### `voice-ali-abdaal.md` — built-in style guide

Enforced rules (table inside the file):

| Element | Rule |
|---------|------|
| Opener | "Hey friends, welcome back to the channel." Literal. |
| Roadmap | Chapter 2 always has "In this video I'll show you [3 promises]" — numbered, specific. |
| Frameworks | Give things names. "The 8-Hour Stack." "The Three-Prompt Build." Acronyms OK. |
| Evidence | Claims get sources. "According to [named source]..." > "studies show." Unsourced claims → `[VERIFY STAT]`. |
| Transitions | "The thing is..." / "Here's where it gets interesting..." / "Let me show you what I mean." 2-3 per script. |
| Enthusiasm | Genuine, not hype. No caps. |
| Self-deprecation | One small aside per script. |
| CTA energy | Soft. "If you're finding this useful..." > "Smash that subscribe." |
| Closing formula | "The single most important thing you can do right now is..." (one concrete micro-action) |
| Sign-off | "I'll see you in the next one." Literal. |
| Pacing | Short sentences. Declaratives. Frequent paragraph breaks. |

### `voice-samples.md` — anchor examples

File ships with 3 seed samples (cold open, mid-roll CTA, closing action step). Documented format — user appends their own favorites over time. The skill reads both files at draft time; neither is copy-pasted verbatim — they're calibration references.

---

## Gate 2 — downstream angle approval

Triggered only when `--with-social` or `--with-video` is set AND Gate 1 reached `draft`.

Presentation:
```
AM picked: "<idea title>"

Downstream angle for social + video:
  Hook:          <one-line hook>
  Primary pain:  <one-line pain>
  Build hook:    <time + revenue + stack>
  Video promise: <one-line "by the end of this video you'll know...">

Reply with:  generate  |  edit hook  |  edit pain  |  edit build  |  edit promise  |  skip social  |  skip video  |  abort
```

- `generate` → emit all enabled artifacts
- `edit <field>` → inline edit that field, re-show panel
- `skip social` / `skip video` → suppress that artifact only; continue with the other
- `abort` → stop; email + web already written (Gate 1 completed) remain on disk

---

## Edge cases

| Case | Behavior |
|------|----------|
| Gate 1 aborts | No Gate 2. Nothing written. |
| `--with-social --slot pm` | Warn and exit: social/video are AM-only. |
| `skip social` + `skip video` in Gate 2 | Silent close. Equivalent to no flags. |
| `abort` at Gate 2 | Email + web remain. Suggest regen commands. |
| Empty `voice-samples.md` | OK. Skill uses `voice-ali-abdaal.md` alone. One-line hint in handoff. |
| `[VERIFY STAT]` markers remain | Warn with count. Does not block. |
| Tweet > 280 chars after draft | Auto-retry compression ×2. If still over, ship with `[OVER BY N CHARS — EDIT]` marker. |
| LinkedIn > 2,800 chars | Truncate to last complete paragraph under 2,800 preserving CTA. |
| Regen: no AM draft exists for date | Error: "No AM draft found at `content/newsletter/{date}-am.md`." |
| Regen: target file exists | Prompt: overwrite / backup (renames to `.bak`) / cancel. |
| MCP failure during Gate 1 | Unchanged (owned-only fallback). |
| AM manifest missing `tools[]` or `buildTime` | Warn before Gate 2: "Build chapter will be thin. Proceed?" |
| User swaps AM at Gate 1 mid-flow | Impossible by design — Gate 2 strictly follows `draft`. |

---

## Idempotency

- All new write actions check-and-prompt on overwrite.
- Regen commands read from `content/newsletter/{date}-am.md` (not `manifest.json`) — regen stays aligned with what was actually drafted, not what's current.
- Sitemap, archive, and Beehiiv-side state untouched by regen (they're email/web-specific).

---

## Testing

No automated tests (matches existing newsletter skill pattern — deterministic markdown + author-in-the-loop review is the QA layer).

**Manual verification on first run:**

1. **End-to-end** — run `/newsletter today --with-social --with-video` on next day's content. Verify:
   - All 3 new files written to correct paths
   - Character counts in tweet headers match actual tweet content
   - Video script chapters hit word budgets within ±20%
   - Voice calibration matches seed samples (no generic "YouTuber" slippage)
2. **Regression** — immediately run `/newsletter today` (no flags). Confirm no change in existing AM/PM email/web output.
3. **Regen** — run `/newsletter social {date} --platform x`. Confirm X file rewritten, LinkedIn/video untouched, overwrite prompt fires.

---

## Documentation updates

- `.claude/skills/newsletter/SKILL.md` — adds Gate 2, regen commands, updated files-touched table, updated handoff output. Target growth: ~80 lines.
- New files: `social-builders.md`, `video-builder.md`, `voice-ali-abdaal.md`, `voice-samples.md`.
- `.gitignore` — append `content/social/` and `content/video/`.
- `content/social/.gitkeep` and `content/video/.gitkeep` — committed.

Root `CLAUDE.md` and `BEEHIIV_CURSOR_RULES.md` require no changes (skill-internal changes only).

---

## Implementation notes

- `voice-samples.md` ships with the 3 seed samples shown in the design (cold open, mid-roll CTA, closing action step). User can prune or append.
- Gate 2 editing mirrors the existing Gate 1 `edit am` pattern — single-pass inline edit, re-show the panel, no state machine.
- Regen overwrite prompt is author-in-the-loop text, not code: three-choice question (overwrite / backup / cancel). `backup` renames the existing file to `{name}.bak` before writing.
- Char counts shown in tweet headers (e.g., `[chars: 247]`) are computed fresh at draft time, not trusted from the LLM's own counting — the skill counts the rendered string length in UTF-16 code units (matches Twitter's counting semantics for basic Latin; links and emoji may differ, documented in `social-builders.md`).

---

## References

- Existing skill: `.claude/skills/newsletter/`
- Existing skill entry: `.claude/skills/newsletter/SKILL.md`
- Selection logic: `.claude/skills/newsletter/selection-rules.md`
- Email templates: `.claude/skills/newsletter/body-builders.md`
- Web publish: `.claude/skills/newsletter/web-publish.md`
- Project guide: `CLAUDE.md`
- Beehiiv rules: `BEEHIIV_CURSOR_RULES.md`
