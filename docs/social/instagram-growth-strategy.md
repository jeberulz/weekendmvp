---
name: Instagram Growth Strategy
owner: John Iseghohi (@weekendmvp)
last_updated: 2026-07-26
horizon: 2026-08-10 → 2026-11-08 (90 days)
status: active
---

# Instagram Growth Strategy — Weekend MVP

The operating doc for growing Instagram views, followers, and engagement in
service of one commercial outcome: a qualified buyer list for ship·able ($9)
→ DARE Live ($29) → DARE (high-ticket).

This is **not** a general "post more Reels" plan. It is built on top of assets
this repo already has: 130 research-backed idea pages, 41 articles, a daily
Reel campaign pipeline (`content/social/reels/campaigns/*/calendar.csv`), a
tracked link-in-bio hub (`/links`), 6 carousel layouts, and a Beehiiv list.

Companion doc: [`instagram-format-playbook.md`](./instagram-format-playbook.md)
— the beat-by-beat script structure for every format named here.

---

## 1. Where we actually are

| Asset | State | Instagram implication |
|---|---|---|
| 130 idea pages, 7-section contract, citation-backed | Live | An effectively infinite, differentiated Reel/carousel supply. Nobody else in this niche has research-backed idea inventory. |
| 41 articles (validation, pricing, auth, cost math, security) | Live | The "authority" pillar. These are carousel fuel, not Reel fuel. |
| `/links` archive with UTM tracking (`utm_source=link_in_bio`) | Live | Attribution already works. Every Reel has a destination and the click is measurable in GA4. |
| Daily Reel calendar, 18:30 Europe/London | Running through 2026-08-09 | Cadence exists. What's missing is *structure* — see §5. |
| 8 Reel formats (`idea-breakdown`, `three-screen-mvp`, `revenue-breakdown`, `honest-critique`, `niche-the-incumbent`, `founder-pov`, `workflow-demo`, `boring-business`, `business-model-map`, `contrarian-product`) | In use, **undocumented** | Formats exist only as CSV strings. No hook library, no beat structure, no retention target per format. Fixed by the playbook doc. |
| 6 carousel layouts + Figma pipeline | Built | Underused. Carousels are the highest-leverage untapped surface (§4.2). |
| ship·able ($9) / DARE ($29) | Live offers | The conversion end of the loop. Currently has **no dedicated Instagram content motion**. |

**Honest read:** the pipeline is strong and the inventory is unfair-advantage
tier. The weakness is that the current calendar is a *rotation* (format A, B,
C, D repeating) rather than a *system with roles* — nothing is engineered
specifically for sends, nothing is engineered specifically for follows, and
nothing carries the offer. That's what this doc fixes.

---

## 2. The audience

### 2.1 Primary — "The Stuck Builder-Designer"

Experienced designer, design-leaning PM, or semi-technical indie. 27–40.
They already know AI is the opening. They have Cursor or Claude Code
installed. They have a Notion doc of ideas.

**They have never shipped.**

This is the entire psychographic. They are not idea-poor, they are
decision-poor. They over-scope, they research instead of deciding, and they
have quietly indexed "not shipping" as a character flaw. That shame is the
emotional core of every high-performing piece of content we will make.

What they actually do on Instagram:
- Consume at night (20:00–23:30 local) in a low-agency, doom-scroll state —
  which is exactly when "you could build this in a weekend" lands hardest.
- **Save** rather than act. Their saved folder is the graveyard version of
  their Notion doc. Saves are cheap for them and therefore a *weak* signal.
- **Send to one specific person** — a co-founder, a designer friend, a group
  chat of three. This is the strongest signal they emit, and it maps directly
  to the #1 reach lever (§3).
- Never comment publicly on business content unless the comment is low-risk
  (a tool name, a one-word vote, "which one?"). They will not write a
  paragraph under a business post where colleagues can see them.
- **DM** when the ask is concrete and private ("comment SHIP and I'll send
  the sheet" underperforms "DM me the word SHIP" for this persona *if* the
  content already earned trust — they prefer the private channel).

