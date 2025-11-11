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
    const systemPrompt = `You are an expert defense industry analyst specializing in fighter aircraft procurement analysis. Provide detailed, nuanced insights based on the article content.`;

    const userPrompt = `Analyze this article about fighter aircraft procurement in detail:

Title: ${title}
Content: ${content}

Competitors to analyze: ${competitors.join(', ')} (Always include Gripen in the analysis)

Provide a comprehensive analysis in the following JSON structure:
{
  "main_sentiment": {
    "Gripen": <number between -1 and 1, or null if not mentioned>,
    "F-35": <number between -1 and 1, or null if not mentioned>,
    ... include all competitors from the list above
  },
  "sentiment_details": {
    "Gripen": "<detailed explanation of sentiment reasoning, or 'No mentions found in article' if not discussed>",
    "F-35": "<detailed explanation of sentiment reasoning, or 'No mentions found in article' if not discussed>",
    ... include all competitors
  },
  "key_points": [
    "<detailed point about procurement decisions, capabilities, or implications>",
    "<detailed point about technical aspects or comparisons>",
    "<detailed point about political or economic factors>",
    "<detailed point about strategic considerations>",
    ... provide 4-6 comprehensive points
  ],
  "article_tone": "<one of: factual, opinion, promotional, critical>",
  "influence_score": <number 1-10 based on source credibility and reach>,
  "extracted_quotes": [
    {"quote": "meaningful quote from article", "context": "who said it and why it matters"},
    ... include 2-4 most significant quotes
  ],
  "narrative_themes": ["cost-effectiveness", "technical-capability", "political-influence", "industrial-cooperation", "operational-requirements", etc.]
}

IMPORTANT: 
- For sentiment, be precise: positive mentions = 0.3 to 1.0, neutral = -0.3 to 0.3, negative = -1.0 to -0.3
- If a competitor is not mentioned at all, set sentiment to null
- Provide detailed sentiment explanations that cite specific claims from the article
- Extract only the most impactful quotes that reveal bias, key claims, or authoritative statements`;

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
    console.log('AI response received:', JSON.stringify(aiData).substring(0, 200));
    
    let analysisText = aiData.choices[0].message.content;
    console.log('Raw analysis text (first 300 chars):', analysisText.substring(0, 300));
    
    // Strip markdown code blocks if present (```json ... ```)
    if (analysisText.includes('```')) {
      console.log('Stripping markdown code blocks...');
      analysisText = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      console.log('After stripping (first 300 chars):', analysisText.substring(0, 300));
    }
    
    const analysis = JSON.parse(analysisText);
    console.log('Successfully parsed analysis');

    // Store analysis in database with sentiment details
    const { data: savedAnalysis, error: saveError } = await supabase
      .from('article_analyses')
      .upsert({
        article_id: articleId,
        user_id: user.id,
        main_sentiment: analysis.main_sentiment || {},
        sentiment_details: analysis.sentiment_details || {},
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
    console.error('Error in analyze-article function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error details:', errorMessage);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to analyze article',
        details: errorMessage
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});