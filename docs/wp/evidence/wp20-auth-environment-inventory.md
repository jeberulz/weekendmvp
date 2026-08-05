# WP20 Auth And Environment Inventory

Read-only evidence captured on 2026-08-05. This document records names, counts, and schema field names only. It contains no environment values, deployment credentials, document IDs, emails, tokens, Stripe identifiers, or raw production rows.

## Targets And Access

| Target | Read-only access | Result |
|---|---|---|
| Local Convex deployment selected by `.env.local` | Configured as local, backend not running | No local rows inspected. Start `npx convex dev` before the WP21 isolated spike. |
| Default Convex production deployment | Available through the authenticated Convex CLI | Table names, aggregate counts, duplicate counts, dangling-reference counts, and environment-variable names inspected. |
| Linked Vercel project | Available through the authenticated Vercel CLI | Variable names and target environments inspected; no values were read or recorded. |
| Stripe | No Stripe API inventory was required or attempted | Existing Convex event aggregate only; live object inspection remains a later owner-approved billing task. |

## Production Convex Aggregate Inventory

The CLI read at most 10,000 documents per table. All inspected counts were below that ceiling.

| Table | Rows | Schema shape summary | Duplicate/dangling result |
|---|---:|---|---|
| `users` | 0 | `_id`, `_creationTime`, `tokenIdentifier`, `email`, optional `displayName`, optional `stripeCustomerId`, `createdAt` | 0 duplicate normalized emails; 0 duplicate tokens |
| `saved_ideas` | 0 | `_id`, `_creationTime`, `userId`, `ideaId`, `savedAt` | 0 duplicate user/idea pairs; 0 dangling user refs; 0 dangling idea refs |
| `stripe_events` | 0 | `_id`, `_creationTime`, `stripeEventId`, `type`, optional email/customer/amount/currency/payment-link/raw-payload fields, `createdAt` | 0 duplicate event IDs |
| `subscriptions` | 0 | `_id`, `_creationTime`, `email`, `source`, `automationIds`, optional UTM/status fields, `createdAt` | 0 duplicate normalized emails |
| `ideas` | 160 | Existing content schema in `convex/schema.ts`; used only to validate saved-idea targets | No saved-idea references existed |

Consequences for WP21:

- There are no production legacy `users` or `saved_ideas` rows to preserve, merge, or backfill at the time of this inventory.
- This does **not** authorize dropping or recreating either table. WP21 still uses a compatibility-first schema plan and must preserve IDs if rows appear between this inventory and execution.
- Re-run this aggregate inventory immediately before any production schema/auth action; the counts are a point-in-time observation, not a lock.
- Production has no Convex deployment environment variables configured. WP21 cannot activate authentication in production until the required keys are provisioned and the separate backup/approval gate passes.

## Environment-Key Classification

### Vercel Preview And Production

Present in both Preview and Production:

- `BEEHIIV_API_KEY` (also Development)
- `BEEHIIV_DEFAULT_AUTOMATION_ID`
- `BEEHIIV_DEFAULT_FORM_ID`
- `BEEHIIV_IDEAS_AUTOMATION_ID`
- `BEEHIIV_PAID_AUTOMATION_ID`
- `BEEHIIV_PUBLICATION_ID`
- `BEEHIIV_SHIPABLE_AUTOMATION_ID`
- `NEXT_PUBLIC_BASE_URL`
- `NEXT_PUBLIC_CONVEX_SITE_URL`
- `NEXT_PUBLIC_CONVEX_URL`
- `NEXT_PUBLIC_GA_ID`
- `NEXT_PUBLIC_META_PIXEL_ID`
- `REVALIDATE_SECRET`
- `VERCEL_SUPPORT_LARGE_FUNCTIONS`

Production only:

- `STRIPE_WEBHOOK_SECRET`

Not present in the linked Vercel project at inspection time, although named in local configuration or future work:

- `STRIPE_SECRET_KEY`
- `LEGACY_ORIGIN` (optional Next rewrite origin; `next.config.ts` has a fallback)
- `OPENAI_API_KEY`
- `RECRAFT_API_KEY`
- `RECRAFT_STYLE_ID`
- `IDEABROWSER_API_KEY`
- WP21 Convex Auth keys listed below

