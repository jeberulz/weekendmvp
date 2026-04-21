// Vercel Edge Function: verify an email is an active Beehiiv subscriber
// Used by the idea-page gate (ideas/gate.js) when a visitor arrives with ?e=<email>.
// Returns { ok: true } only when Beehiiv reports the subscription with status
// 'active' or 'validating'. No HMAC — worst-case abuse is a stranger reading a
// public-ish teardown, which is net-positive for us.

export const config = {
  runtime: 'edge',
};

const PUBLICATION_ID = 'pub_5fbc631f-7950-4bac-80fe-80ba70dae2da';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  let body;
  try {
    body = await req.json();
  } catch (_) {
    return json(400, { error: 'Invalid JSON in request body' });
  }

  const email = body && typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!isValidEmail(email)) {
    return json(400, { ok: false, error: 'Invalid email' });
  }

  const apiKey = process.env.BEEHIIV_API_KEY;
  if (!apiKey) {
    return json(500, { error: 'API key not configured' });
  }

  const lookupUrl = `https://api.beehiiv.com/v2/publications/${PUBLICATION_ID}/subscriptions/by_email/${encodeURIComponent(email)}`;

  try {
    const res = await fetch(lookupUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (res.status === 404) {
      return json(200, { ok: false });
    }

    const text = await res.text();
    let data = {};
    if (text) {
      try { data = JSON.parse(text); } catch (_) { data = {}; }
    }

    if (!res.ok) {
      console.error('Beehiiv verify error', { status: res.status, body: data });
      return json(200, { ok: false });
    }

    const status = data && data.data ? data.data.status : undefined;
    const ok = status === 'active' || status === 'validating';
    return json(200, { ok });
  } catch (error) {
    console.error('Verify error:', error);
    return json(200, { ok: false });
  }
}
