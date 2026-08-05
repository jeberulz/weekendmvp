# Analytics and validation reporting

Weekend MVP uses consent-gated GA4 and Meta Pixel client tracking. The Next.js
App Router owns analytics globally; publishing skills and individual pages
never inject scripts.

## IDs

| ID | Purpose | Configuration |
| --- | --- | --- |
| `G-Z1NYERTKRS` | GA4 client collection | `NEXT_PUBLIC_GA_ID` at build time |
| `517826359` | GA4 Data API reporting | `GA4_PROPERTY_ID` |
| `1602726847528813` | Meta Pixel | `NEXT_PUBLIC_META_PIXEL_ID` |

`NEXT_PUBLIC_*` values are compiled into the production bundle. Changing one
requires a fresh Vercel build.

## Runtime

- `components/consent/AnalyticsScripts.tsx` loads GA4 and Meta only after
  explicit consent.
- `lib/track.ts` is the client event API. Calls before consent or before GA is
  available intentionally no-op.
- `trackValidationEvent()` adds `source_path` and infers `idea_slug` or
  `hub_slug` from the current route.
- Meta receives the legacy standard-event mapping plus custom events for the
  new validation funnel.

The weekly report therefore represents **consented client traffic**, not all
visitors. Use its rates and week-over-week movement directionally; do not treat
event totals as complete traffic counts.

## Validation funnel

| Event | Trigger | Stable parameters |
| --- | --- | --- |
| `idea_prompt_copied` | Successful clipboard write on an idea prompt | `idea_slug`, `prompt_index`, `source_surface`, `cta_id`, `source_path` |
| `starter_kit_clicked` | Any same-origin link to `/starter-kit` | `source_surface`, `cta_id`, `source_path`, inferred hub/idea |
| `newsletter_subscribed` | Successful Beehiiv/API enrollment or accepted embed fallback | `source_surface`, `cta_id`, `source_path`, inferred hub/idea |
| `checkout_started` | Shipable Stripe redirect begins | `item_id`, `currency`, `value`, `source_surface`, `cta_id` |
| `purchase_completed` | Shipable returns with `?paid=1` | `item_id`, `currency`, `value`, `source_surface`, `cta_id` |

Legacy events such as `signup_form_success`, GA4 `begin_checkout`, and GA4
`purchase` remain during the migration so existing reports and Meta standard
events keep working.

`purchase_completed` is a site-level, client return-page signal. Stripe's
webhook/Convex log remains the payment source of truth; consent rejection,
ad-blocking, or not returning to the site can undercount GA4 purchases.

## Idea validation metadata

New idea manifest entries include:

```json
{
  "validation": {
    "audience": "solo-founders",
    "hypothesis": "Solo founders copy a build prompt after reading the market evidence.",
    "primaryAction": "idea_prompt_copied"
  }
}
```

Allowed primary actions are:

- `idea_prompt_copied`
- `newsletter_subscribed`
- `starter_kit_clicked`

Historical ideas may omit the object and default to `idea_prompt_copied` in
reports. Do not manufacture a historical hypothesis backfill.

## Weekly digest

```bash
npm run validation:digest -- --stdout
```

The generator:

1. reads idea metadata from `ideas/manifest.json`;
2. queries GA4 by built-in `eventName` and `pagePath`;
3. compares seven days with the preceding 28-day baseline;
4. normalizes baseline volume to a seven-day equivalent;
5. flags at least 25% view movement or 2 percentage points of conversion
   movement after the 25-current/100-baseline view gate;
6. writes `reports/validation/YYYY-MM-DD.md`.

No GA4 custom dimensions are required for the digest because idea attribution
comes from `pagePath`. Custom parameters remain useful for exploratory GA4
reports and must be registered as event-scoped custom dimensions before
querying them through the Data API.

The scheduled workflow runs Monday at 08:00 UTC, uploads the Markdown artifact,
and emails the same report through Resend. Configuration and manual-run
instructions are in `docs/runbooks/weekly-validation-digest.md`.

## Verification

After production deployment:

1. Confirm `NEXT_PUBLIC_GA_ID` was present during the build.
2. Accept analytics consent in a clean browser session.
3. Trigger a prompt copy, starter-kit click, and test subscription.
4. Check GA4 Realtime/DebugView for the new names and parameters.
5. Manually run **Weekly validation digest** after repository secrets are set.

Client events do not replace source-of-truth operational data:

- Beehiiv is authoritative for subscriptions.
- Convex `subscriptions` is the site's best-effort enrollment log.
- Stripe plus Convex `stripe_events` is authoritative for purchases.
