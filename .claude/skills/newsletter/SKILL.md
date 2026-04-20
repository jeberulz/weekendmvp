---
name: newsletter
description: "Drafts and dual-publishes the Weekend MVP twice-daily newsletter, with optional AM cross-posts (X thread, LinkedIn) and a full YouTube production pack (10-15 min script, titles, thumbnails, chapters, B-roll cues, description, tags, pinned comment) in Ali Abdaal voice. AM = Idea of the Day, PM = Builder Brief. Pairs fresh Ideabrowser MCP signals with owned ideas/articles, emits paste-ready markdown for the Beehiiv web editor, AND publishes a public archive page at weekendmvp.app/newsletter/{date}-{slot}.html with a subscribe funnel. Usage: /newsletter today (drafts both slots + publishes web). Opt in with --with-social and/or --with-video for AM downstream content. API sending to Beehiiv is disabled because POST /posts is Enterprise-only."
---

# Newsletter Skill

Author-in-the-loop workflow for the Weekend MVP twice-daily newsletter. One morning session drafts both sends AND publishes them to the public web archive — the skill handles research, selection, subject lines, body copy, HTML page generation, and feed updates. You paste the markdown into Beehiiv, pick ads in the dashboard, and schedule delivery manually.

**Why paste instead of API send:** Beehiiv's `POST /v2/publications/{id}/posts` endpoint is Enterprise-only (`SEND_API_NOT_ENTERPRISE_PLAN`). Confirmed by curl pre-flight on 2026-04-19. If you upgrade to Enterprise later, see "Future: re-enable API send" at the bottom of this file.

**Dual publish:** Every `/newsletter today` run now ALSO generates static HTML archive pages at `newsletter/{date}-{slot}.html` and refreshes the feed at `newsletter.html`. Email subscribers get the inbox push; the web archive drives SEO + acts as a top-of-funnel for new subscribers via the inline form on every page. See `web-publish.md` for the template + conversion rules.

---

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

---

## Configured defaults

- **AM slot (schedule manually in Beehiiv):** 07:30 local (America/New_York)
- **PM slot (schedule manually in Beehiiv):** 17:00 local (America/New_York)
- **Publication ID (for stats lookups):** `pub_5fbc631f-7950-4bac-80fe-80ba70dae2da`
- **Beehiiv dashboard URL:** https://app.beehiiv.com/publications/pub_5fbc631f-7950-4bac-80fe-80ba70dae2da/posts

---

## Pre-flight (once)

1. Confirm `ideas/manifest.json` has a `summary` field per idea. If not, run `node scripts/build-newsletter-index.js`.
2. Configure Beehiiv dashboard → Publication Settings → Theme: wordmark PNG, accent color, footer links, "from name = Weekend MVP". This controls the email shell.
3. In Beehiiv, create a post template named "AM — Idea of the Day" and "PM — Builder Brief" with your preferred header/footer blocks. You'll clone from these each day.

---

## The `/newsletter today` flow

### 1. Load context

- Read `ideas/manifest.json` → ideas with `summary`, `category`, `buildTime`, `revenueGoal`, `tools`, `audiences`.
- Read `articles/markdown/*.md` → frontmatter (title, date, slug).
- Read last 14 sends from `content/newsletter/` (`YYYY-MM-DD-*.md`) → recently-featured slugs to avoid repeats within 14 days.

### 2. Pull fresh signals from Ideabrowser MCP

AM candidates:
- `mcp__ideabrowser__browse_platform_trends({ limit: 8 })`
- `mcp__ideabrowser__browse_ideas({ sortBy: "newest", limit: 10 })`

