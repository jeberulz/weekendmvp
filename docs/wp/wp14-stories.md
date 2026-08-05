# WP14 Stories - GSC www URL-prefix property for Sitemaps API

Branch: `fix/wp14-gsc-www-prefix`
Lane: Work Package
Registry: `docs/PROJECT_STRATEGY.md`
Definition of done: `https://www.weekendmvp.app/` exists as a verified URL-prefix property in Search Console; service account `g4-mcp@weekendmvp.iam.gserviceaccount.com` is Owner; Sitemaps API can list/submit `https://www.weekendmvp.app/sitemap.xml`.

## Stories

- [x] `WP14-S1` - Add URL-prefix property via Sites API
  - Scope: Search Console Sites API (`g4-mcp@weekendmvp.iam.gserviceaccount.com`)
  - Acceptance criteria:
    - `PUT .../sites/https%3A%2F%2Fwww.weekendmvp.app%2F` succeeds.
    - Property appears in `sites.list` for the service account.
  - Verification:
    - Sites API list/get (2026-08-05): property present at `siteUnverifiedUser`.

- [ ] `WP14-S2` - Owner verifies property + grants SA Owner (manual)
  - Scope: Google Search Console UI (owner Google account)
  - Acceptance criteria:
    - `https://www.weekendmvp.app/` is verified under the owner account (Domain ownership usually auto-verifies URL-prefix).
    - Users → `g4-mcp@weekendmvp.iam.gserviceaccount.com` → **Owner**.
  - Verification:
    - Sites API `get` returns `siteOwner` (or Full) for the SA; `list_sitemaps` no longer 403s.

- [ ] `WP14-S3` - Submit sitemap + point MCP/scripts at www prefix
  - Scope: `scripts/gsc-submit-sitemap.mjs`, `docs/runbooks/gsc-www-prefix.md`, `~/.mcp.json` `GSC_SITE_URL` note
  - Acceptance criteria:
    - Script submits `https://www.weekendmvp.app/sitemap.xml` successfully.
    - Runbook documents owner steps + verify command.
  - Verification:
    - `node scripts/gsc-submit-sitemap.mjs` exits 0 and lists the sitemap.

## Out Of Scope

- Replacing the Domain property (`sc-domain:weekendmvp.app`) — keep it for whole-domain analytics.
- Content/CTR work from the Aug 5 traffic report.

## Notes

- Sitemaps API does **not** support Domain properties with service accounts. URL-prefix is required.
- Canonical host is www (WP10/WP13); do **not** use apex `https://weekendmvp.app/` as the sitemap property — sitemap locs are all www.
