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

