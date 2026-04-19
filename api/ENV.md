# API environment variables (Vercel)

Set these in the Vercel project **Settings → Environment Variables**. Never commit secrets.

| Variable | Required by | Purpose |
|----------|-------------|---------|
| `BEEHIIV_API_KEY` | [`subscribe.js`](subscribe.js), [`ideas-subscribe.js`](ideas-subscribe.js), [`subscribe/route.js`](subscribe/route.js) | Bearer token for Beehiiv API v2 |

[`ideas-today.js`](ideas-today.js) uses no environment variables (reads `ideas/manifest.json` from the same deployment).

Publication, form, and automation IDs are configured in code (Beehiiv resource IDs, not secret keys). See [`BEEHIIV_SETUP.md`](../BEEHIIV_SETUP.md) for product setup.

### CORS and domains

[`subscribe.js`](subscribe.js) allows browser `Origin` values ending in `.vercel.app`, `http://localhost:*`, and otherwise falls back to `https://weekendmvp.vercel.app`. If you add a **custom production domain**, update the CORS logic in that file so browser forms from the new domain are accepted.
