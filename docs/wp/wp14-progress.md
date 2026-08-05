# WP14 Progress - GSC www URL-prefix property for Sitemaps API

## Status

Blocked on owner GSC UI verification + SA Owner grant (S2). S1 done; S3 script ready.

## S1 — Add URL-prefix via Sites API

- 2026-08-05: `PUT` `https://www.weekendmvp.app/` as the service account
- `sites.get` → `permissionLevel: siteUnverifiedUser`
- Sitemaps API still 403 until S2

## S2 — Owner verify + grant (manual)

See `docs/runbooks/gsc-www-prefix.md`.

Checklist for owner:
1. [ ] Add URL-prefix `https://www.weekendmvp.app/` in GSC (auto-verify expected via Domain)
2. [ ] Add `g4-mcp@weekendmvp.iam.gserviceaccount.com` as **Owner**
3. [ ] Ping agent / run `node scripts/gsc-submit-sitemap.mjs`

## S3 — Submit sitemap script

- Added `scripts/gsc-submit-sitemap.mjs` (JWT auth, no extra deps)
- Runbook: `docs/runbooks/gsc-www-prefix.md`

## Verification

- Pending S2, then `node scripts/gsc-submit-sitemap.mjs`