### 2.2 Secondary — "The Curious Non-Technical Founder"

Lands on us via broad AI-tool and "make money" adjacency. High volume, low
qualification. They inflate views and follows and deflate conversion.

**Policy:** do not chase them, do not block them. They are acceptable
volume that funds reach — but never let a hook be written *for* them. The
targeting happens in the content, not the landing page (mirrors
`STRATEGY.md`: keep the public page broad, do the targeting upstream).

### 2.3 What they follow instead of us right now

Three competing account types, all beatable:

1. **Idea-dump accounts** ("10 AI startup ideas 💰"). Zero research, zero
   build path, high volume. They win reach and lose trust — nobody believes
   the ideas. **Our counter:** citations, real competitor names, real pricing,
   real numbers. We are the only account that can show its work.
2. **Vibe-coding tutorial accounts** (Cursor/Lovable screen recordings).
   Strong on *how*, empty on *what to build* and *will anyone pay*. **Our
   counter:** we own the pre-code decision, which is the actual bottleneck.
3. **Build-in-public founders** (MRR screenshots). High affinity, but the
   viewer can't act on it — it's someone else's business. **Our counter:**
   every post ends with something the viewer can build *this weekend*.

---

## 3. Growth triggers (what the platform actually rewards, and how we exploit it)

Instagram runs four separate ranking systems in 2026 — feed, Reels, Stories,
Explore — with different winning signals each. The three signals Mosseri has
confirmed as dominant for Reels are **watch time**, **sends per reach**, and
**likes per reach**, with sends weighted far above likes for *new-audience*
distribution. Feed rewards save-to-share ratio; Stories reward completion.

Translated into levers we control:

### Trigger 1 — Sends per reach (highest leverage, lowest current usage)
DM shares are worth multiples of likes for reaching non-followers. Our
persona is a natural sender — they have exactly one person they'd tag.

**Exploit:** engineer *sendability* into the artifact, not the caption.
- Make the frame a viewer would send **as an argument**: "This is the one I
  told you about."
- The "tag your co-founder" CTA is dead. Replace with **role-assignment
  CTAs**: "Send this to the person who owes you a landing page."
- `honest-critique` and `contrarian-product` formats are our send engines —
  a strong opinion is more sendable than a good idea.
- **Target: sends ≥ 1.5% of reach on Reels.** Track it weekly; it is the
  single number that predicts whether an account escapes its own follower
  graph.

### Trigger 2 — Watch time / completion
Completion rate is the strongest Reel signal, and 2026 watch-time floors are
higher — weak hooks get filtered before they reach a wider audience.

**Exploit:**
- **Hard cap Reels at 22–34 seconds** for reach formats. Under 22s reads as
  thin for a business account; over 34s tanks completion for this persona.
- **First 1.2 seconds carry a visual + verbal hook simultaneously.** No logo
  intro, no "hey guys." The first frame should be a number, a screen, or a
  claim.
- **Loop-close:** the last line should rhyme with the first, so the replay
  is coherent. Replays are watch time.
- **Never open with the idea's name.** Open with the *pain* or the *number*.
  Names are search terms, not hooks.

### Trigger 3 — Original content from small accounts
Instagram now explicitly favours original content from smaller creators and
demotes reposts/aggregation.

**Exploit:** this is structurally in our favour. Our ideas come with
provenance (`researchCalls`, `citations`, `wordCount` in the manifest).
Nothing we post is an aggregation. Lean into on-screen sourcing — showing a
real competitor's pricing page beats a stock-video B-roll on both
originality and trust.

### Trigger 4 — Format role separation
2026 benchmarks: Reels ~30.8% average reach rate (2–3× carousels) but
carousels edge Reels on per-follower engagement (0.50% vs 0.48%) and win on
saves (~37 vs ~35 per post). Reels bring strangers; carousels convert the
people already there.

**Exploit:** stop treating Reels and carousels as interchangeable slots.
Assign them different jobs (§4).

### Trigger 5 — The comment we can actually get
This persona won't write essays publicly. Don't ask for one.

