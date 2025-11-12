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

    // Translate each article individually
    let totalTranslated = 0;

    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      
      console.log(`Translating article ${i + 1}/${articles.length}: ${article.title_en.substring(0, 50)}...`);

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
                content: 'You are a professional translator. If the article title is already in English, return it unchanged. Otherwise, translate it to English while preserving fighter aircraft names (F-35, Gripen, Rafale, Eurofighter, F-16, etc.) and technical terms. Return ONLY the English title, nothing else - no quotes, no explanations.'
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
          const englishTitle = translateData.choices[0].message.content.trim()
            .replace(/^["']|["']$/g, ''); // Remove quotes if present
          
          // Update the article with both original and translation
          const { error: updateError } = await supabaseClient
            .from('items')
            .update({
              title_pt: article.title_en,  // Store original
              title_en: englishTitle        // Store English translation
            })
            .eq('id', article.id);

          if (!updateError) {
            totalTranslated++;
            console.log(`✓ Translated: "${article.title_en.substring(0, 40)}..." -> "${englishTitle.substring(0, 40)}..."`);
          } else {
            console.error(`Failed to update article ${article.id}:`, updateError);
          }
        } else {
          console.warn(`Translation API failed for article ${article.id}: ${translateResponse.status}`);
        }
      } catch (error) {
        console.error(`Error translating article ${article.id}:`, error);
      }

      // Small delay to avoid rate limiting
      if (i < articles.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
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
