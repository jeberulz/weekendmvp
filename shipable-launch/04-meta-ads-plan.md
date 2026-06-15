# ship·able — Meta Ads Plan

**Window:** Jun 15–27 (12 days). **Budget:** ~$300–1,000 total. **Objective of the spend:** qualified $9 buyers (DARE-compatible) who show up live — *not* cheap clicks.

The whole bet: it's a **$9 tripwire with a high-ticket backend (DARE).** That means you can acquire buyers at break-even or a small loss, because the money is downstream. Target blended CPA ≤ ~$9 ideal, acceptable to ~$20 given the backend. At $20 CPA, $600 buys ~30 buyers; at $9, ~66.

---

## 1. Campaign objective — pick correctly

Use **Sales / Conversions**, optimizing for **Purchase**, with the Stripe purchase fired as a pixel/CAPI event. **Do not** run Traffic — it buys clicks, not buyers.

**The catch at this budget:** a $9 product over 12 days won't generate enough Purchase events fast enough for the algorithm to fully exit the learning phase (needs ~50 events/week/ad set). So:

- **If list/pixel is cold (your case — small reach):** optimize for a **mid-funnel event you'll get volume on** — i.e., **Initiate Checkout** or a **Lead** (Beehiiv email capture before Stripe). This gives Meta enough signal to optimize. Set Purchase as the reporting goal, optimize for the cheaper event.
- Add a **custom event "QualifiedLead"** if you can fire it when the "what do you do" field = designer/PM/builder. Optimizing toward that is the highest-leverage move you have.

**Concretely:** the `/shipable` flow does Beehiiv subscribe → Stripe. Fire `Lead` on the Beehiiv subscribe and `Purchase` on Stripe success (`/shipable?paid=1`). Optimize ad sets for `Lead` early, switch the best ones to `Purchase`/`InitiateCheckout` once they have ~30+ events.

---

## 2. Account structure (CBO, simple)

Keep it lean — 12 days and $600 can't feed 10 ad sets.

```
Campaign A — COLD ACQUISITION (Advantage+ Sales, CBO)
  ├─ Ad set A1 — Advantage+ (broad, let Meta find buyers)   ← primary spend
  └─ Ad set A2 — Interest stack (designers/builders/AI)      ← only if you want control
        4 ads each: 2 video/UGC, 2 static. Same across ad sets.

Campaign B — RETARGETING (CBO, starts Jun 20)
  └─ Ad set B1 — Warm audiences (see §4)
        2–3 ads: urgency / objection / "doors close"
```

**Budget split:** ~70% Campaign A (cold) until Jun 24, then shift toward 50/50 as retargeting pools fill. Retargeting is your cheapest buyers — feed it as it grows.

**Daily pacing example ($600 total):**
- Jun 15–19: $30/day cold (learning) = $150
- Jun 20–23: $45/day (≈$35 cold / $10 RT) = $180
- Jun 24–26: $80/day (≈$45 cold / $35 RT, urgency) = $240
- Jun 27: $30 RT only (day-of, "live today") = $30

Scale the whole thing up/down proportionally for your real budget.

---

## 3. Cold audiences (Campaign A)

Reach is small, so **lead with Advantage+ / broad** — Meta's best at finding $9 buyers itself. Use interests only as a second ad set for control.

**A1 — Advantage+ Sales:** broad, age 25–45, your key geos (prioritize **US/UK/Nigeria** to match the BST-friendly time + existing audience). Let the creative do the targeting.

**A2 — Interest stack (optional manual):** narrow to the DARE-compatible persona:
- Job titles / interests: *Product design, UX design, Figma, Product management, Indie hackers, No-code, Bubble, Webflow, Notion, Startup founder, Y Combinator, On Deck*
- AI interest layer: *ChatGPT, Midjourney, Artificial intelligence, OpenAI*
- Behaviors: *small business owners, engaged shoppers*

> Targeting note: this is where strategy bites. The landing page is broad ("anyone with an idea"), but **the ads should skew to designers / PMs / no-code builders** so your $9 buyers are warm DARE leads. Don't waste a small budget on generic "founders."

---

## 4. Retargeting audiences (Campaign B, from Jun 20)

These convert cheapest — prioritize as they fill:
- **Video viewers 25%+** of any ship·able video ad (biggest warm pool at small budget)
- **/shipable page visitors, no purchase** (pixel) — last 14 days
- **Initiate Checkout, no Purchase** (cart abandoners) — highest intent, hit hard with urgency
- **Beehiiv list** (custom audience upload) + **1% lookalike** of any buyers/leads you get (build it day 4–5)
- **IG/FB engagers** last 30 days

---

## 5. Creative — this is 80% of the result

At this budget, creative wins or loses it. Make **4–6 cold creatives**, kill fast, scale the winner. Mix UGC-style video (best for cold) + clean statics (good for retargeting).

