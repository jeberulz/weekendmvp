// Vercel Edge Function for Beehiiv Integration.
//
// Default behavior (no body overrides) enrolls subscribers in the
// "Weeekend MVP" / starter-kit automation, preserving the existing
// flow used by the newsletter, 404 page, idea pages, etc.
//
// Pages can pass an explicit { automation_ids, utm_campaign } in the
// JSON body to route the subscriber into a different live automation,
// e.g. the ship·able workshop waitlist. Only automation IDs on the
// ALLOWED_AUTOMATIONS allowlist are honored; anything else falls back
// to the default automation so this endpoint cannot be abused to enroll
// emails into arbitrary flows.

export const config = {
  runtime: 'edge',
};

const PUBLICATION_ID = 'pub_5fbc631f-7950-4bac-80fe-80ba70dae2da';

// Default form + automation = the long-running Weekend MVP welcome flow.
const DEFAULT_FORM_ID = '7346f13f-9331-48d7-97f8-88c38da780b1';
const DEFAULT_AUTOMATION_ID = 'aut_50201ecc-8641-43dc-811b-313be270594b';
const DEFAULT_UTM_CAMPAIGN = 'starter-kit';

// Allowlist of automations a caller may enroll into via this endpoint.
// COHORT_1_PAID is intentionally NOT here — that is server-only via the
// Stripe webhook so a malicious caller cannot mark themselves "paid".
const ALLOWED_AUTOMATIONS = new Set([
  DEFAULT_AUTOMATION_ID,
  'aut_b55c6b1e-330b-4768-b44a-30e9e07ae92a', // Ship.able Workshop (waitlist)
]);

const ALLOWED_UTM_CAMPAIGNS = new Set([
  DEFAULT_UTM_CAMPAIGN,
  'shipable-workshop',
  'newsletter',
  'idea-page',
  '404-page',
]);

export default async function handler(req) {
  const origin = req.headers.get('origin');
  const isAllowed = origin && (
    origin.endsWith('.vercel.app') ||
    origin.endsWith('weekendmvp.app') ||
    origin.startsWith('http://localhost:')
  );

  const corsHeaders = {
    'Access-Control-Allow-Origin': isAllowed ? origin : 'https://weekendmvp.app',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON in request body' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  const { email, first_name } = body;

  if (!email) {
    return new Response(
      JSON.stringify({ error: 'Email is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return new Response(
      JSON.stringify({ error: 'Invalid email format' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  if (first_name && first_name.length > 50) {
    return new Response(
      JSON.stringify({ error: 'Name too long' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  // Honor explicit automation routing if the caller provides allowed IDs.
  let automationIds = [DEFAULT_AUTOMATION_ID];
  if (Array.isArray(body.automation_ids) && body.automation_ids.length > 0) {
    const filtered = body.automation_ids
      .filter((id) => typeof id === 'string' && ALLOWED_AUTOMATIONS.has(id));
    if (filtered.length > 0) automationIds = filtered;
  }

  // Pages may also override the UTM campaign (allowlisted) and form ID.
  const utmCampaign = (typeof body.utm_campaign === 'string' && ALLOWED_UTM_CAMPAIGNS.has(body.utm_campaign))
    ? body.utm_campaign
    : DEFAULT_UTM_CAMPAIGN;
  const formId = (typeof body.form_id === 'string' && body.form_id.length === DEFAULT_FORM_ID.length)
    ? body.form_id
    : DEFAULT_FORM_ID;

  const BEEHIIV_API_KEY = process.env.BEEHIIV_API_KEY;
  if (!BEEHIIV_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'BEEHIIV_API_KEY not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  try {
    const apiEndpoint = `https://api.beehiiv.com/v2/publications/${PUBLICATION_ID}/subscriptions`;

    const beehiivResponse = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BEEHIIV_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        form_id: formId,
        reactivate_existing: true,
        send_welcome_email: false,
        utm_source: body.utm_source || 'weekendmvp',
        utm_medium: body.utm_medium || 'website',
        utm_campaign: utmCampaign,
        automation_ids: automationIds,
        custom_fields: first_name ? [{ name: 'first_name', value: first_name }] : [],
      }),
    });

    const responseText = await beehiivResponse.text();
    let data = {};
    try { if (responseText) data = JSON.parse(responseText); } catch (e) { data = { raw: responseText }; }

    if (!beehiivResponse.ok) {
      console.error('Beehiiv API error:', { status: beehiivResponse.status, data });
      return new Response(
        JSON.stringify({ error: 'Subscription failed', message: 'Unable to process subscription. Please try again later.' }),
        { status: beehiivResponse.status, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data, routed_to: { automation_ids: automationIds, utm_campaign: utmCampaign } }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error) {
    console.error('Internal server error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}
