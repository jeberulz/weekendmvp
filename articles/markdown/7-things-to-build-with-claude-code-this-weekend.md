---
title: "7 Things You Can Build This Weekend with Claude Code"
description: "Seven shippable project ideas you can build with Claude Code in a single weekend, even if you've never coded. Each comes with a starter prompt you can paste straight in."
date: "2026-05-01"
author: "John Iseghohi"
slug: "7-things-to-build-with-claude-code-this-weekend"
---

# 7 Things You Can Build This Weekend with Claude Code

Each one is shippable in a single weekend. Each comes with a starter prompt you can paste straight in.


![small notecard on a dark desk showing a numbered list with one item checked off in lime](https://weekendmvp.app/image/og/article/7-things-to-build-with-claude-code-this-weekend.png)
---

"What should I build?" is the wrong question. You don't need a big idea. You need a small one you can finish.

Below are seven projects sized to fit a Saturday and a Sunday. Each one is small enough that [Claude Code](https://weekendmvp.app/articles/claude-code-for-non-technical-founders.html) can scaffold it in an hour and you can polish it in five.

---

## 1. A personal CRM that lives in your browser

**Why it matters:** Most founders need to remember 50–200 people, not 5,000. HubSpot is overkill. A spreadsheet is too dumb.

**Starter prompt:**
> "Build a personal CRM. Single-page React app with Tailwind. Local storage only—no backend. Contacts have name, email, last contacted date, follow-up date, and a notes field. List view sorted by who's most overdue for follow-up. Add/edit modal. Export-to-CSV button. Dark theme."

Ship time: 4–6 hours.

---

## 2. A niche newsletter aggregator

**Why it matters:** Every niche has 5–15 great Substacks. Nobody wants to subscribe to all of them. A weekly digest is a real business model.

**Starter prompt:**
> "Build a niche newsletter aggregator. Next.js app. Hardcoded list of 10 RSS feeds for [your niche]. Server-side fetch them on page load. Show title, source, date, and a 2-sentence AI summary using the Claude API. Email-signup form at the top stores to a Supabase table. Deploy to Vercel."

Ship time: 6–8 hours.

---

## 3. A Telegram or Discord bot for your community

**Why it matters:** Automating the boring parts of a community (FAQs, onboarding, weekly threads) is one of the highest-leverage things you can do.

**Starter prompt:**
> "Build a Telegram bot in Node.js. It listens for /faq commands and answers from a markdown file in the repo. On a cron schedule, posts a weekly 'introduce yourself' thread. Greets new members. Use the Telegram Bot API. Deploy to Fly.io."

Ship time: 4–6 hours.

---

## 4. An internal tool you'd actually pay for at work

**Why it matters:** "I built this for my team and other teams want it" is the most reliable wedge into B2B software.

**Starter prompt:**
> "Build a PTO request tracker. Next.js + Supabase auth. Employees submit (start date, end date, reason). Managers see pending requests and approve/deny. Email via Resend. Mobile-responsive."

Ship time: 8–12 hours.

---

## 5. A landing page that validates your idea (with a fake door)

**Why it matters:** Build the page that sells the product before you build the product. If nobody clicks "Sign up," you saved yourself a month.

**Starter prompt:**
> "Build a single-page landing page in Next.js. Headline, subhead, three benefit blocks with icons, social proof, pricing teaser, email signup, FAQ. Tailwind, dark theme. Email goes to Beehiiv via API. Plausible analytics. Deploy to Vercel."

Ship time: 3–5 hours.

---

## 6. A "boring API wrapper" SaaS

**Why it matters:** Take a public API that's hard to use and put a clean UI on top of it. Founders pay $19–$49/month for "I don't have to read the docs."

**Starter prompt:**
> "Build a SaaS that wraps the [API name] API. Users sign up with email + Stripe. They get an API key. Endpoint: POST /process. Charge per call or monthly. Dashboard shows usage and billing. Next.js + Supabase + Stripe."

Ship time: 10–14 hours.

---

## 7. A "show me the data" dashboard for a tiny audience

**Why it matters:** One indie dev built a niche analytics dashboard with Claude Code in 36 hours and had 15 paying users at $19/month within a week.

**Starter prompt:**
> "Build a Stripe dashboard for indie founders. They paste a Stripe restricted API key. Show MRR, churn, top customers, MoM growth chart. Recharts. Daily email digest via Resend. Magic-link auth."

Ship time: 8–12 hours.

---

## How to Actually Start

1. Pick the project that pulled, not the safest.
2. `mkdir weekend-project && cd weekend-project && claude`
3. Paste the starter prompt.
4. Iterate in plain English until shippable.

---

## Want help shipping one of these this weekend?

Book a 1:1 with John. Pick any project on this list—we'll get Claude Code installed, scaffold it together on a screen share, and have a working version live before the call ends. For founders who'd rather have a guide than a tutorial.

**[Book a Claude Code Setup Session →](https://cal.com/switchtoux/mvp-sprint)**

---

**[Browse Startup Ideas →](https://weekendmvp.app/startup-ideas.html)**
