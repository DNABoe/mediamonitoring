import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting translation of existing articles...');
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;

    const supabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    
    // Authenticate user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get all articles where title_pt is null but title_en exists
    const { data: articles, error: fetchError } = await supabaseClient
      .from('items')
      .select('id, title_en, url')
      .eq('user_id', user.id)
      .is('title_pt', null)
      .not('title_en', 'is', null);

    if (fetchError) throw fetchError;

    if (!articles || articles.length === 0) {
      return new Response(JSON.stringify({ 
        success: true,
        message: 'No articles need translation',
        translated: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Found ${articles.length} articles to process`);

    // Process in batches of 20 to avoid token limits
    const batchSize = 20;
    let totalTranslated = 0;

    for (let i = 0; i < articles.length; i += batchSize) {
      const batch = articles.slice(i, i + batchSize);
      const titlesToTranslate = batch.map(a => a.title_en).join('\n---\n');
      
      console.log(`Translating batch ${Math.floor(i/batchSize) + 1} (${batch.length} articles)...`);

      try {
        const translationResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
                content: 'You are analyzing article titles. For each title, determine: 1) Is it already in English? 2) What is the original language? Return a JSON array with objects containing: {"isEnglish": boolean, "originalLanguage": "en"|"pt"|"es"|"fr"|etc}. Return ONLY the JSON array, one object per line.'
              },
              {
                role: 'user',
                content: `Analyze these article titles:\n\n${titlesToTranslate}`
              }
            ]
          })
        });

        if (!translationResponse.ok) {
          console.warn(`Translation API failed for batch ${Math.floor(i/batchSize) + 1}`);
          continue;
        }

        const analysisData = await translationResponse.json();
        const analysisText = analysisData.choices[0].message.content;
        
        console.log('Analysis response:', analysisText);

        // Update articles - translate each one individually for better accuracy
        for (let j = 0; j < batch.length; j++) {
          const article = batch[j];

          try {
            // Translate to English
            const translateResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
                    content: 'You are a professional translator. If the article title is already in English, return it as-is. Otherwise, translate it to English while preserving fighter aircraft names (F-35, Gripen, Rafale, Eurofighter, etc.) and technical terms. Return ONLY the title, nothing else.'
                  },
                  {
                    role: 'user',
                    content: article.title_en
                  }
                ]
              })
            });

            if (translateResponse.ok) {
              const translateData = await translateResponse.json();
              const translatedTitle = translateData.choices[0].message.content.trim();
              
              // Update the article with both original and translation
              const { error: updateError } = await supabaseClient
                .from('items')
                .update({
                  title_pt: article.title_en, // Original title
                  title_en: translatedTitle    // English translation
                })
                .eq('id', article.id);

              if (!updateError) {
                totalTranslated++;
                console.log(`✓ Translated article ${j + 1}: ${translatedTitle}`);
              }
            }
          } catch (error) {
            console.error(`Error translating article ${article.id}:`, error);
          }
        }

      } catch (error) {
        console.error(`Error processing batch ${Math.floor(i/batchSize) + 1}:`, error);
      }
    }

    console.log(`Completed: ${totalTranslated} articles translated`);

    return new Response(JSON.stringify({ 
      success: true,
      articlesFound: articles.length,
      translated: totalTranslated
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
