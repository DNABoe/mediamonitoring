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

    // Fetch enabled media sources for this country
    const { data: sources, error: sourcesError } = await supabaseClient
      .from('sources')
      .select('*')
      .eq('country', country)
      .eq('enabled', true);

    if (sourcesError) throw sourcesError;
    console.log(`Found ${sources?.length || 0} enabled sources for ${country}`);
    
    // If no country-specific sources, use general domain search
    const hasCountrySources = sources && sources.length > 0;
    if (!hasCountrySources) {
      console.log(`No sources configured for ${country}, will use general domain search`);
    }

    // Universal search terms - fighter names are international
    const universalSearchTerms = [
      'fighter jet',
      'fighter aircraft', 
      'military aircraft',
      'defense procurement',
      'air force modernization'
    ];

    console.log('Using universal search terms:', universalSearchTerms);

    // Determine domain suffix from country code
    const domainSuffix = `.${country.toLowerCase()}`;

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
    
    // If we have configured sources, search them specifically
    if (hasCountrySources) {
      for (const source of sources || []) {
        const domain = source.url.replace(/^https?:\/\//i, '').split('/')[0];
        
        // Search by universal terms
        for (const term of universalSearchTerms) {
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
        
        // Always search for Gripen
        const dateFilter = `after:${startDate} before:${endDate}`;
        allSearchUrls.push(
          `https://html.duckduckgo.com/html/?q=site:${domain}+Gripen+${dateFilter}`
        );
      }
    }

    // Always add general searches for the country domain (works even without configured sources)
    const dateFilter = `after:${startDate} before:${endDate}`;
    
    // Search for each fighter name + country domain
    for (const competitor of [...competitors, 'Gripen']) {
      const encodedCompetitor = encodeURIComponent(competitor);
      allSearchUrls.push(
        `https://html.duckduckgo.com/html/?q=${encodedCompetitor}+site:${domainSuffix}+${dateFilter}`
      );
    }
    
    // Search for general terms + country domain
    for (const term of universalSearchTerms.slice(0, 3)) { // Limit to avoid too many searches
      const encodedTerm = encodeURIComponent(term);
      allSearchUrls.push(
        `https://html.duckduckgo.com/html/?q=${encodedTerm}+site:${domainSuffix}+${dateFilter}`
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

    // Pre-filter articles by fighter keywords BEFORE AI analysis
    const fighterKeywords = ['Gripen', 'F-35', 'F35', 'Rafale', 'F-16V', 'F16V', 'Eurofighter', 'Typhoon', 'F/A-50'];
    const preFilteredResults = uniqueResults.filter(r => {
      const combined = `${r.title} ${r.snippet}`.toLowerCase();
      return fighterKeywords.some(kw => combined.includes(kw.toLowerCase()));
    });
    
    console.log(`Pre-filtered to ${preFilteredResults.length} articles mentioning fighters`);
    
    if (preFilteredResults.length === 0) {
      console.log('No articles mention fighters, skipping AI analysis');
      return new Response(JSON.stringify({ 
        success: true,
        articlesFound: uniqueResults.length,
        articlesStored: 0,
        message: 'No fighter mentions found'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Use AI with tool calling for structured output
    console.log('Sending to AI for structured analysis...');
    
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{
          role: 'user',
          content: `Extract fighter jet information from these ${preFilteredResults.length} articles.

For each article, identify:
1. Which fighters are mentioned (Gripen, F-35, Rafale, F-16V, Eurofighter, F/A-50)
2. Sentiment: positive (0.7), neutral (0.0), or negative (-0.7)
3. Source country: "${country}" for local domains ending in ${domainSuffix}, otherwise "INTERNATIONAL"

Articles:
${JSON.stringify(preFilteredResults.slice(0, 100).map(r => ({ title: r.title, url: r.url })), null, 2)}`
        }],
        tools: [{
          type: 'function',
          function: {
            name: 'extract_articles',
            description: 'Extract structured article data',
            parameters: {
              type: 'object',
              properties: {
                articles: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      url: { type: 'string' },
                      fighter_tags: { 
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Exact names: Gripen, F-35, Rafale, F-16V, Eurofighter, F/A-50'
                      },
                      sentiment: { type: 'number', description: 'Between -1 and 1' },
                      source_country: { type: 'string' }
                    },
                    required: ['title', 'url', 'fighter_tags', 'sentiment', 'source_country']
                  }
                }
              },
              required: ['articles']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'extract_articles' } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log('AI response received');
    
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.error('AI did not use tool:', JSON.stringify(aiData.choices?.[0]?.message));
      throw new Error('AI did not return structured data');
    }
    
    const extractedData = JSON.parse(toolCall.function.arguments);
    const structuredArticles = extractedData.articles || [];
    
    console.log(`AI extracted ${structuredArticles.length} articles with fighter mentions`);

    // Validate articles and apply fallback fighter detection
    const validArticles = structuredArticles.filter((article: any) => {
      if (!article.url || !article.url.startsWith('http')) {
        console.warn('Invalid URL, skipping:', article.title);
        return false;
      }
      
      // Ensure fighter_tags is array
      if (!article.fighter_tags || !Array.isArray(article.fighter_tags)) {
        article.fighter_tags = [];
      }
      
      // Fallback fighter detection if AI missed them
      if (article.fighter_tags.length === 0) {
        const combined = `${article.title}`.toLowerCase();
        const detected = [];
        if (combined.includes('gripen')) detected.push('Gripen');
        if (combined.includes('f-35') || combined.includes('f35')) detected.push('F-35');
        if (combined.includes('rafale')) detected.push('Rafale');
        if (combined.includes('f-16') || combined.includes('f16')) detected.push('F-16V');
        if (combined.includes('eurofighter') || combined.includes('typhoon')) detected.push('Eurofighter');
        if (combined.includes('f/a-50') || combined.includes('fa-50')) detected.push('F/A-50');
        
        if (detected.length > 0) {
          console.log(`Fallback detection for "${article.title}": ${detected.join(', ')}`);
          article.fighter_tags = detected;
        } else {
          console.warn('No fighters detected, skipping:', article.title);
          return false;
        }
      }
      
      return true;
    });

    console.log(`${validArticles.length} valid articles after validation and fallback`);

    // Store articles in database with robust error handling
    let storedCount = 0;
    const errors = [];
    
    for (const article of validArticles) {
      try {
        // Match to source
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

        // Derive country from domain if no source match
        if (!sourceId && domainSuffix && article.url.includes(domainSuffix)) {
          sourceCountry = country;
        }

        // Store with all available data, using defaults for missing fields
        const { error: insertError } = await supabaseClient
          .from('items')
          .upsert({
            url: article.url,
            title_en: article.title || 'Untitled',
            source_id: sourceId,
            source_country: sourceCountry,
            published_at: article.published_at || new Date().toISOString(),
            fighter_tags: article.fighter_tags,
            sentiment: typeof article.sentiment === 'number' ? article.sentiment : 0,
            fetched_at: new Date().toISOString()
          }, {
            onConflict: 'url'
          });

        if (insertError) {
          errors.push({ url: article.url, error: insertError.message });
          console.error('Insert error for', article.url, ':', insertError.message);
        } else {
          storedCount++;
        }
      } catch (e) {
        errors.push({ url: article.url, error: e instanceof Error ? e.message : 'Unknown' });
        console.error('Exception storing article:', article.url, e);
      }
    }

    console.log(`Successfully stored ${storedCount}/${validArticles.length} articles`);
    if (errors.length > 0) {
      console.log(`Errors: ${errors.length}`, errors.slice(0, 5));
    }

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
