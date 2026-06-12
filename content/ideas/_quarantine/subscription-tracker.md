---
slug: "subscription-tracker"
title: "Personal Subscription Tracker"
---

## The Problem

The average person has 12+ active subscriptions and wastes $133/month on services they don't use. Free trials convert to paid, annual renewals sneak up, and that $9.99/month gym app you used twice keeps charging. People don't know what they're paying for.

## The Solution

A simple app where you add your subscriptions (or auto-detect from bank/email), see your monthly spend, get reminders before renewals, and identify subscriptions to cancel. Privacy-focused—no bank linking required.

**How it works:**

1. **Add subscriptions** — Manual or import from email
2. **Track spending** — See monthly/yearly totals
3. **Get alerts** — Before renewals hit

## Market Research

Subscription fatigue is real. Apps like Rocket Money (formerly Truebill) make millions helping people manage subscriptions. There's room for simpler, privacy-focused alternatives.

- Rocket Money acquired for $1.2B—massive market validation
- Americans spend $219B/year on subscriptions (West Monroe)
- 84% of people underestimate their subscription spending

## AI Prompts to Build This

Copy and paste into Cursor or Claude.

**1. Project Setup**

```text
Create a Next.js PWA for a Subscription Tracker.

Features:
- Dashboard: total monthly spend, upcoming renewals, subscription list
- Add subscription: service picker with logos, custom amount, billing cycle
- Calendar view of renewals
- Categories: Entertainment, Productivity, Health, etc.

Store data locally (privacy-first) with optional cloud sync via Supabase auth.
Include common services database with logos/icons.
```

**2. Smart Features**

```text
Add intelligent features:

1. Email parser: User forwards subscription emails, AI extracts service + price + renewal date
2. "Haven't used in 30 days" flag for app subscriptions
3. Annual vs monthly comparison: "Switch to annual and save $X"
4. Price increase detection: "Spotify went from $9.99 to $11.99"
5. Free trial countdown: Days left before conversion

Use Claude to parse unstructured email data into structured subscription info.
```

**3. Notifications**

```text
Implement notification system:

- Push notification X days before renewal (user configurable: 3, 7, 14 days)
- Monthly summary email: "You spent $X on Y subscriptions"
- Alert when subscription price changes
- Free trial ending reminders

For PWA, use Web Push API. For email, use Resend or similar.
Let users snooze or dismiss reminders.
```