**Exploit:** ask for **binary or one-token** comments — "A or B?", "name the
tool you'd use", "which of these 3 would you build?". A one-word comment
counts identically to a paragraph in ranking terms and converts 5–10× better
with a reserved audience. Then **reply to every comment within 60 minutes**
with a question — a reply that gets a reply is two engagement events.

### Trigger 6 — Story completion as a follower-conversion surface
Stories don't grow reach; they convert reach into followers and buyers.
Non-followers who land on the profile from a Reel check Stories. Keep a
**permanent 3-frame "start here" highlight** and run daily 3–5 frame
sequences (never 8+ — completion collapses).

---

## 4. Format architecture — three surfaces, three jobs

### 4.1 Reels — the acquisition surface (job: reach + sends)
5–6 per week. Every Reel is optimised for a **stranger**, not a follower.
Assume zero context. Never reference a previous post.

### 4.2 Carousels — the authority + save surface (job: depth + follows)
**2 per week, currently near-zero. This is the biggest single unlock in this
plan.** We have 41 articles and 6 built layouts and are barely using them.
Carousels are where the "is this person credible?" question gets answered —
which is what turns a viewer who saw one Reel into a follower and eventually
a $9 buyer. Slide 1 does the hook's job; slide 8 does the CTA's job; slides
2–7 must be individually screenshot-able.

### 4.3 Stories — the conversion surface (job: trust + offer)
Daily, 3–5 frames. This is the **only** surface where the offer lives
regularly. Reels and carousels sell almost nothing; Stories carry ship·able,
DARE, and the newsletter, plus polls/quizzes (which feed the algorithm
interaction signal and give us free audience research).

---

## 5. Content pillars

Five pillars. Each has a **job**, a **primary signal**, a **format home**,
and a **weekly quota**. Every scheduled post must declare its pillar — no
"general" posts.

### Pillar 1 — PROOF (30%)
*"Here is a real thing, with real numbers, that a person like you could build
by Sunday."*