### Compliance first (READ — non-obvious, will get you disapproved)
Meta is strict on **"unrealistic outcomes," income claims, and personal-attribute** language. Your landing-page proof ("first paying user in 6 days," "14 signups in 48 hours," "$738 value → $9") is **high-risk in ads.**
- ❌ Avoid in ad copy: "get your first paying users," "make money," dollar-value stacks, "14 signups," before/after income.
- ❌ Avoid personal attributes ("are YOU a struggling designer?" implies you know their situation).
- ✅ Safe framing: describe **the deliverable and the activity** — "build and deploy a real MVP in 90 minutes," "leave with a live URL," "no code." Process claims, not outcome promises.
- ✅ Landing page can be richer than the ad, but if the ad implies income and the LP confirms it, that compounds risk. Keep the ad about *building/shipping*, not *earning*.
- Have a **backup ad account / page** warm in case of restriction. Don't run everything through one fragile asset 12 days out.

### Creative concept 1 — UGC / talking head (cold, primary)
**Hook (first 3s):** "You've been sitting on the same idea for months. Here's how to make it real in one afternoon."
**Body:** "Saturday I'm running a 90-minute live workshop. You bring one idea, we build it with AI — no code — and you deploy a real, working page by the end. It's $9."
**CTA:** "Save your seat → link in the post. Sat Jun 27, 12 BST."
*Shoot on phone, you talking, casual. This out-converts polished video for cold.*

### Creative concept 2 — Screen-capture demo (cold, proof-of-format)
**Visual:** screen recording of you turning a one-liner into a deployed page in ~30s (sped up).
**Caption overlay:** "Idea → live website. No code. 90-minute live workshop, $9."
**Primary text:** "This is what we build together, live, on Jun 27. Bring an idea, leave with a URL."

### Creative concept 3 — Static, the offer (cold + RT)
**Visual:** bold dark card, "ship·able" wordmark, "Build your MVP live in 90 minutes."
**Text on image:** "Live workshop · Sat Jun 27 · $9 · no code"
**Primary text:** "The reason your idea's still an idea: you never ship. Let's fix that in 90 minutes. $9, live, replay included."

### Creative concept 4 — Static, "the 3 moves" (cold)
**Visual:** numbered 01/02/03 — Sharpest idea / Weekend cut / Live launch page.
**Primary text:** "Three moves, 90 minutes, one live URL. Built with AI, no code. Jun 27 · $9."

### Creative concept 5 — Retargeting urgency (B only, from Jun 24)
**Visual:** countdown / "seats closing."
**Primary text:** "Last seats for Saturday's live build. 90 minutes, a real deployed MVP, $9. Replay included if you can't make it live. Doors close Jun 26."

### Creative concept 6 — Retargeting objection (B)
**Primary text:** "'$9, what's the catch?' None. It's cheap so people actually show up and build. You leave with a live URL and the replay. Sat Jun 27, 12 BST."

**Headlines (rotate):** "Build your MVP live in 90 min" · "$9 live workshop" · "Idea → live URL, no code" · "Sat Jun 27, 12 BST"
**Descriptions:** "Live on Zoom · replay included" · "No code. Built with AI."

---

## 6. Tracking & measurement

- **Pixel + Conversions API** both firing (CAPI matters now that browser tracking is degraded). Events: `PageView`, `Lead` (Beehiiv subscribe), `InitiateCheckout` (Stripe redirect), `Purchase` (`/shipable?paid=1`).
- **UTMs on every ad** → `?utm_source=meta&utm_campaign=shipable&utm_content={{ad.name}}`.
- **The metric that matters:** cost per *qualified* buyer, using the "what do you do" field. A $7 buyer who's a designer beats a $5 buyer who's a tire-kicker.
- Watch **frequency** — at small audiences it climbs fast. Above ~2.5 in 12 days, refresh creative or widen.

---

## 7. Daily 10-minute routine (so you don't fiddle)
1. Check **cost per Purchase / Lead** per ad.
2. **Kill** any ad with CPA > $25 after ≥$40 spend & ≥1k impressions.
3. **Bump** a winner (CPA < $12) by 20–30% — once per day max.
4. From Jun 20: confirm **retargeting** is spending; if pools too small, fold RT budget back to cold.
5. Glance at **frequency** + **comments** (reply to comments — social proof + Meta likes engagement).

---

## 8. Realistic outcome ranges
| Budget | Est. blended CPA | Buyers | Live (≈45%) | DARE @15% |
|---|---|---|---|---|
| $300 | $12–20 | 15–25 | 7–11 | 2–4 |
| $600 | $10–18 | 33–60 | 15–27 | 5–9 |
| $1,000 | $9–16 | 60–110 | 27–50 | 9–16 |

Plus organic/email on top. First run will sit at the worse end of CPA (cold pixel, no lookalikes) — that's expected. The asset you're really buying: a qualified buyer list + real proof that makes run #2 and the DARE launch *much* cheaper.

---

## 9. If budget is tight ($300) — priority order
1. **One** great UGC cold video → Advantage+ only. Don't split.
2. Retargeting on page-visitors + checkout-abandoners from day 4 (cheapest buyers).
3. Lean hard on **organic + email + community** (free) — at $300, ads are a supplement, not the engine.
4. Don't bother with manual interest stacks; let Advantage+ do it.
