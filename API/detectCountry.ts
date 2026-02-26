import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  try {
    // Get client IP from request headers or CF-Connecting-IP (Cloudflare)
    let clientIp = req.headers.get('cf-connecting-ip') || 
                   req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
                   req.headers.get('x-client-ip') ||
                   'unknown';

    // Validate IP format (basic check)
    if (clientIp === 'unknown' || clientIp === '::1' || clientIp === '127.0.0.1') {
      console.warn(`Invalid or local IP detected: ${clientIp}, using fallback`);
      // Try alternative header for edge cases
      clientIp = req.headers.get('x-real-ip') || clientIp;
    }

    if (clientIp === 'unknown' || clientIp === '::1' || clientIp === '127.0.0.1') {
      console.warn('Could not determine client IP, using default country');
      return new Response(
        JSON.stringify({
          country_code: 'AU',
          country: 'Australia',
          city: '',
          detected: false
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
    
    // Call ipapi.co to get country from IP
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    let response;
    try {
      response = await fetch(`https://ipapi.co/${clientIp}/json/`, {
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }
    
    if (!response.ok) {
      throw new Error(`ipapi.co returned ${response.status}`);
    }

    const data = await response.json();
    
    // Validate that we got meaningful data
    if (!data.country_code || !data.country_name) {
      throw new Error('Missing country data in response');
    }

    return new Response(
      JSON.stringify({
        country_code: data.country_code,
        country: data.country_name,
        city: data.city || '',
        detected: true
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  } catch (error) {
    console.error('Country detection error:', error);
    
    // Return default country if detection fails
    return new Response(
      JSON.stringify({
        country_code: 'AU',
        country: 'Australia',
        city: '',
        detected: false,
        error: error instanceof Error ? error.message : 'Detection failed'
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
});