Idea breakdowns, revenue math, 3-screen scopes, build-time reality checks.
Fed directly by the 130-idea library.
- **Job:** reach + saves
- **Signal:** watch time, saves
- **Formats:** `idea-breakdown`, `three-screen-mvp`, `revenue-breakdown`
- **Quota:** 2 Reels/week
- **Non-negotiable:** every PROOF post shows at least one *specific* number
  (competitor's price, market size, time-to-build, MRR path). No round
  numbers without a source.

### Pillar 2 — VERDICT (25%)
*"Most of what you're being told to build is wrong, and here's why."*

The opinion pillar. Honest critiques of ideas (including our own), contrarian
takes on tools, and "this whole category is a trap" arguments.
- **Job:** sends + comments — this is our send engine
- **Signal:** sends per reach, comments
- **Formats:** `honest-critique`, `contrarian-product`, `niche-the-incumbent`
- **Quota:** 1–2 Reels/week
- **Non-negotiable:** the opinion must have a *cost* — name a specific tool,
  category, or piece of common advice that's wrong. Vague contrarianism reads
  as engagement bait and this audience smells it instantly.

### Pillar 3 — MIRROR (20%)
*"I know exactly why you haven't shipped, because I've watched 100 people
not ship."*

The psychology pillar — the shame, the over-scoping, the 47-tab research
spiral, the idea you've had for 14 months. Highest affinity, highest
follow-conversion, lowest reach ceiling.
- **Job:** follows + affinity
- **Signal:** follows per reach, sends (people send this to themselves)
- **Formats:** `founder-pov`, carousel essays
- **Quota:** 1 Reel + 1 carousel/week
- **Non-negotiable:** first person, specific, and never scolding. "You're
  lazy" loses. "You're not stuck because you're lazy — you're stuck because
  you're scoping a company when you should be scoping a screen" wins.

### Pillar 4 — CRAFT (15%)
*"Here's the actual mechanic — the prompt, the stack, the 20 minutes."*

Workflow demos, tool comparisons, the prompts, auth/Stripe/cost gotchas.
Fed by the articles.
- **Job:** saves + credibility
- **Signal:** saves, profile visits
- **Formats:** `workflow-demo`, screen-recording Reels, carousels
- **Quota:** 1 Reel or carousel/week
- **Non-negotiable:** screen recording, real cursor, real output. No
  narrated slides pretending to be a demo.

### Pillar 5 — RECEIPTS (10%)
*"Someone did it. Here's the URL."*

Shipped MVPs from ship·able attendees, before/afters, live-build clips,
"built on the call in 90 minutes." The `shipped-on-call rate ≥ 60%` metric in
`STRATEGY.md` exists to feed this pillar.
- **Job:** conversion
- **Signal:** link clicks, DMs, profile visits
- **Formats:** `receipt-8slide` carousel layout, Stories, Reels
- **Quota:** 1/week (Stories daily during workshop weeks)
- **Non-negotiable:** a real, clickable, deployed URL on screen. No mockups.
  This is the pillar that separates us from every idea-dump account, and it
  is worthless the moment it's staged.

**Pillar balance check:** PROOF and CRAFT grow *respect*; VERDICT grows
*reach*; MIRROR grows *followers*; RECEIPTS grows *revenue*. An account
heavy on PROOF alone plateaus — it gets saved and forgotten. The July
calendar is ~70% PROOF. Rebalancing toward VERDICT and MIRROR is the fastest
available lift.

---

## 6. Weekly posting rhythm

Fixed themes so the audience learns the schedule (repeat viewership is a
ranking input, and named recurring segments get sent more).

| Day | Slot | Pillar | Format | Objective |
|---|---|---|---|---|
| **Mon** | 18:30 Reel | PROOF | `idea-breakdown` | Reach — biggest idea of the week, best hook |
| **Mon** | Carousel 08:30 | CRAFT/MIRROR | Article carousel | Saves |
| **Tue** | 18:30 Reel | MIRROR | `founder-pov` | Follows |
| **Wed** | 18:30 Reel | PROOF | `three-screen-mvp` | Saves |
| **Thu** | 18:30 Reel | VERDICT | `honest-critique` | **Sends** |
| **Fri** | 18:30 Reel | PROOF | `revenue-breakdown` | Saves + link clicks |
| **Sat** | Carousel 10:00 | RECEIPTS/PROOF | `receipt` / `digest` | Conversion |
| **Sun** | 18:30 Reel | VERDICT | `contrarian-product` | Comments + discussion |
| **Daily** | Stories ×3–5 | rotating | — | Trust + offer |

Named recurring segments (these become the reason to follow):
- **"Ship It Saturday"** — the weekly shipped-thing showcase. Already an
  article slug (`ship-it-saturday-framework`); make it the account's ritual.
- **"Would You Build It?"** — Sunday A/B vote between two ideas from the
  library. Pure comment engine, near-zero production cost.
- **"The Honest Take"** — Thursday critique. The send engine.

**On cadence:** 5–6 Reels/week is the ceiling before quality drops, and
quality is the constraint, not volume. A weak Reel does measurable damage —
it lowers the account's average watch time and suppresses the *next* one.
**Skipping a day is strictly better than shipping a Reel with a weak hook.**

---

## 7. Audience attraction — how strangers find us

### 7.1 The trojan-audience play (highest ROI, most under-used)
The 130 ideas are tagged by audience: freelancers, creators, e-commerce
sellers, small-business owners, recruiters, coaches. An idea *for* freelancers
gets distributed to freelancers — a completely different, much larger pool
than "startup founders."

**Play:** deliberately rotate the *served* audience week to week. A Reel about
a freelancer scope-creep detector reaches freelancers; a meaningful slice of
them are our stuck builder-designer wearing a different hat, and the rest are
still buyers of the "you could build this" premise. This is how we escape the
saturated founder pool without diluting the positioning.

### 7.2 Comment-first, post-second
30 minutes daily, before posting, leaving substantive replies on:
- Vibe-coding / AI-tool accounts (Cursor, Claude Code, Lovable, Bolt content)
- Build-in-public founders under ~50k followers
- Design-career and PM accounts (where the persona actually lives)

Rule: the comment must be useful standing alone with no mention of us. The
profile visit is the conversion. This is the only reliable cold-start lever
that doesn't cost money.

### 7.3 Collaborator posts (`collab` feature)
Co-posted Reels appear in both audiences' feeds and pool the engagement.
Targets: indie hackers with a shipped product (they get a case study, we get
reach), and micro-creators in the served audiences from §7.1. Aim for **2/month.**

### 7.4 Meta paid amplification
`STRATEGY.md` already runs Meta spend for ship·able. Reroute a slice:
- Boost only Reels that clear **1.2% sends/reach organically** — the
  algorithm already validated them; paid just extends the curve.
- Objective: profile visits / followers, *not* link clicks, for top-of-funnel
  amplification. Link-click objectives on organic-winner Reels attract
  non-qualified secondary-persona clicks and pollute the buyer list.
- Retarget Reel viewers (75%+ watch) with the $9 ship·able offer. This is
  the single highest-intent custom audience available and is currently unused.

### 7.5 SEO/Instagram convergence
Instagram content is indexed and searched in-app. Put the literal search
phrase in the on-screen text and first caption line: "startup ideas to build
in a weekend", "what to build with Claude Code", "AI app ideas 2026". Same
keyword discipline as the `/articles` engine, applied to the first 40
characters of a caption.

### 7.6 The `/links` loop
Every Reel already resolves to a UTM-tracked `/links` destination that feeds
Beehiiv. The gap: **Instagram → email is the only durable channel**. Views
are rented; the list is owned. Every RECEIPTS and PROOF post should terminate
in a reason to hit the link, and the weekly measurement in §9 must include
`link_in_bio` sessions and Beehiiv subscribes, not just IG-native metrics.

---

## 8. Positioning

**Category:** we are not a "startup ideas" account and not a "vibe coding"
account. We are the **decision layer between them** — the account that tells
you *which* thing to build and *proves* it's buildable by Sunday.

**Positioning line for the profile:**
> Research-backed startup ideas you can actually ship in a weekend.
> No code required. New idea daily.

**Bio structure:**
```
Startup ideas you can build in a weekend 🛠️
130+ researched ideas · what to build, what it costs, who pays
Built one? Send me the URL 👇
[link to /links]
```
The third line matters most — it invites a DM, which trains the algorithm
that this account produces conversations, and it's the top of the RECEIPTS
pillar.

**Voice rules (from the site's own tone):**
- Lowercase-comfortable, high-specificity, allergic to hype.
- Numbers over adjectives. "$47/mo, 8 hours, 3 screens" beats "huge
  opportunity."
- Never say "game-changer," "insane," "literally printing money."
- Admit when an idea is weak. The `honest-critique` format is a *trust*
  mechanism first and an engagement mechanism second.

**Highlights (in order):** `START HERE` · `IDEAS` · `SHIPPED` · `TOOLS` ·
`ship·able`

---

## 9. Metrics

Track weekly in one sheet. **Views are a diagnostic, not a goal.**

| Metric | Why | 30-day target | 90-day target |
|---|---|---|---|
| **Sends per reach** (Reels) | The reach multiplier | ≥ 1.0% | ≥ 1.5% |
| **Avg watch time / duration** | The distribution gate | ≥ 55% | ≥ 65% |
| **Follows per 1k reach** | Whether reach converts | ≥ 4 | ≥ 8 |
| **Saves per reach** (carousels) | Authority | ≥ 2.5% | ≥ 3.5% |
| **Profile visits → follows** | Bio/grid quality | ≥ 15% | ≥ 25% |
| **`link_in_bio` sessions** (GA4) | IG → owned | +100% | +400% |
| **Beehiiv subs attributed to IG** | The actual asset | 50 | 300 |
| **IG-attributed ship·able buyers** | The point | 10 | 60 |

**The one number:** IG-attributed Beehiiv subscribers. Followers are a
vanity proxy for it; the list is the thing that survives an algorithm change.

**Diagnostic rules:**
- High views + low follows → hook is broad, payload is thin. Move budget from
  PROOF to MIRROR.
- High saves + low sends → too useful, not opinionated enough. Add VERDICT.
- High sends + low profile visits → the content is good, the *frame* isn't
  branded. Add an on-screen identity marker at the loop point.
- Everything flat → the hook is the problem. It is nearly always the hook.

---

## 10. 90-day roadmap

### Phase 1 — Instrument & rebalance (Weeks 1–4, Aug 10 – Sep 6)
Goal: fix the mix, establish measurement, prove the send lever.
- Ship the 2026-08 calendar (`content/social/reels/campaigns/2026-08-compounding-loop/`)
  — pillar-balanced, not format-rotated.
- Add the missing 2 carousels/week using existing layouts.
- Start daily Stories with a fixed 4-frame structure.
- Rewrite bio + build the 5 highlights.
- Begin the 30-min/day comment-first block.
- **Exit gate:** sends/reach ≥ 1.0%, ≥ 8 carousels published, weekly sheet live.

### Phase 2 — Compound the winners (Weeks 5–8, Sep 7 – Oct 4)
Goal: stop guessing, start amplifying.
- Every Reel clearing 1.2% sends/reach gets: (a) a carousel remake, (b) a
  Meta boost for profile visits, (c) a follow-up Reel on the same tension.
- Launch "Would You Build It?" Sunday votes.
- First 2 collab posts.
- Turn the top 3 organic Reels into a retargeting audience for ship·able.
- **Exit gate:** follows/1k reach ≥ 6, 2 collabs live, retargeting audience ≥ 5k.

### Phase 3 — Close the loop (Weeks 9–12, Oct 5 – Nov 8)
Goal: make Instagram a measurable revenue channel, not a reach channel.
- RECEIPTS pillar goes weekly with real shipped URLs from ship·able cohorts.
- Story-native $9 offer sequence tied to each workshop date.
- DM automation for a single keyword (the Ship Sheet) → Beehiiv.
- Retire the bottom-quartile formats; double the top two.
- **Exit gate:** ≥ 60 IG-attributed ship·able buyers, ≥ 300 IG-attributed subs.

---

## 11. Explicitly not doing

- **Chasing trending audio.** Fine to use, never the reason for a post. Our
  persona doesn't discover business content through audio trends, and it
  costs the "original content" advantage.
- **Daily posting at all costs.** 5–6 quality Reels beat 7 with two weak
  hooks, because weak hooks suppress the next post.
- **Follow/unfollow, engagement pods, giveaway growth.** Poisons the buyer
  list, which is the entire point of the funnel.
- **Repurposing TikTok exports with the watermark.** Reposted/aggregated
  content is actively demoted in 2026.
- **Making the account about John's personal brand.** The Person schema and
  `/john-iseghohi` carry authority on the site; on Instagram the *ideas* are
  the draw. Face on camera for MIRROR and RECEIPTS only.
- **Optimising Instagram for direct $9 sales.** Same logic as the loss-leader
  ticket — Instagram's job is qualified attention and email capture. The
  offer converts on Stories and in email, not in a Reel caption.

---

## Sources

Platform mechanics current as of July 2026:
- [Instagram algorithm 2026 — ranking signals (Hootsuite)](https://blog.hootsuite.com/instagram-algorithm/)
- [How the Instagram algorithm works: 2026 guide (Buffer)](https://buffer.com/resources/instagram-algorithms/)
- [Instagram Algorithm 2026: 5 ranking signals Mosseri confirmed](https://www.dataslayer.ai/blog/instagram-algorithm-2025-complete-guide-for-marketers)
- [2026 Instagram organic engagement benchmarks (Socialinsider)](https://www.socialinsider.io/social-media-benchmarks/instagram)
- [2026 Instagram benchmarks (Dash Social)](https://www.dashsocial.com/social-media-benchmarks/instagram)
- [Reels vs. carousels: 2026 engagement guide (Contentdrips)](https://contentdrips.com/blog/2026/06/instagram-reels-vs-carousels-2026-guide/)
