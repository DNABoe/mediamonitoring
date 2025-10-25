import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAdminRole } from "../_shared/adminAuth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Admin-only access - verify admin role
    const authHeader = req.headers.get('Authorization');
    
    try {
      await verifyAdminRole(authHeader);
    } catch (error) {
      console.error('Admin verification failed:', error instanceof Error ? error.message : 'Unknown error');
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('GOOGLE_SEARCH_API_KEY');
    const engineId = Deno.env.get('GOOGLE_SEARCH_ENGINE_ID');

    console.log('Admin testing Google API credentials');

    if (!apiKey || !engineId) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing credentials',
          configured: false
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Test API call with simple query
    const testUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${engineId}&q=test&num=1`;
    
    console.log('Testing Google API connection');
    const response = await fetch(testUrl);
    const data = await response.json();

    if (!response.ok) {
      console.error('Google API test failed with status:', response.status);
      return new Response(
        JSON.stringify({ 
          error: 'Google API validation failed',
          configured: true,
          valid: false
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Google API credentials are valid',
        configured: true,
        valid: true
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Test error:', error instanceof Error ? error.message : 'Unknown error');
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
