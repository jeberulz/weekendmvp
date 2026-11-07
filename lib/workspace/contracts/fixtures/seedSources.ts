/**
 * WP90 fixture idea pages: the MDX and manifest rows the seed fixtures in
 * `seeds.ts` are drafted from. The quotes in those drafts are verbatim here.
 */
import type { SeedSourceManifestRow } from "../../crew/seedSource";
import { BAKERY_SLUG } from "./seeds";

export const hydrotrailPageMdx = `---
slug: "hydrotrail"
title: "HydroTrail"
---

## The Problem

Solo hikers plan water by rules of thumb. On long, hot routes with few water sources they carry too little, or far too much. One hiker on a forum put it simply: "I always run dry on the last climb."

## The Solution

A hydration planner that turns the route, the heat and the climb into litres to carry and sip times.

**How it works:**

1. **Enter your route** — distance, climb and the forecast
2. **Get your plan** — litres to carry and when to drink
3. **Log what you drank** — one tap

## Competitive Landscape

General water reminder apps set fixed daily targets. Route planners show elevation but treat hydration as an afterthought.

## Business Model

Free to plan one route; a paid tier for saved routes and reminders.

## Recommended Tech Stack

Next.js, Supabase and Vercel.

## AI Prompts to Build This

**1. Project Setup**

\`\`\`text
Build HydroTrail, a hydration planner for solo hikers.
Stack: Next.js, Supabase (database and Supabase Auth), Vercel.
Do not build: billing, live GPS tracking.
Done when: sign-in works and the tables exist.
\`\`\`

**2. Core Feature**

\`\`\`text
1. Route in: distance, climb, temperature.
2. Plan out: litres to carry and sip times.
Done when: a sample route returns a plan.
\`\`\`

## Sources

- [Hiking forum thread](https://example.com/thread)
`;

export const hydrotrailManifestRow: SeedSourceManifestRow = {
  slug: "hydrotrail",
  title: "HydroTrail",
  description: "A hydration planner for solo hikers.",
  category: "health",
  audiences: ["hikers"],
  researchLevel: "deep",
};

export const bakeryPageMdx = `---
slug: "${BAKERY_SLUG}"
title: "Neighbourhood bakery pre-orders"
---

## The Problem

The best bakes sell out early, and regulars who come later leave empty-handed. Phoning ahead means calling during the morning rush.

## The Solution

A pre-order page for one bakery: tomorrow's bake, a cut-off, and pick-up slots.

**How it works:**

1. **See tomorrow's bake** — the list goes up each afternoon
2. **Pre-order** — pick items and a pick-up time
3. **Collect it warm** — at the counter, no queue

## Competitive Landscape

Food delivery marketplaces are built for delivery, not counter pick-up.

## Business Model

Customers pay per order.
`;

export const bakeryManifestRow: SeedSourceManifestRow = {
  slug: BAKERY_SLUG,
  title: "Neighbourhood bakery pre-orders",
  description: "Pre-order bread and pastries from your local bakery.",
  audiences: ["small-business-owners"],
  researchLevel: "concept",
  provenance: { auditPassed: false },
};
