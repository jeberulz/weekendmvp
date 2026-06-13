---
slug: "product-review-collector"
title: "Automated Review Collector"
---

## The Problem

Social proof drives sales, but most businesses have few reviews. Manually asking customers is awkward and time-consuming. Happy customers forget to leave reviews, while unhappy ones don't forget. Without a system, you're leaving testimonials—and sales—on the table.

## The Solution

An automated system that sends review requests at the perfect time post-purchase. Beautiful, mobile-friendly review forms that take seconds to complete. Collect star ratings, written reviews, and even video testimonials. Display them on your site with an embeddable widget.

**How it works:**

1. **Connect store** — Shopify, WooCommerce, API
2. **Auto-send requests** — X days after delivery
3. **Display reviews** — Widget for your site

## Market Research

- Reviews increase conversion by 270% (Spiegel Research)
- Judge.me, Yotpo process millions of reviews—huge market
- 4.8M Shopify stores need review solutions

## AI Prompts to Build This

**1. Project Setup**

```text
Create a Next.js app for review collection.

Features:
- Dashboard: reviews list, average rating, response rate
- Review form: public link or embedded form
- Widget: embeddable testimonial display for websites
- Email templates: customizable review request emails
- Integrations: Shopify, WooCommerce webhooks

Use Supabase for auth/storage. Resend for emails.
```

**2. Review Flow**

```text
Build the review collection system:

1. Shopify webhook triggers on order fulfilled
2. Schedule email for X days later (user configurable)
3. Email contains unique link to review form
4. Form: star rating (1-5), written review, optional photo upload
5. If rating < 4: route to private feedback (not public)
6. If rating >= 4: ask for public testimonial permission
7. Thank you page with social share options

Handle unsubscribes and don't spam repeat customers.
```

**3. Display Widget**

```text
Create embeddable review widget:

- JS script tag that customer adds to their site
- Display options: carousel, grid, single testimonial
- Filter by: rating, recency, featured
- Customizable styling to match their brand
- Show aggregate: "4.8/5 from 150 reviews"
- Rich snippets: output structured data for SEO
- Responsive: works on mobile

Widget fetches reviews from API, caches for performance.
```