PM candidates (only if today's rotation needs MCP flavor; see `selection-rules.md`):
- `mcp__ideabrowser__research_market_insight({...})` for a stat/quote
- `mcp__ideabrowser__get_trend(...)` for topic context

Apply `selection-rules.md` to pick AM + PM payloads.

### 3. Present picks for approval (text only, no body yet)

```
AM — Idea of the Day
  Fresh hook (MCP):  <1-sentence summary of trend/idea>
  Owned payload:     ideas/<slug>.html  "<title>"
  Subject:           Idea of the Day: <title>
  Scheduled (you):   2026-04-20 07:30 local (America/New_York)

PM — Builder Brief  (rotation: <Monday article | Tuesday tool | …>)
  Fresh angle (MCP): <1-sentence>
  Owned payload:     articles/<slug>.md  "<title>"   (or ideas/<slug>.html)
  Subject:           Builder Brief: <topic> →
  Scheduled (you):   2026-04-20 17:00 local (America/New_York)

Reply with:  draft  |  swap am  |  swap pm  |  edit am  |  edit pm  |  abort
```

Never write body copy before this step.

### 4. On swap or edit

- `swap am|pm` → re-pick that slot (next-best candidate). Re-show summary.
- `edit am|pm` → inline edit of subject, hook, or CTA copy. Apply, re-show.
- Loop until user says `draft` or `abort`.

### 5. On `draft` — emit paste-ready markdown

Use `body-builders.md` to turn each pick into paste-ready markdown. Write two files:

- `content/newsletter/YYYY-MM-DD-am.md`
- `content/newsletter/YYYY-MM-DD-pm.md`

Each file has:
1. **Frontmatter** — metadata (slot, subject, subtitle, scheduled_at, cta_url, beehiiv_post_id placeholder)
2. **A `## SUBJECT` section** — paste into Beehiiv's Subject field
3. **A `## SUBTITLE` section** — paste into Beehiiv's Preview Text / Subtitle field
4. **A `## BODY (paste into Beehiiv editor)` section** — full markdown body. Beehiiv's editor converts markdown on paste into blocks (headings → heading blocks, paragraphs → paragraph blocks, `[button]()` → button blocks).
5. **A `## BEEHIIV CHECKLIST` section** — the manual steps the user takes in the Beehiiv UI.

### 5b. Publish to web archive

Every send becomes a public page at `weekendmvp.app/newsletter/{date}-{slot}.html`. Full template + conversion rules: `web-publish.md`.

For each slot:
1. Parse the draft's frontmatter + BODY section (between `## BODY (paste into Beehiiv editor)` and `## BEEHIIV CHECKLIST`).
2. Convert BODY markdown → HTML (deterministic rules in `web-publish.md`).
3. Render the page template from `web-publish.md` with placeholder substitution.
4. Write to `newsletter/{date}-{slot}.html`.

Once both slots are written, run:
```
node scripts/update-newsletter-archive.js     # regenerates newsletter.html card grid + ItemList
node scripts/inject-analytics.js newsletter/{date}-am.html newsletter/{date}-pm.html
```

Then update `sitemap.xml`:
- Add a `<url>` entry per new page (idempotent — skip if `<loc>` already exists; update `<lastmod>` otherwise).
- Bump the existing `newsletter.html` entry's `<lastmod>` to today.

Hard rules:
- **Do not commit the draft `.md` files.** They're gitignored.
- Web HTML has no Beehiiv ad block and no BEEHIIV CHECKLIST — those are email-/operator-only.
- Email markdown and web HTML share the same BODY content — the web page is the email, rendered.

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

### 7. `--dry-run` mode (default-safe)

There is no separate dry-run anymore — the skill **never** sends email. Every `/newsletter today` call ends with markdown files + web HTML on disk; sending is always manual. If the user passes `--no-web`, skip step 5b entirely (drafts only, no HTML generated, no archive refresh, no sitemap update).

---

## `/newsletter stats YYYY-MM-DD`

- Read the two draft files for that date. Pull `beehiiv_post_id` from frontmatter.
- If a `beehiiv_post_id` is missing, prompt: "AM post ID not set — paste it after scheduling in Beehiiv. Stats skipped for this slot."
- For each present ID: `GET https://api.beehiiv.com/v2/publications/{pub}/posts/{post_id}?expand=stats`. The GET endpoint is available on all tiers (only POST is Enterprise-gated).
- Append one row per slot to `content/newsletter/METRICS.md`.
- Watch-list warnings: open rate <30% on AM for 3+ days, or CTR <2% on PM for 5+ days.

The stats call needs `BEEHIIV_API_KEY`. Read it from `.env.local` (gitignored). If the key isn't found locally, tell the user and exit rather than exposing it elsewhere.

---

## Rotation rules (PM Builder Brief)

| Day of week | Shape                                            | Source                                                           |
| ----------- | ------------------------------------------------ | ---------------------------------------------------------------- |
| Monday      | Owned article deep-link + fresh hook             | `articles/markdown/*.md` (newest unsent)                         |
| Tuesday     | Tool spotlight                                   | Any idea's `tools[]` entry + MCP commentary                      |
| Wednesday   | Evergreen idea deep dive                         | Oldest idea not featured in last 60 days                         |
| Thursday    | Behind-the-build (tech stack + AI build prompts) | Any idea's "Tech Stack" + "Build Prompts" sections               |
| Friday      | Weekly recap of that week's AM picks             | `content/newsletter/*-am.md` for Mon–Thu                         |
| Sat/Sun     | _No send_                                        | —                                                                |

---

## Subject line formulas

- AM: `Idea of the Day: {title}` (≤65 chars; trim title if needed)
- PM:
  - Mon: `Builder Brief: {article_title} →`
  - Tue: `Builder Brief: {tool_name} in 10 minutes`
  - Wed: `Builder Brief: {idea_title} (deep dive)`
  - Thu: `Builder Brief: How to build {idea_title}`
  - Fri: `Builder Brief: This week's 4 ideas`

Subtitle / preview text: first sentence of the hook, ≤120 chars.

---

## Do / Don't

- **Do** call MCP tools at the start of every `/newsletter today` run. Cached picks from yesterday are stale.
- **Do** avoid repeating the same `slug` within 14 days — check draft history in `content/newsletter/`.
- **Don't** generate body copy before the user approves picks.
- **Don't** try to POST to Beehiiv — the endpoint is Enterprise-only. Always emit markdown for manual paste.
- **Don't** fabricate stats. If `beehiiv_post_id` is missing from a draft file, skip that row in METRICS.md and tell the user.

---

## Files this skill touches

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

---

## Future: re-enable API send

If the publication is upgraded to Enterprise, everything needed to send programmatically still exists in git history under `api/newsletter/send.js` (removed 2026-04-19 commit). Restore it, add `NEWSLETTER_SEND_SECRET` to Vercel env, and change step 6 of this skill from "emit markdown" back to "POST to /api/newsletter/send with a blocks array". Keep the body-builders file either way — paste and API both need clean source content.

---

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
