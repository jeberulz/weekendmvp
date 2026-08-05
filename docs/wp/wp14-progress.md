# WP14 Progress - GSC www URL-prefix property for Sitemaps API

## Status

**Done** (2026-08-05).

## S1 — Add URL-prefix via Sites API

- `PUT` `https://www.weekendmvp.app/` for the service account
- Initially `siteUnverifiedUser`

## S2 — Owner verify + grant

- Owner verified www URL-prefix in GSC UI
- SA `g4-mcp@weekendmvp.iam.gserviceaccount.com` granted **Full** (sufficient for Sitemaps API)
- `sites.get` → `permissionLevel: siteFullUser`

## S3 — Submit sitemap

- `npm run gsc:submit-sitemap` → 204
- Sitemap `https://www.weekendmvp.app/sitemap.xml` resubmitted (`lastSubmitted` 2026-08-05T09:09:32Z, `isPending: true`)
- 256 URLs submitted / 0 indexed (indexing lag — separate from API access)
- `~/.mcp.json` `GSC_SITE_URL` updated to `https://www.weekendmvp.app/`

## Verification

```text
node scripts/gsc-submit-sitemap.mjs  → OK
```
