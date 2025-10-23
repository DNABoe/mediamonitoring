import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('GOOGLE_SEARCH_API_KEY');
    const engineId = Deno.env.get('GOOGLE_SEARCH_ENGINE_ID');

    console.log('Testing Google API credentials...');
    console.log('API Key exists:', !!apiKey);
    console.log('Engine ID exists:', !!engineId);
    console.log('API Key length:', apiKey?.length || 0);
    console.log('Engine ID:', engineId);

    if (!apiKey || !engineId) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing credentials',
          hasApiKey: !!apiKey,
          hasEngineId: !!engineId
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Test API call with simple query
    const testUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${engineId}&q=test&num=1`;
    
    console.log('Making test request to Google API...');
    const response = await fetch(testUrl);
    const data = await response.json();

    console.log('Google API Response Status:', response.status);
    console.log('Google API Response:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      return new Response(
        JSON.stringify({ 
          error: 'Google API Error',
          status: response.status,
          details: data,
          apiKeyLength: apiKey.length,
          engineId: engineId
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Google API credentials are valid',
        searchResultsCount: data.searchInformation?.totalResults || 0,
        quotaUsed: data.queries?.request?.[0]?.count || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Test error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
