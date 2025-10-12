import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { country, competitors, startDate, endDate } = await req.json();
    console.log('Collecting articles for tracking:', { country, competitors, trackingPeriod: `${startDate} to ${endDate}` });

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Fetch enabled media sources
    const { data: sources, error: sourcesError } = await supabaseClient
      .from('sources')
      .select('*')
      .eq('country', country)
      .eq('enabled', true);

    if (sourcesError) throw sourcesError;
    console.log(`Found ${sources?.length || 0} enabled sources for ${country}`);

    // Multi-language search terms
    const searchTermsByCountry: Record<string, { native: string[], english: string[] }> = {
      PT: { 
        native: ['caça', 'caças', 'avião de combate', 'aviões de combate', 'aquisição', 'compra', 'substituição'],
        english: ['fighter', 'jet', 'aircraft', 'procurement']
      },
      DEFAULT: { 
        native: [],
        english: ['fighter', 'jet', 'aircraft', 'procurement']
      }
    };

    const searchTerms = searchTermsByCountry[country] || searchTermsByCountry.DEFAULT;
    const hasNativeTerms = searchTerms.native.length > 0;
    console.log('Using search terms:', { native: searchTerms.native, english: searchTerms.english });

    // Country-specific domain suffix
    const domainSuffix = country === 'PT' ? '.pt' : '';

    // Helper: batch fetch with rate limiting
    async function batchFetch(urls: string[], batchSize = 10, delayMs = 500) {
      const results = [];
      for (let i = 0; i < urls.length; i += batchSize) {
        const batch = urls.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (url) => {
            try {
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 15000);
              const response = await fetch(url, { 
                signal: controller.signal,
                headers: { 'User-Agent': 'Mozilla/5.0' }
              });
              clearTimeout(timeout);
              if (!response.ok) return null;
              return await response.text();
            } catch {
              return null;
            }
          })
        );
        results.push(...batchResults);
        if (i + batchSize < urls.length) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
      return results;
    }

    // Generate comprehensive search URLs for ENTIRE tracking period
    const allSearchUrls: string[] = [];
    
    // Search each media outlet for the tracking period
    for (const source of sources || []) {
      const domain = source.url.replace(/^https?:\/\//i, '').split('/')[0];
      
      for (const term of [...searchTerms.native, ...searchTerms.english]) {
        const encodedTerm = encodeURIComponent(term);
        const dateFilter = `after:${startDate} before:${endDate}`;
        allSearchUrls.push(
          `https://html.duckduckgo.com/html/?q=site:${domain}+${encodedTerm}+${dateFilter}`
        );
      }
      
      // Add competitor-specific searches
      for (const competitor of competitors) {
        const encodedCompetitor = encodeURIComponent(competitor);
        const dateFilter = `after:${startDate} before:${endDate}`;
        allSearchUrls.push(
          `https://html.duckduckgo.com/html/?q=site:${domain}+${encodedCompetitor}+${dateFilter}`
        );
      }
    }

    // Add general searches covering the tracking period
    for (const term of searchTerms.native) {
      const encodedTerm = encodeURIComponent(term);
      const dateFilter = `after:${startDate} before:${endDate}`;
      allSearchUrls.push(
        `https://html.duckduckgo.com/html/?q=${encodedTerm}+${domainSuffix}+${dateFilter}`
      );
    }

    console.log(`Executing ${allSearchUrls.length} searches for tracking period...`);

    // Execute all searches
    const searchResults = await batchFetch(allSearchUrls);

    // Extract results from HTML
    function extractResults(html: string): Array<{title: string, url: string, snippet: string}> {
      const results: Array<{title: string, url: string, snippet: string}> = [];
      const resultRegex = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
      const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([^<]+)<\/a>/g;
      
      let match;
      const urls: string[] = [];
      const titles: string[] = [];
      
      while ((match = resultRegex.exec(html)) !== null) {
        urls.push(match[1]);
        titles.push(match[2].trim());
      }
      
      const snippets: string[] = [];
      while ((match = snippetRegex.exec(html)) !== null) {
        snippets.push(match[1].trim());
      }
      
      for (let i = 0; i < urls.length; i++) {
        results.push({
          url: urls[i],
          title: titles[i] || '',
          snippet: snippets[i] || ''
        });
      }
      
      return results;
    }

    // Combine and deduplicate
    const allResults = searchResults
      .filter(html => html !== null)
      .flatMap(html => extractResults(html!));
    
    const uniqueResults = Array.from(
      new Map(allResults.map(r => [r.url, r])).values()
    );

    console.log(`Found ${uniqueResults.length} unique articles for tracking period`);

    if (uniqueResults.length === 0) {
      return new Response(JSON.stringify({ 
        articles: [],
        message: 'No articles found for tracking period'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // AI analysis with improved fighter detection
    const analysisPrompt = `You are analyzing news articles about fighter aircraft procurement for ${country}.

TRACKING PERIOD: ${startDate} to ${endDate}

FIGHTERS TO DETECT:
- Gripen / JAS 39 / Gripen E / Gripen NG
- F-35 / F-35A / Lightning II / Joint Strike Fighter
- Rafale / Dassault Rafale
- F-16 / F-16V / Viper / Fighting Falcon
- Eurofighter / Typhoon / EF-2000
- F/A-50 / FA-50 / Golden Eagle
- F-15 / F-15EX / Eagle / Strike Eagle
- Super Hornet / F/A-18 / F-18

CRITICAL INSTRUCTIONS:
1. For EACH article, carefully read the title and snippet
2. Identify ALL fighters mentioned - be thorough!
3. If a fighter is mentioned, add it to fighter_tags array (use standardized names: "Gripen", "F-35", "Rafale", "F-16V", "Eurofighter", "F/A-50", "F-15", "Super Hornet")
4. Parse the publication date from the URL or title if possible
5. Determine if the source is from ${country} (local) or international
6. Estimate sentiment: positive (0.5 to 1.0), neutral (0 to 0.5), negative (-1.0 to 0)

SEARCH RESULTS:
${JSON.stringify(uniqueResults.slice(0, 100), null, 2)}

Return a JSON array of articles with this EXACT structure:
[
  {
    "title": "Article title",
    "url": "https://...",
    "source": "Source name",
    "published_at": "2024-10-12" or null,
    "fighter_tags": ["Gripen", "F-35"],
    "source_country": "${country}" or "INTERNATIONAL",
    "sentiment": 0.5
  }
]

IMPORTANT:
- Only include articles that mention fighter aircraft or military procurement
- fighter_tags MUST NOT be empty if the article is about fighters
- Use "INTERNATIONAL" for source_country if not from ${country}
- Return ONLY valid JSON, no extra text`;

    console.log('Sending to AI for analysis...');
    
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a precise data extraction assistant. Return only valid JSON.' },
          { role: 'user', content: analysisPrompt }
        ],
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices[0].message.content;
    
    console.log('AI analysis response received');

    let structuredArticles = [];
    try {
      const jsonMatch = aiContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        structuredArticles = JSON.parse(jsonMatch[0]);
      } else {
        structuredArticles = JSON.parse(aiContent);
      }
    } catch (e) {
      console.error('Error parsing AI response:', e);
      structuredArticles = [];
    }

    console.log(`Structured ${structuredArticles.length} articles`);

    // Validate and enhance articles
    const validArticles = structuredArticles.filter((article: any) => {
      // Must have fighter tags
      if (!article.fighter_tags || article.fighter_tags.length === 0) {
        console.warn('Article missing fighter_tags:', article.title);
        
        // Fallback: keyword matching
        const title = article.title.toLowerCase();
        const tags = [];
        if (title.includes('gripen')) tags.push('Gripen');
        if (title.includes('f-35') || title.includes('f35')) tags.push('F-35');
        if (title.includes('rafale')) tags.push('Rafale');
        if (title.includes('f-16') || title.includes('f16')) tags.push('F-16V');
        if (title.includes('eurofighter') || title.includes('typhoon')) tags.push('Eurofighter');
        
        if (tags.length > 0) {
          article.fighter_tags = tags;
        } else {
          return false; // Skip articles with no fighter mentions
        }
      }
      
      // Must have valid URL
      if (!article.url || !article.url.startsWith('http')) {
        return false;
      }
      
      return true;
    });

    console.log(`${validArticles.length} valid articles after filtering`);

    // Match articles to sources and store in database
    let storedCount = 0;
    for (const article of validArticles) {
      try {
        // Try to match to a source
        let sourceId = null;
        let sourceCountry = article.source_country || 'INTERNATIONAL';
        
        if (sources) {
          for (const source of sources) {
            const sourceDomain = source.url.replace(/^https?:\/\//i, '').split('/')[0];
            if (article.url.includes(sourceDomain)) {
              sourceId = source.id;
              sourceCountry = source.country;
              break;
            }
          }
        }

        // If no source match, derive country from domain
        if (!sourceId && article.url.includes(domainSuffix)) {
          sourceCountry = country;
        }

        const { error: insertError } = await supabaseClient
          .from('items')
          .upsert({
            url: article.url,
            title_en: article.title,
            source_id: sourceId,
            source_country: sourceCountry,
            published_at: article.published_at || new Date().toISOString(),
            fighter_tags: article.fighter_tags,
            sentiment: article.sentiment || 0,
            fetched_at: new Date().toISOString()
          }, {
            onConflict: 'url'
          });

        if (!insertError) {
          storedCount++;
        }
      } catch (e) {
        console.error('Error storing article:', e);
      }
    }

    console.log(`Stored ${storedCount} articles in database`);

    return new Response(JSON.stringify({ 
      success: true,
      articlesFound: uniqueResults.length,
      articlesStored: storedCount,
      trackingPeriod: `${startDate} to ${endDate}`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in collect-articles-for-tracking:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
