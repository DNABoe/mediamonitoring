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
    const { text, fighters } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Analyze sentiment and extract fighter mentions using Lovable AI
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a sentiment analysis expert. Analyze text sentiment and identify fighter aircraft mentions.'
          },
          {
            role: 'user',
            content: `Analyze this text for sentiment and fighter aircraft mentions. Fighters to look for: ${fighters.join(', ')}\n\nText: ${text}\n\nRespond with JSON only: {"sentiment": number between -1 (negative) and 1 (positive), "fighter_tags": array of mentioned fighters}`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'analyze_text',
              description: 'Analyze sentiment and extract fighter mentions',
              parameters: {
                type: 'object',
                properties: {
                  sentiment: {
                    type: 'number',
                    description: 'Sentiment score from -1 (very negative) to 1 (very positive)'
                  },
                  fighter_tags: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'List of fighter aircraft mentioned in the text'
                  }
                },
                required: ['sentiment', 'fighter_tags'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'analyze_text' } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      // Return default values on error
      return new Response(
        JSON.stringify({ sentiment: 0, fighter_tags: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      const result = JSON.parse(toolCall.function.arguments);
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fallback if no tool call
    return new Response(
      JSON.stringify({ sentiment: 0, fighter_tags: [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-sentiment:', error);
    return new Response(
      JSON.stringify({ sentiment: 0, fighter_tags: [] }),
      { 
        status: 200, // Return 200 with defaults rather than error
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
