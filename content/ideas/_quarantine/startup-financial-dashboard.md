---
slug: "startup-financial-dashboard"
title: "Startup Financial Dashboard"
---

## The Problem

Early-stage founders live in spreadsheets tracking MRR, runway, churn, and burn rate. It's error-prone, time-consuming, and doesn't update automatically. When investors ask for metrics, founders scramble to pull numbers together. Nobody has a real-time view of their financial health.

## The Solution

Connect Stripe and your bank account, and see all your key metrics in one beautiful dashboard. MRR, ARR, churn, runway, burn rate—calculated automatically and updated daily. Share a view with investors. Get alerts when runway drops below X months.

**How it works:**

1. **Connect accounts** — Stripe, bank via Plaid
2. **Auto-calculate** — MRR, runway, burn rate
3. **Monitor & share** — Alerts and investor view

## Market Research

- Baremetrics, ChartMogul prove SaaS metrics tools work
- Existing tools focus on revenue only, not full financial picture
- 30M+ small businesses globally need financial visibility

## AI Prompts to Build This

**1. Project Setup**

```text
Create a Next.js app for startup financial dashboard.

Features:
- Dashboard: key metrics cards, trend charts
- Integrations: Stripe, Plaid for bank data
- Settings: expense categories, alert thresholds
- Investor view: shareable read-only dashboard link
- Historical data: month-over-month comparisons

Use Supabase for auth and storing calculated metrics.
Schedule daily data sync and recalculation.
```

**2. Metrics Calculation**

```text
Implement core financial calculations:

From Stripe:
- MRR: sum of active subscription amounts
- ARR: MRR × 12
- Churn: lost MRR / starting MRR
- Net revenue retention: (starting + expansion - contraction - churn) / starting
- Customer count and growth

From bank:
- Burn rate: average monthly expenses
- Runway: current balance / burn rate
- Cash flow: income - expenses

Display with trend indicators (up/down vs last month).
```

**3. Alerts & Reports**

```text
Add monitoring and reporting:

Alerts:
- Runway drops below X months
- MRR drops more than Y% in a month
- Unusual expense detected

Weekly email digest: key metrics summary, notable changes

Investor view:
- Generate shareable link with passcode
- Show curated metrics (what you choose to share)
- Update automatically

Export: monthly PDF report for board meetings.
```
