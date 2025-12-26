// Vercel Edge Function for Beehiiv Integration
export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  const origin = req.headers.get('origin');
  const isAllowed = (origin && origin.endsWith('.vercel.app')) ||
                    (origin && (origin.startsWith('http://localhost:'))) ||
                    !origin;

  const corsHeaders = {
    'Access-Control-Allow-Origin': isAllowed ? origin : 'https://weekendmvp.vercel.app',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  try {
    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.error('Error parsing request body:', e);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const { email, first_name } = body;

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Basic email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Validate first_name (allow unicode letters, spaces, hyphens, apostrophes, and dots)
    // Note: Vercel Edge Runtime supports standard JS RegExp.
    // We use a broader check to avoid blocking valid international names.
    if (first_name && first_name.length > 50) {
       return new Response(
        JSON.stringify({ error: 'Name too long' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const BEEHIIV_API_KEY = process.env.BEEHIIV_API_KEY;
    const PUBLICATION_ID = 'pub_5fbc631f-7950-4bac-80fe-80ba70dae2da';
    const FORM_ID = '7346f13f-9331-48d7-97f8-88c38da780b1';
    const AUTOMATION_ID = 'aut_50201ecc-8641-43dc-811b-313be270594b';

    if (!BEEHIIV_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'BEEHIIV_API_KEY not configured in environment variables' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Use the base subscriptions endpoint and pass form_id in the body
    const apiEndpoint = `https://api.beehiiv.com/v2/publications/${PUBLICATION_ID}/subscriptions`;
    
    console.log(`Attempting subscription for ${email} with form ${FORM_ID} at ${apiEndpoint}`);

    const beehiivResponse = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BEEHIIV_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email,
        form_id: FORM_ID, // This links the submission to your form/automation
        reactivate_existing: true,
        send_welcome_email: false,
        utm_source: 'weekend mvp',
        utm_medium: 'website',
        utm_campaign: 'starter-kit',
        automation_ids: [AUTOMATION_ID], // Explicitly trigger the automation
        custom_fields: first_name ? [
          { name: 'first_name', value: first_name }
        ] : []
      }),
    });

    const responseText = await beehiivResponse.text();
    let data = {};
    try {
      if (responseText) data = JSON.parse(responseText);
    } catch (e) {
      data = { raw: responseText };
    }

    if (!beehiivResponse.ok) {
      console.error('Beehiiv API Error:', {
        status: beehiivResponse.status,
        data: data
      });
      // Do not return raw upstream error details to the client to avoid leaking implementation details
      return new Response(
        JSON.stringify({ error: 'Subscription failed', message: data.message || 'Beehiiv API error' }),
        { status: beehiivResponse.status, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log('Subscription successful:', data);

    return new Response(
      JSON.stringify({ success: true, data: data }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Internal server error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

