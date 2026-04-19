# Weekend MVP Newsletter

Dated drafts + ledger for the twice-daily newsletter. Plan lives at `/Users/jeberulz/.claude/plans/logical-stargazing-sutton.md`.

## How sending works (dual publish)

Every `/newsletter today` run produces **two outputs per slot**:

1. **Markdown draft** → `content/newsletter/YYYY-MM-DD-{am,pm}.md` (gitignored) — paste into Beehiiv's web editor + schedule send
2. **Web archive page** → `newsletter/YYYY-MM-DD-{am,pm}.html` (committed to git) — lives at `weekendmvp.app/newsletter/YYYY-MM-DD-{am,pm}.html`; has a subscribe form for web readers; deploys via Vercel

**Why paste, not API:** Beehiiv's `POST /v2/publications/{id}/posts` endpoint is Enterprise-only (`SEND_API_NOT_ENTERPRISE_PLAN`). The skill generates paste-ready markdown; you paste into the Beehiiv dashboard manually (~90 sec).

**Web archive publishes immediately** when you commit + push — email and web go live independently. Email subscribers get the inbox push on schedule; the web page starts accumulating SEO + serving as a subscribe funnel from the moment it deploys.

## Slots


| Slot | Local time | Job                      |
| ---- | ---------- | ------------------------ |
| AM   | 07:30 ET   | Idea of the Day          |
| PM   | 17:00 ET   | Builder Brief (rotation) |


Override per-send with `--am HH:MM` / `--pm HH:MM` (local) when running the skill.

## UTM convention

All CTAs back to weekendmvp.app carry:

```
?utm_source=beehiiv&utm_medium=newsletter&utm_campaign={slot}-{YYYYMMDD}
```

Example: `?utm_source=beehiiv&utm_medium=newsletter&utm_campaign=am-20260420`

## Files in this directory


| File                    | Committed | Purpose                                                     |
| ----------------------- | --------- | ----------------------------------------------------------- |
| `README.md`             | yes       | This file.                                                  |
| `METRICS.md`            | yes       | Rolling open/click stats appended by `/newsletter stats`.   |
| `YYYY-MM-DD-{am,pm}.md` | **no**    | Per-send draft. Gitignored so unsent content stays private. |


## Day-of flow

```bash
/newsletter today              # drafts AM + PM markdown + web HTML + refreshes feed
/newsletter today --slot am    # AM only
/newsletter today --no-web     # drafts only; skip web HTML generation
/newsletter stats 2026-04-20   # pulls yesterday's Beehiiv stats into METRICS.md
```

After running, commit + push the web archive:

```bash
git add newsletter.html newsletter/ sitemap.xml
git commit -m "newsletter: YYYY-MM-DD"
git push
```

Vercel auto-deploys in ~30s → pages live at `weekendmvp.app/newsletter/*`.

## Paste workflow (90 sec per send)

1. Open [https://app.beehiiv.com/publications/pub_5fbc631f-7950-4bac-80fe-80ba70dae2da/posts](https://app.beehiiv.com/publications/pub_5fbc631f-7950-4bac-80fe-80ba70dae2da/posts)
2. New Post → start from your saved template ("AM — Idea of the Day" or "PM — Builder Brief")
3. Open the draft file (`content/newsletter/YYYY-MM-DD-am.md` or `-pm.md`)
4. Copy **SUBJECT** → paste into Title field
5. Copy **SUBTITLE** → paste into Subtitle / preview text field
6. Copy the block between `## BODY (paste into Beehiiv editor)` and `## BEEHIIV CHECKLIST` → paste into the editor body. Beehiiv converts markdown → blocks on paste.
7. (If running an ad) Beehiiv → Monetize → Ad Network → insert active opportunity block between payload and CTA
8. Schedule → pick the slot time (AM 07:30 / PM 17:00 local)
9. Copy the new post's ID from the URL (`…/posts/post_abc123`) back into the draft file's frontmatter: `beehiiv_post_id: "post_abc123"` — this lets `/newsletter stats` find it tomorrow

## Draft file shape

```markdown
---
date: 2026-04-20
slot: am
title: "Idea of the Day: AI Meeting Notes Cleaner"
subtitle: "A $1K/mo weekend build that cleans up Zoom transcripts"
scheduled_at_local: "2026-04-20 07:30 America/New_York"
cta_url: "https://weekendmvp.app/ideas/ai-meeting-notes-cleaner.html?utm_source=beehiiv&..."
beehiiv_post_id: null   # set after scheduling in Beehiiv UI
---

## SUBJECT
…

## SUBTITLE
…

## BODY (paste into Beehiiv editor)
# Idea of the Day
…

## BEEHIIV CHECKLIST
- [ ] …
```

