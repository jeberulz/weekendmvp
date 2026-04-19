# Beehiiv API V2 Integration Guide

Use this guide as a reference for implementing Beehiiv email subscriptions via serverless functions (Vercel, Netlify, etc.) to trigger automations and handle UTM tracking.

## 1. Required Credentials
Gather these from your Beehiiv Dashboard:
- **API Key**: `Settings > API > Create New API Key` (Copy immediately).
- **Publication ID**: `Settings > API > Publication ID` (Format: `pub_...`).
- **Form ID**: `Audience > Forms > [Your Form] > ID` (Format: `7346...`).
- **Automation ID**: `Write > Automations > [Your Automation] > ID` (Format: `aut_...`).

## 2. API Implementation (Vercel Edge/Node)

**Endpoint**: `POST https://api.beehiiv.com/v2/publications/{publication_id}/subscriptions`

### Implementation Logic
```javascript
const response = await fetch(`https://api.beehiiv.com/v2/publications/${PUBLICATION_ID}/subscriptions`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.BEEHIIV_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: userEmail,
    form_id: FORM_ID,             // Triggers form-specific logic
    automation_ids: [AUTOMATION_ID], // Explicitly enters the automation
    reactivate_existing: true,    // Allows re-subscribing for testing
    send_welcome_email: false,    // Set to false if using Automation for delivery
    utm_source: 'your_source',
    utm_medium: 'website',
    custom_fields: [
      { name: 'first_name', value: firstName }
    ]
  }),
});
```

## 3. Deployment Steps
1. **Environment Variables**: Store the API key as `BEEHIIV_API_KEY`.
2. **CORS**: Ensure your serverless function handles `OPTIONS` preflight and sets `Access-Control-Allow-Origin: *`.
3. **Response Parsing**: Always read the response as text first before `JSON.parse()` to avoid "Unexpected end of JSON" errors on empty responses.

## 4. Troubleshooting Checklist
- **404 Error**: Usually means the `publication_id` in the URL is wrong.
- **401 Error**: Invalid or missing `BEEHIIV_API_KEY`.
- **422 Error**: Missing required fields (like `email`) or invalid `form_id`.
- **Automation not firing**:
    - Ensure the Automation is **Live** in Beehiiv.
    - Check if the subscriber is stuck in **Pending** (Double Opt-in).
    - Verify the `form_id` is passed in the body, not the URL.

## 5. Security Best Practices
- **Never** expose the API Key on the frontend.
- **Always** use a server-side proxy (Serverless Function) to hide credentials.
- Validate emails on the frontend before sending to the API.

---

## 6. Sending Posts (Newsletter)

For the `/newsletter` skill that drafts the twice-daily AM/PM sends.

**Endpoint:** `POST https://api.beehiiv.com/v2/publications/{publication_id}/posts`

**Plan tier — confirmed Enterprise-only (2026-04-19).** A pre-flight curl against this publication returned:

```
HTTP 403
{"message":"This endpoint is only available on the enterprise plan","code":"SEND_API_NOT_ENTERPRISE_PLAN"}
```

Until the publication is upgraded, **do not call this endpoint**. The `/newsletter` skill emits paste-ready markdown instead; you send via Beehiiv's web editor. The rest of this section is kept as reference for a future upgrade.

### Body shape (block-based)

Beehiiv wraps every post in the publication theme and **strips `<style>` and `<link>`** from custom HTML. Use the `blocks[]` array instead of raw HTML.

```jsonc
{
  "title": "Idea of the Day: AI Meeting Notes Cleaner",
  "subtitle": "A $1K/mo weekend build that cleans up Zoom transcripts",
  "thumbnail_image_url": "https://weekendmvp.app/image/og-image.png",
  "status": "confirmed",              // or "draft" for pre-flight
  "scheduled_at": "2026-04-20T12:30:00Z",  // UTC ISO, required when status=confirmed
  "blocks": [
    { "type": "heading", "level": 1, "text": "Idea of the Day" },
    { "type": "paragraph", "text": "Fresh hook from Ideabrowser MCP…" },
    { "type": "heading", "level": 2, "text": "Why it's a weekend build" },
    { "type": "paragraph", "text": "~8h to MVP, $1K/mo target. Stack: Cursor, Claude, Bolt." },
    { "type": "advertisement", "opportunity_id": "opp_..." },  // only if ad-opportunities.yml matches
    { "type": "button", "text": "Read the full teardown →", "url": "https://weekendmvp.app/ideas/.../?utm_source=beehiiv&utm_medium=newsletter&utm_campaign=am-20260420" },
    { "type": "divider" },
    { "type": "paragraph", "text": "Got a weekend? Try this idea." }
  ],
  "content_tags": ["slot-am"],
  "recipients": { "tier": "all" },
  "web_settings": { "audience": "no_web" }  // or "free" to also publish to the public Beehiiv site
}
```

### Allowed block types
`heading`, `paragraph`, `button`, `divider`, `advertisement`, `image`. Do not invent new types — Beehiiv rejects the whole payload if a type is unknown.

### Ads
- Ad opportunities are accepted once in the Beehiiv dashboard → **Ad Network → Opportunities**. Each approved opportunity has an `opportunity_id`.
- To attach an ad to a send, insert an `advertisement` block with that `opportunity_id` in the post payload. No other ad config is required per send.
- The `/newsletter` skill reads `content/newsletter/ad-opportunities.yml` and only inserts ads whose window contains the send time. If no match, the ad block is omitted entirely.

### Theme
The email shell (logo, colors, from-name, footer, unsubscribe) is controlled in the Beehiiv dashboard → **Publication Settings → Theme**. Configure once per publication. The API body never specifies these.

### Local send contract (paused — Enterprise-only)
The Edge route `api/newsletter/send.js` was removed on 2026-04-19 after confirming the plan restriction. The `/newsletter` skill now writes paste-ready markdown to `content/newsletter/YYYY-MM-DD-{am,pm}.md` and hands off to the Beehiiv web editor. To restore API sends later, restore the route from git history and re-add `NEWSLETTER_SEND_SECRET` to the Vercel env.

### Troubleshooting (if the endpoint is re-enabled)
- **403 `SEND_API_NOT_ENTERPRISE_PLAN`** — publication is not on Enterprise. Paste via the dashboard.
- **422 with `blocks`** — a block is missing required fields (e.g. `button` without `url`). Check Beehiiv's error body verbatim.
- **Scheduled send fires early/late** — confirm `scheduled_at` is UTC ISO (`Z` suffix); the skill converts local slots to UTC via configured `TZ`.
- **Post visible on Beehiiv public site unexpectedly** — set `web_settings.audience` to `"no_web"`.

### What still works on non-Enterprise tiers
- **GET `/posts/{id}?expand=stats`** — available on all tiers. `/newsletter stats` uses this to pull opens/clicks per post (requires `BEEHIIV_API_KEY`).
- **GET `/posts`** — list posts for a publication; useful for reconciliation.
- **POST `/subscriptions`** — the existing subscribe flow is unaffected.

