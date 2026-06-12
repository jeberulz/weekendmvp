---
slug: "changelog-generator"
title: "Changelog Generator"
---

## The Problem

Keeping a public changelog is essential for user trust, but it's tedious work that always falls behind. Developers write commits, ship features, but never update the changelog. Users are left wondering what's new, and founders lose a chance to celebrate progress.

## The Solution

Connect your GitHub repo, and AI reads your commits + PRs to generate user-friendly changelog entries. Hosted on a beautiful public page with email subscriptions for updates. Ship code, changelog updates itself.

**How it works:**

1. **Connect GitHub** — OAuth to your repo
2. **AI writes changelog** — Human-readable from commits
3. **Publish & notify** — Beautiful page, email subscribers

## Market Research

Every SaaS needs a changelog. Tools like Headway and ChangeCrab prove demand. AI can make this zero-effort instead of another task on the list.

- Headway used by 5,000+ companies including Buffer, Loom
- Most changelogs are 3+ months out of date (audit popular SaaS)
- Changelogs boost user retention and reduce churn

## AI Prompts to Build This

Copy and paste into Cursor or Claude.

**1. Project Setup**

```text
Create a Next.js app for an AI Changelog Generator.

Features:
- GitHub OAuth for connecting repositories
- Dashboard: list of connected repos, changelog status
- Public changelog page: yourapp.changelog.app or custom domain
- Email subscription widget embeddable on the changelog page
- Edit mode to tweak AI-generated entries before publishing

Use Supabase for auth and data storage.
```

**2. AI Generation**

```text
Create the changelog generation logic:

1. On GitHub webhook (push/release), fetch recent commits
2. Filter out: merge commits, dependency updates, minor fixes (configurable)
3. Send significant commits to Claude with prompt:
   "Convert these Git commits into user-friendly changelog entries. Group by: New Features, Improvements, Bug Fixes. Write for end-users, not developers. Be concise."
4. Store as draft for review or auto-publish (user setting)
5. Support semantic versioning tagging
```

**3. Public Page**

```text
Build beautiful public changelog page:

- Clean timeline layout with dates and version numbers
- Categories with icons: ✨ New, 🔧 Improved, 🐛 Fixed
- Search and filter by date/category
- RSS feed for power users
- "Subscribe for updates" email capture
- Embeddable widget (JS snippet) for SaaS dashboards
- SEO optimized with proper meta tags
```
