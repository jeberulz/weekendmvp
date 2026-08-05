# GSC www URL-prefix setup (Sitemaps API)

## Why

The Search Console **Sitemaps API** rejects Domain properties when called with a service account:

> The Sitemaps API does not support domain properties (`sc-domain:weekendmvp.app`) with service accounts.

Canonical host is `https://www.weekendmvp.app` (WP10/WP13). Sitemap locs are all www. So the URL-prefix property must be:

```text
https://www.weekendmvp.app/
```

Service account: `g4-mcp@weekendmvp.iam.gserviceaccount.com`  
Key file: `~/.config/gsc/service-account.json`  
MCP (`~/.mcp.json`) still uses `GSC_SITE_URL=sc-domain:weekendmvp.app` for analytics — leave that until you optionally switch reporting to the www prefix.

## Owner steps (≈2 minutes)

1. Open [Google Search Console](https://search.google.com/search-console).
2. **Add property** → **URL prefix** → enter exactly:
   ```text
   https://www.weekendmvp.app/
   ```
   If you already verified Domain `weekendmvp.app`, this usually **auto-verifies**.
3. Open the new property → **Settings** → **Users and permissions** → **Add user**:
   - Email: `g4-mcp@weekendmvp.iam.gserviceaccount.com`
   - Permission: **Owner** (Full is not enough for some sitemap writes; use Owner).
4. Tell the agent (or run locally):
   ```bash
   node scripts/gsc-submit-sitemap.mjs
   ```

## Already done (agent)

- Sites API `PUT` added `https://www.weekendmvp.app/` for the service account (2026-08-05).
- Status before owner grant: `permissionLevel: siteUnverifiedUser` — sitemap calls 403 until you complete steps 2–3.

## Verify

```bash
# Expect siteOwner (or siteFullUser) + sitemap list / submit OK
node scripts/gsc-submit-sitemap.mjs
```

Optional: after Owner grant, you may set MCP `GSC_SITE_URL` to `https://www.weekendmvp.app/` if you want sitemap tools in the GSC MCP to target www. Domain property can stay in the console for whole-host reporting.
