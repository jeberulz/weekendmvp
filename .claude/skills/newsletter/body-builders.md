# Newsletter Body Builders

Markdown templates the skill emits into `content/newsletter/YYYY-MM-DD-{am,pm}.md`. The BODY section is written so you can paste it directly into Beehiiv's post editor — Beehiiv converts markdown into its native blocks on paste (headings → heading blocks, paragraphs → paragraphs, `[Button Text](url)` → button blocks when the line stands alone with a trailing "→", images via `![alt](url)`).

No JSON block arrays, no API payloads — everything is paste-compatible markdown.

---

## File shape (what the skill writes)

```markdown
---
date: 2026-04-20
slot: am
title: "Idea of the Day: AI Meeting Notes Cleaner"
subtitle: "A $1K/mo weekend build that cleans up Zoom transcripts"
scheduled_at_local: "2026-04-20 07:30 America/New_York"
cta_url: "https://weekendmvp.app/ideas/ai-meeting-notes-cleaner.html?utm_source=beehiiv&utm_medium=newsletter&utm_campaign=am-20260420"
beehiiv_post_id: null    # fill in after scheduling, so /newsletter stats can find it
---

## SUBJECT

Idea of the Day: AI Meeting Notes Cleaner

## SUBTITLE

A $1K/mo weekend build that cleans up Zoom transcripts and turns them into action items.

## BODY (paste into Beehiiv editor)

# Idea of the Day

Every remote team drowns in raw Zoom transcripts…  <!-- hook, ≤60 words -->

## AI Meeting Notes Cleaner

<!-- ownedIdea.summary, 1 paragraph -->

**Why it's a weekend build:** ~8h to MVP, $1K/mo target. Stack: Cursor, Claude, Bolt.

[Read the full teardown →](https://weekendmvp.app/ideas/ai-meeting-notes-cleaner.html?utm_source=beehiiv&utm_medium=newsletter&utm_campaign=am-20260420)

---

Got a weekend? Try this idea.

## BEEHIIV CHECKLIST

- [ ] Start new post from template "AM — Idea of the Day"
- [ ] Paste SUBJECT into Title
- [ ] Paste SUBTITLE into Subtitle/Preview Text
- [ ] Paste BODY into editor (select all markdown between `## BODY` and `## BEEHIIV CHECKLIST`)
- [ ] If running an ad this week: insert Ad block → pick from active opportunities
- [ ] Schedule delivery for 2026-04-20 07:30 America/New_York
- [ ] Copy the Beehiiv post ID back into frontmatter: `beehiiv_post_id: "post_..."`
```

---

## AM — Idea of the Day body template

```markdown
# Idea of the Day

{hook}                                                    <!-- ≤60 words, MCP-sourced -->

## {ownedIdea.title}

{ownedIdea.summary}

**Why it's a weekend build:** ~{ownedIdea.buildTime}h to MVP, {formatRevenue(ownedIdea.revenueGoal)} target. Stack: {formatTools(ownedIdea.tools)}.

[Read the full teardown →]({ctaUrl})

---

Got a weekend? Try this idea.
```

---

## PM — Builder Brief body templates

### Monday — owned article link

```markdown
# Builder Brief

{hook}

## {article.title}

{article.excerpt}

[Read the article →]({ctaUrl})

---

More where that came from — [weekendmvp.app/articles](https://weekendmvp.app/articles.html).
```

### Tuesday — tool spotlight

```markdown
# Builder Brief

{hook}

## {tool.name} in 10 minutes

{tool.gettingStarted}

Try it on: **{ideaSample.title}** — ~{ideaSample.buildTime}h, {formatRevenue(ideaSample.revenueGoal)} target.

[Browse {tool.name} ideas →]({ctaUrl})

---

Pick one and block off Saturday.
```

### Wednesday — evergreen deep dive

Same shape as AM, with heading "Builder Brief" instead of "Idea of the Day" and a longer hook (≤90 words).

### Thursday — behind-the-build

```markdown
# Builder Brief

How to build **{idea.title}** this weekend.

## The stack

{stackSummary}

## The build prompt

```
{buildPrompt}
```

[See the full build plan →]({ctaUrl})

---

Built it? Reply and share the repo.
```

### Friday — weekly recap

```markdown
# Builder Brief

{weekSummary}                                             <!-- ≤60 words -->

## This week's ideas

<!-- For each pick from Mon–Thu AM sends: -->
**[{pick.title}]({pick.url})** — {pick.tagline}

[Browse all 45+ ideas →]({ctaUrl})

---

See you Monday.
```

---

## Formatters (for reference while drafting)

| Input              | Output                     |
| ------------------ | -------------------------- |
| `revenueGoal` `1k-month`  | `$1K/mo`            |
| `revenueGoal` `5k-month`  | `$5K/mo`            |
| `revenueGoal` `10k-month` | `$10K/mo`           |
| `tools` `cursor`          | `Cursor`            |
| `tools` `claude`          | `Claude`            |
| `tools` `bolt`            | `Bolt`              |
| `tools` `v0`              | `v0`                |
| `tools` `lovable`         | `Lovable`           |
| `tools` `replit`          | `Replit`            |
| `tools` `windsurf`        | `Windsurf`          |
| `tools` `no-code`         | `No-code`           |

Comma-separated, oxford-commaed for 3+.

---

## Hard rules

- Every send has exactly one CTA link rendered on its own line as `[text →](url)` so Beehiiv converts it into a button block on paste. Never add two button lines.
- Every CTA URL carries `?utm_source=beehiiv&utm_medium=newsletter&utm_campaign={slot}-{YYYYMMDD}`.
- Use `---` for dividers (Beehiiv converts to divider block on paste).
- Don't embed inline HTML. Beehiiv's paste converter handles pure markdown best. If a section needs emphasis, use `**bold**` or `_italic_`, not `<span>`.
- The skill file's BODY section between `## BODY` and `## BEEHIIV CHECKLIST` is what the user copies. Keep it a clean, self-contained markdown document — no extra commentary inside those bounds.
