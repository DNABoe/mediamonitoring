import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Social media discussion analysis started');
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const body = await req.json();
    const { country, competitors, posts } = body;

    console.log(`Analyzing ${posts?.length || 0} social media posts for ${country}`);

    // Prepare posts content for analysis
    const postsText = posts.map((p: any) => 
      `[${p.platform}] ${p.content} (Sentiment: ${p.sentiment?.toFixed(2) || 0})`
    ).join('\n\n');

    const systemPrompt = `You are an expert defense industry analyst specializing in social media sentiment and public discourse analysis. Analyze social media discussions about fighter jet procurement in ${country}.`;

    const analysisPrompt = `Analyze these social media posts about fighter procurement discussion in ${country}:

Competitors being tracked: ${competitors.join(', ')}

Posts:
${postsText}

Provide a comprehensive analysis with these sections:

1. **Public Sentiment Overview**: Overall sentiment and tone of the discussion across platforms
2. **Key Themes**: Main discussion topics and concerns (cost, capabilities, politics, jobs, etc.)
3. **Platform Differences**: How discussion differs across Twitter, Reddit, LinkedIn
4. **Fighter Comparison**: How each fighter (${competitors.join(', ')}) is being discussed
5. **Influential Voices**: Types of accounts driving the conversation (experts, media, citizens)
6. **Concerns & Support**: Main arguments for/against different fighters
7. **Misinformation/Propaganda**: Any concerning narratives or coordinated messaging
8. **Trending Topics**: Emerging themes or recent developments being discussed
9. **Geographic Focus**: Regional perspectives within ${country} if apparent
10. **Recommendations**: What decision-makers should pay attention to from this social discourse

Keep analysis factual, evidence-based, and focused on the procurement decision context.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: analysisPrompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const analysis = aiData.choices[0].message.content;

    console.log('Social media analysis complete');

    return new Response(
      JSON.stringify({ 
        success: true,
        analysis,
        postsAnalyzed: posts?.length || 0,
        country,
        competitors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-social-discussion:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
