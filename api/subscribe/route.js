// Vercel Edge Function for Beehiiv Integration
// This is the NEW recommended approach - simpler and faster

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
    if (!email || !first_name) {
      return new Response(
        JSON.stringify({ error: 'Email and first name are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get API key from environment variable
    const BEEHIIV_API_KEY = process.env.BEEHIIV_API_KEY;
    const PUBLICATION_ID = 'pub_5fbc631f-7950-4bac-80fe-80ba70dae2da';
    const FORM_ID = '7346f13f-9331-48d7-97f8-88c38da780b1';

    if (!BEEHIIV_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'API key not configured. Please add BEEHIIV_API_KEY to your environment variables.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Call Beehiiv API V2 - Try form-specific endpoint first (triggers automation)
    let beehiivResponse;
    let apiEndpoint;
    
    // Method 1: Try form-specific subscription endpoint (triggers automation)
    try {
      apiEndpoint = `https://api.beehiiv.com/v2/publications/${PUBLICATION_ID}/forms/${FORM_ID}/subscriptions`;
      beehiivResponse = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${BEEHIIV_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          reactivate_existing: false,
          send_welcome_email: true,
          utm_source: 'weekend-mvp-landing',
          utm_medium: 'website',
          utm_campaign: 'starter-kit',
          custom_fields: [
            { name: 'first_name', value: first_name }
          ],
        }),
      });
    } catch (formError) {
      // Fallback: Use general subscriptions endpoint
      console.warn('Form endpoint failed, trying general endpoint:', formError);
      apiEndpoint = `https://api.beehiiv.com/v2/publications/${PUBLICATION_ID}/subscriptions`;
      beehiivResponse = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${BEEHIIV_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          reactivate_existing: false,
          send_welcome_email: true,
          utm_source: 'weekend-mvp-landing',
          utm_medium: 'website',
          utm_campaign: 'starter-kit',
          custom_fields: [
            { name: 'first_name', value: first_name }
          ],
        }),
      });
    }

    // Safely parse JSON response - handle empty responses
    let data = {};
    const contentType = beehiivResponse.headers.get('content-type');
    const responseText = await beehiivResponse.text();
    
    if (responseText && contentType && contentType.includes('application/json')) {
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse Beehiiv response:', parseError, 'Response:', responseText);
        data = { raw_response: responseText };
      }
    } else if (responseText) {
      // Non-JSON response
      data = { raw_response: responseText };
    }

    if (!beehiivResponse.ok) {
      console.error('Beehiiv API Error:', {
        status: beehiivResponse.status,
        statusText: beehiivResponse.statusText,
        endpoint: apiEndpoint,
        response: data,
        raw_response: responseText,
        email: email,
        first_name: first_name
      });
      
      return new Response(
        JSON.stringify({ 
          error: data.message || data.error || `Failed to subscribe (${beehiivResponse.status})`,
          details: data,
          api_response: data,
          endpoint_used: apiEndpoint,
          status_code: beehiivResponse.status,
          debug_info: {
            publication_id: PUBLICATION_ID,
            form_id: FORM_ID,
            has_api_key: !!BEEHIIV_API_KEY
          }
        }),
        { 
          status: beehiivResponse.status,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      );
    }

    // Log success for debugging
    console.log('Beehiiv subscription successful:', {
      email: email,
      endpoint: apiEndpoint,
      response: data
    });

    // Success response
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Successfully subscribed',
        data: data 
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );

  } catch (error) {
    console.error('Subscription error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

