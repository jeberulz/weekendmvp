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
