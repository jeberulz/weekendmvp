// Vercel Edge Function for Startup Ideas Email Capture
// Uses the same Beehiiv integration with different UTM tracking

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
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

    // Validate required fields
    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get API key from environment variable
    const BEEHIIV_API_KEY = process.env.BEEHIIV_API_KEY;
    const PUBLICATION_ID = 'pub_5fbc631f-7950-4bac-80fe-80ba70dae2da';
    const AUTOMATION_ID = 'aut_cccbc451-43b6-4968-a713-df83afc32cff';

    if (!BEEHIIV_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Call Beehiiv API - using general subscriptions endpoint
    const apiEndpoint = `https://api.beehiiv.com/v2/publications/${PUBLICATION_ID}/subscriptions`;

    const beehiivResponse = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BEEHIIV_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email,
        reactivate_existing: true,
        send_welcome_email: false,
        utm_source: 'startup-ideas',
        utm_medium: 'website',
        utm_campaign: 'daily-ideas',
        automation_ids: [AUTOMATION_ID],
        custom_fields: [
          { name: 'first_name', value: first_name || 'Friend' }
        ],
      }),
    });

    // Parse response
    let data = {};
    const responseText = await beehiivResponse.text();

    if (responseText) {
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        data = { raw_response: responseText };
      }
    }

    if (!beehiivResponse.ok) {
      // Check if it's a duplicate subscriber (which is fine)
      if (beehiivResponse.status === 409 || (data.message && data.message.includes('already'))) {
        return new Response(
          JSON.stringify({ success: true, message: 'Already subscribed' }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      }

      console.error('Beehiiv API Error:', {
        status: beehiivResponse.status,
        response: data,
        email: email
      });

      return new Response(
        JSON.stringify({ error: data.message || 'Failed to subscribe' }),
        {
          status: beehiivResponse.status,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      );
    }

    // Success
    return new Response(
      JSON.stringify({ success: true, message: 'Successfully subscribed' }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );

  } catch (error) {
    console.error('Subscription error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
