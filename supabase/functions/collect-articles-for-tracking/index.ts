import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Decode DuckDuckGo redirect URLs to get real article URLs
function decodeDuckDuckGoUrl(url: string): string {
  try {
    // Fix protocol-relative URLs
    if (url.startsWith('//')) {
      url = 'https:' + url;
    }
    
    // Check if it's a DuckDuckGo redirect URL
    if (url.includes('duckduckgo.com/l/?') || url.includes('uddg=')) {
      const urlObj = new URL(url);
      const uddg = urlObj.searchParams.get('uddg');
      if (uddg) {
        const decoded = decodeURIComponent(uddg);
        console.log('Decoded DDG URL:', url.substring(0, 80), '->', decoded.substring(0, 80));
        return decoded;
      }
    }
    return url;
  } catch (e) {
    console.error('Error decoding URL:', url, e);
    return url;
  }
}

// Normalize URLs by removing tracking parameters and cleaning up
function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Remove common tracking parameters
    const paramsToRemove = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'];
    paramsToRemove.forEach(param => urlObj.searchParams.delete(param));
    return urlObj.toString();
  } catch {
    return url;
  }
}

serve(async (req) => {
  console.log('========== FUNCTION STARTED ==========');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Step 1: Parsing request body...');
    let body;
    try {
      body = await req.json();
      console.log('Step 1 SUCCESS: Request body parsed:', JSON.stringify(body));
    } catch (parseError) {
      console.error('Step 1 FAILED: Request parsing error:', parseError);
      return new Response(JSON.stringify({ 
        error: 'Invalid request format - failed to parse JSON',
        details: parseError instanceof Error ? parseError.message : 'Unknown parse error'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { country, competitors, startDate, endDate } = body;
    console.log('Step 2: Parameters extracted:', { country, competitors, startDate, endDate });
    
    if (!country || !competitors || !startDate || !endDate) {
      const missing = [];
      if (!country) missing.push('country');
      if (!competitors) missing.push('competitors');
      if (!startDate) missing.push('startDate');
      if (!endDate) missing.push('endDate');
      console.error('Step 2 FAILED: Missing required parameters:', missing);
      return new Response(JSON.stringify({ 
        error: 'Missing required parameters',
        missing,
        received: { country, competitors, startDate, endDate }
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    console.log('Step 2 SUCCESS: All parameters validated');

    console.log('Step 3: Creating Supabase client...');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    console.log('Step 3 SUCCESS: Supabase client created');

    console.log('Step 4: Checking API key...');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('Step 4 FAILED: LOVABLE_API_KEY not configured');
      throw new Error('LOVABLE_API_KEY not configured');
    }
    console.log('Step 4 SUCCESS: API key present');

    console.log('Step 5: Fetching enabled media sources...');
    const { data: sources, error: sourcesError } = await supabaseClient
      .from('sources')
      .select('*')
      .eq('country', country)
      .eq('enabled', true);

    if (sourcesError) {
      console.error('Step 5 FAILED: Error fetching sources:', sourcesError);
      throw sourcesError;
    }
    console.log(`Step 5 SUCCESS: Found ${sources?.length || 0} enabled sources for ${country}`);
    
    // If no country-specific sources, use general domain search
    const hasCountrySources = sources && sources.length > 0;
    if (!hasCountrySources) {
      console.log(`No sources configured for ${country}, will use general domain search`);
    }

    // Multi-language search terms based on country
    const searchTermsByCountry: Record<string, { native: string[], countryName: string }> = {
      PT: { 
        native: ['caça', 'caças', 'avião de combate', 'aviões de combate', 'aquisição militar', 'Força Aérea'],
        countryName: 'Portugal'
      },
      CZ: {
        native: ['stíhačka', 'stíhací letoun', 'bojový letoun', 'vojenské letadlo', 'armáda', 'letectvo'],
        countryName: 'Czech Republic'
      },
      DEFAULT: { 
        native: ['fighter jet', 'military aircraft', 'air force', 'defense procurement'],
        countryName: 'Unknown'
      }
    };

    const searchConfig = searchTermsByCountry[country] || searchTermsByCountry.DEFAULT;
    const localSearchTerms = searchConfig.native;
    const countryName = searchConfig.countryName;
    
    console.log('Search config:', { country, localSearchTerms, countryName });

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

    // Generate comprehensive search URLs
    const allSearchUrls: string[] = [];
    const dateFilter = `after:${startDate} before:${endDate}`;
    
    // 1. Search LOCAL country sources (if configured) with local language terms
    if (hasCountrySources) {
      console.log(`Searching ${sources.length} local sources with native terms`);
      for (const source of sources || []) {
        const domain = source.url.replace(/^https?:\/\//i, '').split('/')[0];
        
        // Local language searches on local sources
        for (const term of localSearchTerms) {
          const encodedTerm = encodeURIComponent(term);
          allSearchUrls.push(
            `https://html.duckduckgo.com/html/?q=site:${domain}+${encodedTerm}+${dateFilter}`
          );
        }
        
        // Fighter-specific searches on local sources
        for (const fighter of [...competitors, 'Gripen']) {
          const encodedFighter = encodeURIComponent(fighter);
          allSearchUrls.push(
            `https://html.duckduckgo.com/html/?q=site:${domain}+${encodedFighter}+${dateFilter}`
          );
          
          // Add variations for common misspellings/formats
          if (fighter === 'F-35') {
            allSearchUrls.push(
              `https://html.duckduckgo.com/html/?q=site:${domain}+F35+${dateFilter}`,
              `https://html.duckduckgo.com/html/?q=site:${domain}+"F-35"+${dateFilter}`
            );
          }
          if (fighter === 'F-16V') {
            allSearchUrls.push(
              `https://html.duckduckgo.com/html/?q=site:${domain}+F16+${dateFilter}`
            );
          }
        }
      }
    }

    // 2. Search general country domain with local terms (works without configured sources)
    console.log(`Searching general ${domainSuffix} domain with native terms`);
    for (const term of localSearchTerms) {
      const encodedTerm = encodeURIComponent(term);
      allSearchUrls.push(
        `https://html.duckduckgo.com/html/?q=${encodedTerm}+site:${domainSuffix}+${dateFilter}`
      );
    }
    
    for (const fighter of [...competitors, 'Gripen']) {
      const encodedFighter = encodeURIComponent(fighter);
      allSearchUrls.push(
        `https://html.duckduckgo.com/html/?q=${encodedFighter}+site:${domainSuffix}+${dateFilter}`
      );
      
      // Add broader searches without site restriction for country-specific content
      allSearchUrls.push(
        `https://html.duckduckgo.com/html/?q=${encodedFighter}+${encodeURIComponent(countryName)}+${dateFilter}`
      );
    }

    // 3. Search INTERNATIONAL media for articles mentioning fighters + country name
    console.log(`Searching international media for articles about fighters in ${countryName}`);
    
    // Major international defense/aviation outlets
    const internationalOutlets = [
      'defenseone.com',
      'defensenews.com', 
      'janes.com',
      'flightglobal.com',
      'airforcemag.com',
      'aviationweek.com',
      'breakingdefense.com',
      'thedrive.com/the-war-zone',
      'forbes.com',
      'reuters.com',
      'apnews.com',
      'bloomberg.com',
      'theguardian.com',
      'bbc.com',
      'cnn.com'
    ];
    
    // Fetch configured international sources
    const { data: intlSources } = await supabaseClient
      .from('sources')
      .select('*')
      .in('country', ['INT', 'EU', 'US', 'UK'])
      .eq('enabled', true);
    
    // Combine configured sources with default outlets
    const allInternationalSources = [
      ...(intlSources || []).map(s => s.url.replace(/^https?:\/\//i, '').split('/')[0]),
      ...internationalOutlets
    ];
    
    // Remove duplicates
    const uniqueIntlSources = [...new Set(allInternationalSources)];
    
    console.log(`Searching ${uniqueIntlSources.length} international sources`);
    for (const domain of uniqueIntlSources) {
      // Search for "fighter name + country name" on international outlets
      for (const fighter of [...competitors, 'Gripen']) {
        const searchQuery = encodeURIComponent(`${fighter} ${countryName}`);
        allSearchUrls.push(
          `https://html.duckduckgo.com/html/?q=site:${domain}+${searchQuery}+${dateFilter}`
        );
        
        // Add variant searches
        if (fighter === 'F-35') {
          allSearchUrls.push(
            `https://html.duckduckgo.com/html/?q=site:${domain}+F35+${encodeURIComponent(countryName)}+${dateFilter}`
          );
        }
      }
      
      // General defense procurement searches mentioning the country
      const defenseQuery = encodeURIComponent(`fighter aircraft ${countryName}`);
      allSearchUrls.push(
        `https://html.duckduckgo.com/html/?q=site:${domain}+${defenseQuery}+${dateFilter}`
      );
      
      // Military procurement general
      const militaryQuery = encodeURIComponent(`military procurement ${countryName}`);
      allSearchUrls.push(
        `https://html.duckduckgo.com/html/?q=site:${domain}+${militaryQuery}+${dateFilter}`
      );
    }
    
    // 4. General web search for fighters + country (fallback)
    for (const fighter of [...competitors, 'Gripen']) {
      const searchQuery = encodeURIComponent(`${fighter} ${countryName} -site:${domainSuffix}`);
      allSearchUrls.push(
        `https://html.duckduckgo.com/html/?q=${searchQuery}+${dateFilter}`
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
        // Decode DuckDuckGo redirect URLs immediately
        let url = match[1];
        url = decodeDuckDuckGoUrl(url);
        urls.push(url);
        titles.push(match[2].trim());
      }
      
      const snippets: string[] = [];
      while ((match = snippetRegex.exec(html)) !== null) {
        snippets.push(match[1].trim());
      }
      
      // Log sample of extracted URLs for debugging
      if (urls.length > 0) {
        console.log('Sample extracted URLs:', urls.slice(0, 3).map((url, i) => ({ 
          title: titles[i]?.substring(0, 50), 
          url: url.substring(0, 100) 
        })));
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
    
    // Create title-to-url mapping BEFORE sending to AI
    const titleUrlMap = new Map(preFilteredResults.map(r => [r.title.toLowerCase().trim(), r.url]));
    
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

IMPORTANT: Return ONLY the title for each article. Do NOT include URLs.

Articles:
${JSON.stringify(preFilteredResults.slice(0, 100).map(r => ({ title: r.title })), null, 2)}`
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
                      fighter_tags: { 
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Exact names: Gripen, F-35, Rafale, F-16V, Eurofighter, F/A-50'
                      },
                      sentiment: { type: 'number', description: 'Between -1 and 1' },
                      source_country: { type: 'string' }
                    },
                    required: ['title', 'fighter_tags', 'sentiment', 'source_country']
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
    
    console.log(`Step 9: AI extracted ${structuredArticles.length} articles with fighter mentions`);
    
    // Log FULL AI response for debugging
    console.log('========== AI RETURNED TITLES ==========');
    structuredArticles.forEach((a: any, idx: number) => {
      console.log(`Article ${idx + 1}:`, {
        title: a.title,
        fighters: a.fighter_tags,
        sentiment: a.sentiment,
        country: a.source_country
      });
    });
    console.log('========================================');

    // Recover URLs by matching titles to original search results (with fuzzy matching)
    console.log('Step 10: Recovering URLs from title matching...');
    const validArticles = structuredArticles.map((article: any) => {
      // Normalize titles for better matching
      const normalizeTitle = (title: string) => {
        return title.toLowerCase()
          .trim()
          .replace(/\s+/g, ' ')  // normalize whitespace
          .replace(/[^\w\s-]/g, '');  // remove special chars except dash
      };
      
      const aiTitle = normalizeTitle(article.title || '');
      
      // Try exact match first
      let matchingResult = preFilteredResults.find(r => 
        normalizeTitle(r.title) === aiTitle
      );
      
      // If no exact match, try fuzzy match (contains)
      if (!matchingResult) {
        matchingResult = preFilteredResults.find(r => {
          const resultTitle = normalizeTitle(r.title);
          return resultTitle.includes(aiTitle) || aiTitle.includes(resultTitle);
        });
      }
      
      if (!matchingResult) {
        console.warn('Could not match article to original results:', article.title?.substring(0, 50));
        console.warn('Available titles sample:', preFilteredResults.slice(0, 3).map(r => r.title.substring(0, 50)));
        return null;
      }
      
      // Use the URL from the original search result
      article.url = normalizeUrl(matchingResult.url);
      console.log(`Matched "${article.title?.substring(0, 50)}" to URL: ${article.url.substring(0, 80)}`);
      
      
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
          console.warn('No fighters detected, skipping:', article.title?.substring(0, 50));
          return null;
        }
      }
      
      return article;
    }).filter((article: any) => article !== null);

    console.log(`${validArticles.length} valid articles after URL recovery and validation`);

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
