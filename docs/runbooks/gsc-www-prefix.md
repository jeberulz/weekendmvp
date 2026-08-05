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
   - Permission: **Full** or **Owner** (Full is enough for list/submit sitemap).
4. Tell the agent (or run locally):
   ```bash
   node scripts/gsc-submit-sitemap.mjs
   ```

## Already done (agent)

- Sites API `PUT` added `https://www.weekendmvp.app/` for the service account (2026-08-05).
- Owner verified + SA granted Full; sitemap resubmitted successfully (`lastSubmitted` 2026-08-05).
- MCP `GSC_SITE_URL` set to `https://www.weekendmvp.app/`.

## “N submitted / 0 indexed” (read this first)

The Sitemaps report **Indexed** column on a brand-new www URL-prefix property often stays **0 for days** (sometimes longer) even when:

- The sitemap downloaded successfully (`isPending: false`, `lastDownloaded` set)
- URL Inspection shows individual URLs as *Indexed* or *Discovered – currently not indexed*
- The older **Domain** property `sc-domain:weekendmvp.app` already has historical coverage

That is **not** the same as “Google cannot crawl the site.”

Checklist before assuming a crawl block:

1. `curl -sS https://www.weekendmvp.app/robots.txt` — `Allow: /`, Sitemap/Host are www
2. `curl -sS https://www.weekendmvp.app/sitemap.xml | grep -c '<loc>'` — hundreds of www locs
3. Sample page: no `noindex`, canonical is www, apex HTML 308s to www
4. Run inspection (needs SA key):

```bash
npm run gsc:inspect-indexing
```

5. In GSC UI, compare **Domain** coverage vs www URL-prefix Sitemaps “Indexed”
6. After sitemap quality deploys (stable idea `lastmod`, apex robots/sitemap 308), resubmit:

```bash
npm run gsc:submit-sitemap
```

### What we fixed in WP17 (code)

- Idea `lastmod` now comes from `ideas/manifest.json` `publishedAt` (idea MDX has no dates)
- Hubs/roots **omit** fake request-time lastmod
- Apex `/robots.txt` and `/sitemap.xml` 308 to www (middleware matcher)

Google still chooses what to index; we only fix signals and discovery consistency.

## Verify

```bash
# Expect siteOwner (or siteFullUser) + sitemap list / submit OK
node scripts/gsc-submit-sitemap.mjs

# Expect sitemap status + per-URL Inspection verdicts
npm run gsc:inspect-indexing
```

Optional: after Owner grant, you may set MCP `GSC_SITE_URL` to `https://www.weekendmvp.app/` if you want sitemap tools in the GSC MCP to target www. Domain property can stay in the console for whole-host reporting.
