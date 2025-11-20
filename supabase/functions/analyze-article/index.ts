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
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Authentication required', details: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('Attempting to authenticate user...');
    
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError) {
      console.error('Authentication error:', userError);
      return new Response(
        JSON.stringify({ 
          error: 'Authentication failed', 
          details: userError.message || 'Invalid or expired token. Please log out and log in again.' 
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!user) {
      console.error('No user found in token');
      return new Response(
        JSON.stringify({ error: 'Authentication failed', details: 'User not found. Please log out and log in again.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sanitizedUserId = user.id.substring(0, 8) + '...';
    console.log(`Authenticated user: ${sanitizedUserId}`);

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

    // Fetch article details with ownership verification
    const { data: article, error: articleError } = await supabase
      .from('items')
      .select('*')
      .eq('id', articleId)
      .eq('user_id', user.id)
      .single();

    if (articleError || !article) {
      console.error('Article not found or access denied');
      return new Response(
        JSON.stringify({ error: 'Article not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare content for analysis
    const content = article.fulltext_en || article.summary_en || article.title_en || '';
    const title = article.title_en || article.title_pt || '';

    const systemPrompt = `You are a senior defense intelligence analyst specializing in fighter aircraft procurement. Provide deep, evidence-based analysis of media coverage and competitive positioning.`;

    const userPrompt = `Analyze this fighter procurement article for competitive intelligence:

Title: ${title}
Content: ${content}
Fighters: ${competitors.join(', ')}, Gripen

Return detailed JSON analysis:
{
  "main_sentiment": {"Gripen": <-1.0 to +1.0 or null>, "F-35": <-1.0 to +1.0 or null>, ...},
  "sentiment_details": {
    "Gripen": "<200-300 word analysis: (1) explicit statements, (2) implicit framing, (3) competitive positioning, (4) evidence supporting score. Or 'No mentions found.'>",
    "F-35": "<same detailed analysis>", ...
  },
  "key_points": [
    "<150+ word point on procurement decisions with timeline/budget/quantities>",
    "<150+ word point on technical capabilities and performance metrics>",
    "<150+ word point on political/geopolitical factors>",
    "<150+ word point on economic/industrial factors>",
    "<150+ word point on strategic implications>",
    "<150+ word point on media narrative framing>"
  ],
  "article_tone": "<objective-factual / analysis-opinion / promotional-advocacy / critical-investigative / speculative>",
  "influence_score": <1-10 based on source credibility>,
  "extracted_quotes": [{"quote": "...", "context": "speaker, significance, competitive implication"}],
  "narrative_themes": ["cost-effectiveness", "technical-superiority", "political-alignment", ...]
}

Sentiment guide: +0.8 to +1.0 (strongly favorable), +0.4 to +0.7 (positive), +0.1 to +0.3 (slightly positive), -0.1 to +0.1 (neutral), -0.3 to -0.1 (slightly negative), -0.7 to -0.4 (negative), -1.0 to -0.8 (strongly negative), null (not mentioned).

Base analysis on explicit evidence, cite specific phrases, identify bias in word choice and source selection.`;

    // Call Lovable AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro', // Use Pro for deep analysis
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3, // Slightly higher for nuanced analysis
        max_tokens: 8000 // Allow comprehensive responses
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