Vercel system-provided build/deployment keys are intentionally omitted from this application inventory.

### Local And Operator Tooling

These statically referenced keys are operator/build inputs rather than Vercel application secrets:

- `GSC_KEY_FILE`: local path to the Search Console service-account JSON; the JSON and path value are not committed.
- `GSC_SITE_URL`: optional Search Console property override for the GSC scripts.
- `GSC_SITEMAP_URL`: optional sitemap URL override for the GSC scripts.
- `STRICT`: command-scoped quality flag used by the OG-card checker (`STRICT=1`), not a stored secret.

The static source scan also confirmed the current application keys already classified above: all Beehiiv keys, `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_CONVEX_URL`, analytics IDs, `REVALIDATE_SECRET`, Stripe keys, `SITE_URL`, OpenAI, and Recraft keys. `NEXT_PUBLIC_CONVEX_SITE_URL` is present in deployed configuration for the Convex HTTP-actions origin even though current application source does not yet read it directly. `IDEABROWSER_API_KEY` is used by MCP/content tooling rather than runtime source.

### Convex Dev And Production

Convex environment variables are deployment-scoped. The production deployment currently has no application variables. Current official Convex Auth manual setup requires the following deployment variables for the owner-approved OAuth/magic-link path:

- `SITE_URL`
- `JWT_PRIVATE_KEY`
- `JWKS`

The approved Google OAuth path additionally uses the current official provider names:

- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`

The magic-link delivery provider and its provider-specific key name are `UNKNOWN`. The owner must select that provider during WP21; no Resend or other vendor key is assumed by WP20.

The same required names will later need distinct production values. They must not be copied from development, committed, printed, or passed as literal command-line arguments. `JWT_PRIVATE_KEY` and `JWKS` must be generated as one RS256 pair by the current official setup flow, never composed independently.

## Owner-Side Commands And WP21 Block

WP21 may begin its isolated code and local/dev spike, but production auth activation is blocked until the following owner-controlled preflight is complete.

1. Start or select an isolated development deployment, then confirm the target before setting anything:

   ```bash
   npx convex dev
   npx convex env list --names-only --deployment <isolated-dev-ref>
   ```

2. Follow the current official manual setup to generate the RS256 pair, then set/verify the three baseline deployment names without placing values in shell history or this repository:

   ```bash
   npx convex env set SITE_URL --deployment <isolated-dev-ref>
   npx convex env set JWT_PRIVATE_KEY --deployment <isolated-dev-ref>
   npx convex env set JWKS --deployment <isolated-dev-ref>
   npx convex env list --names-only --deployment <isolated-dev-ref>
   ```

3. Configure the owner-approved Google OAuth client and set its official provider names interactively:

   ```bash
   npx convex env set AUTH_GOOGLE_ID --deployment <isolated-dev-ref>
   npx convex env set AUTH_GOOGLE_SECRET --deployment <isolated-dev-ref>
   ```

   Stop before magic-link provisioning. Provider selection and the provider-specific environment key require an owner ruling in WP21.

4. Add any Next/Vercel key that WP21 proves necessary using Vercel's interactive command and the exact Preview target. Do not add guessed keys:

   ```bash
   npx vercel env add <KEY_NAME> preview
   npx vercel env ls
   ```

5. Immediately before a production migration, re-run the redacted counts, create the required Convex backup and Git restore marker, record the exact inventory in `docs/wp/backup-restore.md`, and obtain owner approval. Only then provision the approved production names through the official flow:

   ```bash
   npx convex env list --prod --names-only
   npx convex env set <APPROVED_KEY_NAME> --prod
   ```

No production environment variable, schema, row, deployment, OAuth application, mail-provider configuration, Stripe object, or domain was changed by WP20.

## Sources

- Convex environment variables: <https://docs.convex.dev/production/environment-variables>
- Convex CLI environment reference: <https://docs.convex.dev/cli/reference/env>
- Convex Auth status and supported methods: <https://docs.convex.dev/auth/convex-auth>
- Convex Auth current manual setup (`SITE_URL`, `JWT_PRIVATE_KEY`, `JWKS`): <https://labs.convex.dev/auth/setup/manual>
- Convex Auth Google OAuth names: <https://labs.convex.dev/auth/config/oauth/google>
- Local schema: `convex/schema.ts`
