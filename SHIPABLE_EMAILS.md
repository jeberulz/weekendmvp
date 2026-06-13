# ship·able Workshop — Beehiiv Automation Emails

Email copy for the Ship.able Workshop automation (`aut_b55c6b1e-330b-4768-b44a-30e9e07ae92a`).

**Branching:** the in-automation "If" step routes subscribers by `utm_medium`:
- `utm_medium = waitlist` → free signups who haven't paid yet
- `utm_medium = paid` → buyers who completed Stripe checkout

**Workshop details (one-time):**
- Date: Sat Jun 27, 2026
- Time: 12:00 PM BST (90 min live + Q&A)
- Stripe Payment Link: https://buy.stripe.com/aFa00cdgk7v8cym50rbII00
- Bonuses (live attendees only): AI MVP Builder + Weekend MVP Starter Kit (combined $348 value)

**Placeholders to replace before publishing:**
- `{{ZOOM_LINK}}` — Zoom registration or meeting URL
- `{{SHIP_SHEET_DOWNLOAD_URL}}` — worksheet hosted on weekendmvp.app or Google Drive
- `{{BONUS_AI_MVP_BUILDER_URL}}` — prompt pack download
- `{{BONUS_STARTER_KIT_URL}}` — Starter Kit download
- `{{GOOGLE_CAL_LINK}}` + `{{ICAL_LINK}}` — generate at https://www.addevent.com/ or similar
- `{{REPLAY_URL}}` — fills in after the workshop

Personalize the greeting with Beehiiv's merge tag: `Hey {{first_name | "there"}},`

---

## WAITLIST BRANCH (`utm_medium = waitlist`)

People who entered their email but didn't (yet) complete checkout. Goal: get them to pay.

### W1 — Send immediately on entry

**Subject:** You're on the ship·able list, but your seat isn't booked yet
**Preview text:** $9 holds your spot for Sat Jun 27. Stripe link inside.

```
Hey,

You just put your name on the ship·able list. Good move.

But heads up: ship·able is a live $9 workshop with a real seat count, not a freebie. Your seat isn't actually reserved until you grab it.

90 minutes live on Saturday Jun 27 at 12 PM BST. By the end, you've got a real MVP at a real URL, plus two live-only bonuses (AI MVP Builder + Weekend MVP Starter Kit, $348 combined).

→ Hold your spot for $9: https://buy.stripe.com/aFa00cdgk7v8cym50rbII00

If you can't make it live, no stress. The replay is yours forever (bonuses are live-only though).

See you Saturday.
John

P.S. The Ship Sheet alone has helped people go from "vague idea" to "live URL with first signups" in a single weekend. That's the bit we fill in together on the call.
```

---

### W2 — Send 48 hours after W1 (or 4–5 days before the workshop, whichever is sooner)

**Subject:** Why I built ship·able the way I did
**Preview text:** One buyer. One painful problem. One screen. That's it.

```
Quick story.

Last cohort, someone walked in with a Notes-app idea they'd been sitting on for 9 months. 90 minutes later they had a live URL. By Monday morning, 14 real signups. Nine months of "I'll start next weekend" turned into 48 hours of "people are actually using this".

That's the whole point of ship·able.

It's not a "learn to code" workshop. It's not a "let me teach you AI" workshop. It's a forced shipping session: one buyer, one painful problem, one screen, live on Zoom.

The Ship Sheet keeps you honest. The 48-Hour Build Plan makes Sunday productive instead of paralyzing. The AI MVP Builder scaffolds your v1 in the time it takes to make coffee.

If you've got an idea rotting in a folder, this is the cheapest way I know to get it out.

→ Hold my $9 seat: https://buy.stripe.com/aFa00cdgk7v8cym50rbII00

John
```

---

### W3 — Send 3 days before the workshop (Wed Jun 24)

**Subject:** 3 days to ship·able. Last call on the bonuses.
**Preview text:** Saturday at 12 PM BST. Once live, AI MVP Builder + Starter Kit are gone.

```
Quick check-in.

ship·able is Saturday at 12 PM BST. 90 minutes. Live on Zoom.

You've got 3 days to grab a seat, and once the workshop goes live, the two bonuses (AI MVP Builder + Starter Kit, $348 combined) come off the table. Replay buyers don't get them.

If you're holding out because you "don't know what to build yet", that's exactly what we figure out together in the first 25 minutes. The whole point is to walk in with a vague idea and walk out with a deployed page.

→ Grab my $9 seat: https://buy.stripe.com/aFa00cdgk7v8cym50rbII00

See you Saturday.
John
```

---

### W4 — Send day-of, ~6 hours before workshop (Sat Jun 27, 6 AM BST)

**Subject:** ship·able is live in 6 hours
**Preview text:** Last call. The bonuses go with it.

```
Today is the day.

ship·able starts at 12 PM BST. That's 6 hours from this email landing.

After today, the bonuses (AI MVP Builder + Weekend MVP Starter Kit) come off the table. The replay will still be available, but it's the build session only, no bonuses.

If you've been waiting for "the right time", this is it.

→ $9 seat, last call: https://buy.stripe.com/aFa00cdgk7v8cym50rbII00

See you live.
John
```

---

## PAID BRANCH (`utm_medium = paid`)

People who completed Stripe checkout. Goal: confirm, prep, build anticipation, reduce no-shows.

