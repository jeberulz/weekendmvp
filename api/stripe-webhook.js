// Vercel Edge Function: Stripe webhook → Beehiiv paid-cohort enrollment.
//
// Listens for `checkout.session.completed` events from Stripe.
// On a successful $9 ship·able seat purchase, it enrolls the buyer's
// email into the dedicated "Ship.able Workshop" Beehiiv automation,
// which is the workshop-specific flow that delivers confirmation,
// reminders, the Zoom link, the Ship Sheet, and the bonuses. The free
// form-submit waitlist also feeds into this same automation, so
// anyone who has shown interest in ship·able lands in one cohesive
// drip regardless of payment status (paid buyers simply re-enroll,
// which is a no-op for already-enrolled subscribers in Beehiiv).
//
// Required Vercel environment variables:
//   STRIPE_WEBHOOK_SECRET   from Stripe Dashboard → Developers → Webhooks
//   BEEHIIV_API_KEY         existing
//
// Stripe webhook setup (one-time):
//   1. Stripe Dashboard → Developers → Webhooks → Add endpoint
//   2. URL:    https://weekendmvp.app/api/stripe-webhook
//   3. Events: checkout.session.completed
//   4. Copy the signing secret (whsec_...) into Vercel env

export const config = { runtime: 'edge' };

const PUBLICATION_ID = 'pub_5fbc631f-7950-4bac-80fe-80ba70dae2da';
const PAID_AUTOMATION_ID = 'aut_b55c6b1e-330b-4768-b44a-30e9e07ae92a'; // Ship.able Workshop
const SIG_TOLERANCE_SECONDS = 300;

async function verifyStripeSignature(rawBody, sigHeader, secret) {
  if (!sigHeader || !secret) return { ok: false, reason: 'missing-input' };

  let t = null;
  const v1s = [];
  for (const piece of sigHeader.split(',')) {
    const eq = piece.indexOf('=');
    if (eq < 0) continue;
    const k = piece.slice(0, eq).trim();
    const v = piece.slice(eq + 1).trim();
    if (k === 't') t = v;
    else if (k === 'v1') v1s.push(v);
  }
  if (!t || v1s.length === 0) return { ok: false, reason: 'malformed-sig' };

  const ts = parseInt(t, 10);
  if (!Number.isFinite(ts)) return { ok: false, reason: 'bad-timestamp' };
  const skew = Math.abs(Math.floor(Date.now() / 1000) - ts);
  if (skew > SIG_TOLERANCE_SECONDS) return { ok: false, reason: 'timestamp-too-old' };

  const payload = `${t}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const computed = Array.from(new Uint8Array(sigBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

  const valid = v1s.some(sig => sig === computed);
  return { ok: valid, reason: valid ? null : 'sig-mismatch' };
}

async function enrollPaidSubscriber(email, sessionId) {
  const BEEHIIV_API_KEY = process.env.BEEHIIV_API_KEY;
  if (!BEEHIIV_API_KEY) {
    console.error('BEEHIIV_API_KEY missing; cannot enroll paid subscriber', { sessionId });
    return { ok: false, reason: 'beehiiv-not-configured' };
  }

  const resp = await fetch(
    `https://api.beehiiv.com/v2/publications/${PUBLICATION_ID}/subscriptions`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BEEHIIV_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        reactivate_existing: true,
        send_welcome_email: false,
        // Mirror the waitlist flow's source + campaign so the same entry
        // condition fires in Beehiiv. utm_medium=paid is the discriminator
        // the internal automation branch uses to route to paid-only emails.
        utm_source: 'shipable',
        utm_medium: 'paid',
        utm_campaign: 'shipable-workshop',
        automation_ids: [PAID_AUTOMATION_ID],
      }),
    }
  );

  const text = await resp.text();
  if (!resp.ok) {
    console.error('Beehiiv enrollment failed', { sessionId, email, status: resp.status, body: text });
    return { ok: false, reason: 'beehiiv-error', status: resp.status };
  }
  console.log('Paid subscriber enrolled', { sessionId, email });
  return { ok: true };
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return new Response('Webhook not configured', { status: 500 });
  }

  const rawBody = await req.text();
  const sigHeader = req.headers.get('stripe-signature');
  const verified = await verifyStripeSignature(rawBody, sigHeader, secret);
  if (!verified.ok) {
    console.error('Stripe signature verification failed', verified);
    return new Response('Invalid signature', { status: 400 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch (e) {
    return new Response('Invalid JSON', { status: 400 });
  }

  // Acknowledge events we do not handle so Stripe stops retrying.
  if (event.type !== 'checkout.session.completed') {
    return new Response('Ignored', { status: 200 });
  }

  const session = event.data && event.data.object;
  const email =
    (session && session.customer_details && session.customer_details.email) ||
    (session && session.customer_email) ||
    null;
  const sessionId = session && session.id;

  if (!email) {
    console.error('No email on checkout.session.completed', { sessionId });
    return new Response('OK', { status: 200 });
  }

  // Best-effort: do not fail the webhook even if Beehiiv hiccups, so Stripe
  // does not enter a retry loop. Errors are logged for manual reconciliation.
  await enrollPaidSubscriber(email, sessionId).catch((e) => {
    console.error('Enrollment threw', { sessionId, email, error: String(e) });
  });

  return new Response('OK', { status: 200 });
}
