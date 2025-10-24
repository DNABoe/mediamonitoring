import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { articleId, competitors } = await req.json();

    // Validate articleId is a valid UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!articleId || typeof articleId !== 'string' || !uuidRegex.test(articleId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate competitors array
    if (!Array.isArray(competitors) || competitors.length === 0 || competitors.length > 10) {
      return new Response(
        JSON.stringify({ error: 'Invalid request parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    for (const competitor of competitors) {
      if (typeof competitor !== 'string' || competitor.length > 50 || competitor.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Invalid request parameters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Fetch article details
    const { data: article, error: articleError } = await supabase
      .from('items')
      .select('*')
      .eq('id', articleId)
      .single();

    if (articleError || !article) {
      throw new Error('Article not found');
    }

    // Prepare content for analysis
    const content = article.fulltext_en || article.summary_en || article.title_en || '';
    const title = article.title_en || article.title_pt || '';

    // Create AI analysis prompt
    const systemPrompt = `You are an expert defense industry analyst. Analyze the given article about fighter aircraft procurement and provide structured insights.`;

    const userPrompt = `Analyze this article about fighter aircraft procurement:

Title: ${title}
Content: ${content}

Competitors being compared: ${competitors.join(', ')}

Provide analysis in the following JSON structure:
{
  "main_sentiment": {
    "Gripen": <number between -1 and 1>,
    "F-35": <number between -1 and 1>,
    ... for each competitor
  },
  "key_points": [
    "First key point about the procurement or aircraft",
    "Second key point",
    "Third key point"
  ],
  "article_tone": "<one of: factual, opinion, promotional, critical>",
  "influence_score": <number 1-10 based on source credibility>,
  "extracted_quotes": [
    {"quote": "meaningful quote from article", "context": "who said it or context"}
  ],
  "narrative_themes": ["cost", "capability", "politics", "industrial cooperation", etc.]
}`;

    // Call Lovable AI
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
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!aiResponse.ok) {
      throw new Error('Analysis service unavailable');
    }

    const aiData = await aiResponse.json();
    const analysisText = aiData.choices[0].message.content;
    const analysis = JSON.parse(analysisText);

    // Store analysis in database
    const { data: savedAnalysis, error: saveError } = await supabase
      .from('article_analyses')
      .upsert({
        article_id: articleId,
        user_id: user.id,
        main_sentiment: analysis.main_sentiment || {},
        key_points: analysis.key_points || [],
        article_tone: analysis.article_tone || 'factual',
        influence_score: analysis.influence_score || 5,
        extracted_quotes: analysis.extracted_quotes || [],
        narrative_themes: analysis.narrative_themes || [],
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving analysis:', saveError);
      throw saveError;
    }

    return new Response(
      JSON.stringify({ success: true, analysis: savedAnalysis }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to analyze article' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});