### P1 — Send immediately on entry (right after Stripe webhook fires)

**Subject:** You're in. ship·able is Saturday at 12 PM BST.
**Preview text:** Zoom link, Ship Sheet, and your two bonuses inside.

```
Welcome to ship·able.

Your $9 seat is confirmed for Saturday Jun 27 at 12:00 PM BST. 90 minutes live, then Q&A.

Here's everything you need:

ZOOM LINK (save this somewhere safe)
→ {{ZOOM_LINK}}

SHIP SHEET (print or open this Saturday, we fill it in live)
→ {{SHIP_SHEET_DOWNLOAD_URL}}

YOUR LIVE-ONLY BONUSES
→ AI MVP Builder prompt pack: {{BONUS_AI_MVP_BUILDER_URL}}
→ Weekend MVP Starter Kit: {{BONUS_STARTER_KIT_URL}}

ADD TO CALENDAR
→ Google Calendar: {{GOOGLE_CAL_LINK}}
→ Apple / iCal: {{ICAL_LINK}}

Show up with one thing: the idea you've been sitting on. Doesn't matter if it's vague. We sharpen it on the call.

See you Saturday.
John

P.S. The replay is yours for life. But the bonuses above are live-attendee only, so download them while you're thinking about it.
```

---

### P2 — Send 1 week before workshop (Sat Jun 20)

**Subject:** One week to ship·able. Three things to do this week.
**Preview text:** A 10-minute prep that makes Saturday 3x better.

```
ship·able is one week from today. Sat Jun 27 at 12 PM BST.

Here are three small things that make the live session much higher leverage.

1. PICK THE ONE IDEA YOU'LL BRING.
Not three. Not "whichever". One. The one you keep coming back to in the shower. We sharpen it in the first 25 minutes, so come with something you're already a little attached to.

2. WRITE DOWN THE PERSON WHO'D PAY FOR IT.
Not "everyone". Not "developers". A specific person. Their first name if you know one. We work from "who", not "what".

3. TELL ONE FRIEND.
Send them the URL you're about to build. Yes, even before it exists. The promise alone gets you 80% of the way to actually building it.

That's it. 10 minutes total. See you Saturday.

John
```

---

### P3 — Send day before workshop (Fri Jun 26)

**Subject:** ship·able is tomorrow. Here's what to bring.
**Preview text:** Laptop, headphones, the Ship Sheet, and one idea.

```
Quick logistics.

Tomorrow at 12:00 PM BST. 90 minutes live. Zoom.

BRING:
→ Laptop (you'll be building, not watching)
→ Headphones if you're somewhere noisy
→ The Ship Sheet, open or printed: {{SHIP_SHEET_DOWNLOAD_URL}}
→ Your one idea (and the buyer you wrote down)

ZOOM LINK:
→ {{ZOOM_LINK}}

If your laptop is dying, charge it. If your wifi is sketchy, plan to be somewhere with good signal. We're building a real URL live, so you need to be at a keyboard.

See you in 24 hours.
John
```

---

### P4 — Send 1 hour before workshop (Sat Jun 27, 11 AM BST)

**Subject:** We go live in 1 hour
**Preview text:** Grab water. Open the Ship Sheet. Click here at 12 PM BST.

```
Showtime in 60 minutes.

ZOOM LINK:
→ {{ZOOM_LINK}}

Have the Ship Sheet open. Have your idea in your head. Have water nearby (90 minutes goes fast).

Doors open at 11:55 BST so you can settle in.

See you in there.
John
```

---

### P5 — Send 2–3 hours after workshop ends (Sat Jun 27, ~3 PM BST)

**Subject:** You shipped. Here's your replay + the next 48 hours.
**Preview text:** Watch back anytime. Then finish your MVP by Sunday night.

```
You did it.

Whatever stage you're at right now, you're further along than you were 90 minutes ago. Most people don't make it this far.

REPLAY (yours forever):
→ {{REPLAY_URL}}

YOUR 48-HOUR BUILD PLAN:
You filled in the Ship Sheet live. Now the plan is to actually finish it by Sunday night. The build plan inside the Starter Kit walks you through it hour by hour.

STUCK THIS WEEKEND?
Hit reply. I read every email and answer most of them within a few hours over the weekend.

When you ship the live URL, send it to me. I want to see what you built.

John

P.S. Your two bonuses, in case you didn't download them earlier:
→ AI MVP Builder: {{BONUS_AI_MVP_BUILDER_URL}}
→ Weekend MVP Starter Kit: {{BONUS_STARTER_KIT_URL}}
```

---

## Notes on Beehiiv configuration

**Re-enrollment behavior to test:** when a waitlist subscriber pays, the Stripe webhook re-enrolls them with `utm_medium=paid`. Beehiiv should re-evaluate the branch and route them to the paid path. Do a real $9 round-trip with your own email after publishing to confirm. If they get stuck on the waitlist path, add an exit-step at the top of the waitlist branch like "if `utm_medium` changes to `paid`, exit branch".

**Timing in Beehiiv:** for the W3/W4 and P3/P4/P5 emails that need to fire on specific dates, use Beehiiv's **"Send at a specific time"** delay step rather than "Wait X days" — date-anchored sends are more reliable for a one-shot live event.

**Trigger conditions** on the automation (already configured):
- `UTM Campaign equals shipable-workshop` (catches both flows)
