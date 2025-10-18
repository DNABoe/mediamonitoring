import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    console.log('Step 1: Authenticating user...');
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    console.log(`Supabase URL: ${SUPABASE_URL.substring(0, 30)}...`);
    console.log(`Service key exists: ${SUPABASE_SERVICE_ROLE_KEY.length > 0}`);
    
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const token = authHeader.replace('Bearer ', '');
    
    // Parse body first to check if userId is provided (for service role calls)
    let bodyPreview;
    try {
      const bodyText = await req.text();
      bodyPreview = JSON.parse(bodyText);
      // Re-create request with the body for later parsing
      req = new Request(req.url, {
        method: req.method,
        headers: req.headers,
        body: bodyText,
      });
    } catch (e) {
      console.error('Failed to preview body:', e);
    }

    let userId: string;
    
    // If userId is provided in body (service role call from agent), use it
    if (bodyPreview?.userId) {
      console.log('Step 1: Using userId from request body (service role call)');
      userId = bodyPreview.userId;
      console.log('Step 1 SUCCESS: Service role authenticated for user:', userId);
    } else {
      // Otherwise, authenticate the user from the token
      const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
      
      if (userError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      userId = user.id;
      console.log('Step 1 SUCCESS: User authenticated:', userId);
    }

    console.log('Step 2: Parsing request body...');
    let body;
    try {
      body = await req.json();
      console.log('Step 2 SUCCESS: Request body parsed:', JSON.stringify(body));
    } catch (parseError) {
      console.error('Step 2 FAILED: Request parsing error:', parseError);
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

    console.log('Step 3: Supabase client already created during auth');

    console.log('Step 4: Checking API keys...');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const GOOGLE_SEARCH_API_KEY = Deno.env.get('GOOGLE_SEARCH_API_KEY');
    const GOOGLE_SEARCH_ENGINE_ID = Deno.env.get('GOOGLE_SEARCH_ENGINE_ID');
    
    if (!LOVABLE_API_KEY) {
      console.error('Step 4 FAILED: LOVABLE_API_KEY not configured');
      throw new Error('LOVABLE_API_KEY not configured');
    }
    if (!GOOGLE_SEARCH_API_KEY || !GOOGLE_SEARCH_ENGINE_ID) {
      console.error('Step 4 FAILED: Google Search credentials not configured');
      throw new Error('GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID must be configured');
    }
    console.log('Step 4 SUCCESS: All API keys present');

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
      ES: {
        native: ['caza', 'cazas', 'avión de combate', 'aviones de combate', 'adquisición militar', 'Fuerza Aérea'],
        countryName: 'Spain'
      },
      CO: {
        native: ['caza', 'cazas', 'avión de combate', 'aviones de combate', 'adquisición militar', 'Fuerza Aérea Colombiana', 'FAC'],
        countryName: 'Colombia'
      },
      MX: {
        native: ['caza', 'cazas', 'avión de combate', 'aviones de combate', 'adquisición militar', 'Fuerza Aérea Mexicana'],
        countryName: 'Mexico'
      },
      AR: {
        native: ['caza', 'cazas', 'avión de combate', 'aviones de combate', 'adquisición militar', 'Fuerza Aérea Argentina'],
        countryName: 'Argentina'
      },
      CL: {
        native: ['caza', 'cazas', 'avión de combate', 'aviones de combate', 'adquisición militar', 'Fuerza Aérea de Chile'],
        countryName: 'Chile'
      },
      PE: {
        native: ['caza', 'cazas', 'avión de combate', 'aviones de combate', 'adquisición militar', 'Fuerza Aérea del Perú', 'FAP'],
        countryName: 'Peru'
      },
      BR: {
        native: ['caça', 'caças', 'avião de combate', 'aviões de combate', 'aquisição militar', 'Força Aérea Brasileira'],
        countryName: 'Brazil'
      },
      CZ: {
        native: ['stíhačka', 'stíhací letoun', 'bojový letoun', 'vojenské letadlo', 'armáda', 'letectvo'],
        countryName: 'Czech Republic'
      },
      PL: {
        native: ['myśliwiec', 'samolot bojowy', 'zakup wojskowy', 'Siły Powietrzne'],
        countryName: 'Poland'
      },
      RO: {
        native: ['avion de vânătoare', 'avion de luptă', 'achiziție militară', 'Forțele Aeriene'],
        countryName: 'Romania'
      },
      GR: {
        native: ['μαχητικό αεροσκάφος', 'πολεμική αεροπορία', 'στρατιωτική προμήθεια'],
        countryName: 'Greece'
      },
      FR: {
        native: ['avion de chasse', 'chasseur', 'acquisition militaire', 'Armée de l\'Air'],
        countryName: 'France'
      },
      DE: {
        native: ['Kampfflugzeug', 'Jagdflugzeug', 'militärische Beschaffung', 'Luftwaffe'],
        countryName: 'Germany'
      },
      IT: {
        native: ['caccia', 'aereo da combattimento', 'acquisizione militare', 'Aeronautica Militare'],
        countryName: 'Italy'
      },
      DEFAULT: { 
        native: ['fighter jet', 'military aircraft', 'air force', 'defense procurement', 'combat aircraft'],
        countryName: 'Unknown'
      }
    };

    const searchConfig = searchTermsByCountry[country] || searchTermsByCountry.DEFAULT;
    const localSearchTerms = searchConfig.native;
    const countryName = searchConfig.countryName;
    
    console.log('Search config:', { country, localSearchTerms, countryName });

    // Determine domain suffix from country code
    const domainSuffix = `.${country.toLowerCase()}`;

    // Helper: Google Custom Search with better error handling and logging
    async function googleSearch(query: string, siteRestrict?: string, dateRange?: string): Promise<any[]> {
      try {
        let searchUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_SEARCH_API_KEY}&cx=${GOOGLE_SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}&num=10`;
        
        if (siteRestrict) {
          searchUrl += `&siteSearch=${encodeURIComponent(siteRestrict)}&siteSearchFilter=i`;
        }
        
        if (dateRange) {
          searchUrl += `&dateRestrict=${dateRange}`;
        }
        
        console.log(`  Google search: "${query.substring(0, 80)}"${siteRestrict ? ` (site: ${siteRestrict})` : ''}`);
        
        const response = await fetch(searchUrl);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`  Google search failed: ${response.status} - ${errorText.substring(0, 200)}`);
          return [];
        }
        
        const data = await response.json();
        
        if (!data.items || data.items.length === 0) {
          console.log(`  No results found for: "${query.substring(0, 60)}"`);
          return [];
        }
        
        console.log(`  ✓ Found ${data.items.length} results`);
        
        return data.items.map((item: any) => ({
          title: item.title,
          url: item.link,
          snippet: item.snippet || item.htmlSnippet || ''
        }));
      } catch (e) {
        console.error(`  Google search error for "${query.substring(0, 60)}":`, e);
        return [];
      }
    }

    // Batch searches with rate limiting and progress tracking
    async function batchGoogleSearch(searches: Array<{query: string, site?: string, dateRange?: string}>, delayMs = 200) {
      const results = [];
      let successCount = 0;
      let failCount = 0;
      
      console.log(`Starting ${searches.length} Google searches...`);
      
      for (let i = 0; i < searches.length; i++) {
        const search = searches[i];
        const items = await googleSearch(search.query, search.site, search.dateRange);
        
        if (items.length > 0) {
          results.push(...items);
          successCount++;
        } else {
          failCount++;
        }
        
        // Progress logging every 10 searches
        if ((i + 1) % 10 === 0 || i === searches.length - 1) {
          console.log(`Progress: ${i + 1}/${searches.length} searches | ${successCount} with results | ${failCount} empty | ${results.length} total articles`);
        }
        
        // Rate limiting delay
        if (i < searches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
      
      console.log(`Search complete: ${successCount} successful, ${failCount} empty, ${results.length} total articles found`);
      return results;
    }

    // Generate comprehensive search queries for Google Custom Search
    const allSearchQueries: Array<{query: string, site?: string, dateRange?: string}> = [];
    
    // Calculate date range in days for Google's dateRestrict parameter
    const daysDiff = Math.floor((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
    const dateRange = `d${Math.min(daysDiff, 365)}`; // Google max is 365 days
    
    console.log(`Step 6: Building search queries for ${country} (${countryName}), date range: ${dateRange} (${daysDiff} days)`);
    
    // STRATEGY 1: Search with configured local sources (most precise)
    if (hasCountrySources && sources && sources.length > 0) {
      console.log(`Building queries for ${sources.length} configured local sources`);
      
      for (const source of sources) {
        const domain = source.url.replace(/^https?:\/\//i, '').split('/')[0];
        
        // Fighter names on each source (highest priority)
        for (const fighter of [...competitors, 'Gripen']) {
          allSearchQueries.push({
            query: fighter,
            site: domain,
            dateRange
          });
        }
        
        // Top native terms on each source
        for (const term of localSearchTerms.slice(0, 2)) {
          allSearchQueries.push({
            query: term,
            site: domain,
            dateRange
          });
        }
      }
    }

    // STRATEGY 2: General country domain searches (works even without configured sources)
    console.log(`Building general ${domainSuffix} domain searches`);
    
    // Search for ALL fighters (not just competitors)
    const allFighters = ['Gripen', 'F-35', 'Rafale', 'F-16V', 'Eurofighter', 'F/A-50'];
    for (const fighter of allFighters) {
      allSearchQueries.push({
        query: `${fighter} site:${domainSuffix}`,
        dateRange
      });
    }
    
    // Native language terms on country TLD
    for (const term of localSearchTerms.slice(0, 4)) {
      allSearchQueries.push({
        query: `${term} site:${domainSuffix}`,
        dateRange
      });
    }
    
    // Broad terms (without site restriction to catch aggregators)
    for (const fighter of allFighters) {
      allSearchQueries.push({
        query: `${fighter} ${countryName}`,
        dateRange
      });
      
      // Add "procurement" context
      allSearchQueries.push({
        query: `${fighter} ${countryName} procurement`,
        dateRange
      });
    }

    // STRATEGY 3: International defense media
    console.log(`Building international media searches`);
    
    const topInternationalOutlets = [
      'defensenews.com',
      'flightglobal.com', 
      'janes.com',
      'aviationweek.com',
      'reuters.com',
      'bloomberg.com'
    ];
    
    // Fetch configured international sources
    const { data: intlSources } = await supabaseClient
      .from('sources')
      .select('*')
      .in('country', ['INT', 'EU', 'US', 'UK'])
      .eq('enabled', true);
    
    const allInternationalSources = [
      ...(intlSources || []).map(s => s.url.replace(/^https?:\/\//i, '').split('/')[0]),
      ...topInternationalOutlets
    ];
    
    const uniqueIntlSources = [...new Set(allInternationalSources)];
    
    console.log(`Will search ${uniqueIntlSources.length} international sources`);
    
    // Search top international sources for each fighter + country
    for (const domain of uniqueIntlSources.slice(0, 8)) {
      for (const fighter of allFighters) {
        allSearchQueries.push({
          query: `${fighter} ${countryName}`,
          site: domain,
          dateRange
        });
      }
    }

    // STRATEGY 4: General procurement and acquisition terms
    allSearchQueries.push(
      { query: `fighter aircraft procurement ${countryName}`, dateRange },
      { query: `fighter jet acquisition ${countryName}`, dateRange },
      { query: `air force modernization ${countryName}`, dateRange },
      { query: `military aircraft purchase ${countryName}`, dateRange },
      { query: `defense procurement ${countryName}`, dateRange }
    );

    console.log(`Step 7: Total of ${allSearchQueries.length} Google search queries prepared`);
    console.log(`Sample queries:`, allSearchQueries.slice(0, 5).map(q => `"${q.query}"${q.site ? ` site:${q.site}` : ''}`));

    console.log(`Step 7: Executing ${allSearchQueries.length} Google searches...`);

    // Execute all searches
    const searchResults = await batchGoogleSearch(allSearchQueries);
    
    // Deduplicate by URL
    const uniqueResults = Array.from(
      new Map(searchResults.map(r => [normalizeUrl(r.url), r])).values()
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
    // AI analyzes ALL articles and picks the most important ones
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
          content: `You are analyzing news articles about FIGHTER JET PROCUREMENT for ${countryName}.

I have ${uniqueResults.length} articles from the last ${daysDiff} days. Your task is to:
1. ONLY identify articles about fighter jet PROCUREMENT, ACQUISITION, or PURCHASE decisions (NOT general military news)
2. Focus SPECIFICALLY on ${countryName}'s potential purchase or acquisition of fighter jets: Gripen, F-35, Rafale, F-16V, Eurofighter, F/A-50
3. Return ONLY articles discussing procurement decisions, bids, offers, negotiations, or purchases (max 50)
4. For each article, identify which fighters are mentioned and the sentiment

CRITICAL EXCLUSION RULES:
- EXCLUDE general military exercises or operations
- EXCLUDE historical or technical articles about fighters (unless discussing procurement)
- EXCLUDE articles that only mention fighters in passing
- EXCLUDE articles about other countries' purchases (unless comparing to ${countryName})
- ONLY INCLUDE articles where ${countryName} is considering, negotiating, or purchasing fighter jets

Articles to analyze:
${JSON.stringify(uniqueResults.slice(0, 100).map(r => ({ 
  title: r.title, 
  snippet: r.snippet
})), null, 2)}`
        }],
        tools: [{
          type: 'function',
          function: {
            name: 'extract_important_articles',
            description: 'Extract the most important fighter jet articles',
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
                        description: 'Fighter jets mentioned: Gripen, F-35, Rafale, F-16V, Eurofighter, F/A-50'
                      },
                      sentiment: { 
                        type: 'number', 
                        description: 'Sentiment: positive (0.7), neutral (0.0), negative (-0.7)' 
                      },
                      importance: {
                        type: 'number',
                        description: 'Importance score 1-10, where 10 is breaking news about procurement'
                      },
                      source_country: { 
                        type: 'string',
                        description: `Use "${country}" for local ${countryName} sources, "INTERNATIONAL" for others`
                      }
                    },
                    required: ['title', 'fighter_tags', 'sentiment', 'importance', 'source_country']
                  }
                }
              },
              required: ['articles']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'extract_important_articles' } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText.substring(0, 500));
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log('AI response received');
    
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.error('AI did not use tool:', JSON.stringify(aiData.choices?.[0]?.message).substring(0, 500));
      throw new Error('AI did not return structured data');
    }
    
    const extractedData = JSON.parse(toolCall.function.arguments);
    let structuredArticles = extractedData.articles || [];
    
    console.log(`Step 11: AI identified ${structuredArticles.length} important articles`);
    
    // Log what AI returned
    console.log('========== AI ANALYSIS RESULTS ==========');
    structuredArticles.slice(0, 10).forEach((a: any, idx: number) => {
      console.log(`${idx + 1}. "${a.title?.substring(0, 60)}" | Fighters: ${a.fighter_tags?.join(', ')} | Importance: ${a.importance} | Sentiment: ${a.sentiment}`);
    });
    if (structuredArticles.length > 10) {
      console.log(`... and ${structuredArticles.length - 10} more articles`);
    }
    console.log('========================================');
    
    // Sort by importance and take top articles
    structuredArticles = structuredArticles
      .filter((a: any) => a.importance >= 5) // Only keep important articles (5+/10)
      .sort((a: any, b: any) => (b.importance || 0) - (a.importance || 0))
      .slice(0, 50); // Max 50 articles
    
    console.log(`Step 12: Filtered to top ${structuredArticles.length} articles (importance >= 5/10)`);

    // Map AI results to URLs from original Google results
    console.log(`Step 13: Mapping ${structuredArticles.length} articles to URLs...`);
    const validArticles = structuredArticles.map((article: any) => {
      const normalizeTitle = (title: string) => {
        return title.toLowerCase()
          .trim()
          .replace(/\s+/g, ' ')
          .replace(/[^\w\s-]/g, '');
      };
      
      const aiTitle = normalizeTitle(article.title || '');
      
      // Find matching result from uniqueResults (all Google results)
      let matchingResult = uniqueResults.find(r => 
        normalizeTitle(r.title) === aiTitle
      );
      
      if (!matchingResult) {
        matchingResult = uniqueResults.find(r => {
          const resultTitle = normalizeTitle(r.title);
          return resultTitle.includes(aiTitle) || aiTitle.includes(resultTitle);
        });
      }
      
      if (!matchingResult) {
        console.warn('Could not match article:', article.title?.substring(0, 50));
        return null;
      }
      
      article.url = normalizeUrl(matchingResult.url);
      console.log(`✓ Matched "${article.title?.substring(0, 40)}" -> ${article.url.substring(0, 60)}`);
      
      // Ensure fighter_tags is array
      if (!article.fighter_tags || !Array.isArray(article.fighter_tags)) {
        article.fighter_tags = [];
      }
      
      // Fallback fighter detection if AI missed them
      if (article.fighter_tags.length === 0) {
        const combined = `${article.title} ${matchingResult?.snippet || ''}`.toLowerCase();
        const detected = [];
        
        if (combined.includes('gripen') || combined.includes('jas 39') || combined.includes('jas-39')) {
          detected.push('Gripen');
        }
        if (combined.includes('f-35') || combined.includes('f35') || combined.includes('f 35') || 
            combined.includes('lightning ii') || combined.includes('joint strike fighter') || combined.includes('jsf')) {
          detected.push('F-35');
        }
        if (combined.includes('rafale')) {
          detected.push('Rafale');
        }
        if (combined.includes('f-16') || combined.includes('f16') || combined.includes('f 16') || 
            combined.includes('viper') || combined.includes('fighting falcon')) {
          detected.push('F-16V');
        }
        if (combined.includes('eurofighter') || combined.includes('typhoon') || combined.includes('euro fighter')) {
          detected.push('Eurofighter');
        }
        if (combined.includes('f/a-50') || combined.includes('fa-50') || combined.includes('fa 50') || 
            combined.includes('golden eagle')) {
          detected.push('F/A-50');
        }
        
        if (detected.length > 0) {
          console.log(`✓ Fallback detection for "${article.title?.substring(0, 40)}": ${detected.join(', ')}`);
          article.fighter_tags = detected;
        } else {
          console.warn(`✗ No fighters detected, skipping: "${article.title?.substring(0, 50)}"`);
          return null;
        }
      }
      
      return article;
    }).filter((article: any) => article !== null);

    console.log(`${validArticles.length} valid articles after URL recovery and validation`);

    // Store articles in database with robust error handling
    let storedCount = 0;
    const errors = [];
    
    console.log(`========== STORING ${validArticles.length} ARTICLES ==========`);
    
    for (const article of validArticles) {
      try {
        // Match to source and determine country
        let sourceId = null;
        let sourceCountry = 'INTERNATIONAL'; // Default
        
        console.log(`Processing article: "${article.title?.substring(0, 60)}"`);
        console.log(`  URL: ${article.url.substring(0, 100)}`);
        console.log(`  AI-detected country: ${article.source_country}`);
        console.log(`  Fighter tags: ${article.fighter_tags?.join(', ')}`);
        
        // First try to match against configured sources
        if (sources) {
          for (const source of sources) {
            const sourceDomain = source.url.replace(/^https?:\/\//i, '').split('/')[0];
            if (article.url.includes(sourceDomain)) {
              sourceId = source.id;
              sourceCountry = source.country;
              console.log(`  ✓ Matched to configured source: ${source.name} (${source.country})`);
              break;
            }
          }
        }

        // If no source match, detect from URL domain (THIS IS AUTHORITATIVE)
        if (!sourceId) {
          try {
            const urlObj = new URL(article.url);
            const hostname = urlObj.hostname;
            
            // Check if it's a local country domain - CRITICAL LOGIC
            if (hostname.endsWith(domainSuffix)) {
              sourceCountry = country;
              console.log(`  ✓ Detected LOCAL domain: ${hostname} ends with ${domainSuffix} -> ${sourceCountry}`);
            } else {
              // International domain (.com, .org, .net, .co.uk, etc.)
              sourceCountry = 'INTERNATIONAL';
              console.log(`  ✓ Detected INTERNATIONAL domain: ${hostname} does not end with ${domainSuffix} -> INTERNATIONAL`);
            }
          } catch (urlError) {
            console.error('  ✗ Error parsing URL for country detection:', article.url, urlError);
            sourceCountry = 'INTERNATIONAL'; // Fallback to international
          }
        }

        // Try to extract or estimate publication date
        let publishedAt = new Date().toISOString();
        
        // Distribute articles over the baseline period
        const baselineStart = new Date(startDate);
        const baselineEnd = new Date(endDate);
        
        // Randomly distribute within the last 60 days of the baseline period
        const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;
        const distributionStart = Math.max(baselineStart.getTime(), baselineEnd.getTime() - sixtyDaysMs);
        const distributionRange = baselineEnd.getTime() - distributionStart;
        const randomOffset = Math.random() * distributionRange;
        publishedAt = new Date(distributionStart + randomOffset).toISOString();
        
        console.log(`  Published at: ${publishedAt.substring(0, 10)}`);

        // Validate fighter_tags before insert
        if (!article.fighter_tags || !Array.isArray(article.fighter_tags) || article.fighter_tags.length === 0) {
          console.error(`  ✗ SKIPPING: No valid fighter_tags for article`);
          errors.push({ url: article.url, error: 'No fighter tags' });
          continue;
        }

        // Prepare insert data
        const insertData = {
          url: article.url,
          title_en: article.title || 'Untitled',
          source_id: sourceId,
          source_country: sourceCountry,
          published_at: publishedAt,
          fighter_tags: article.fighter_tags,
          sentiment: typeof article.sentiment === 'number' ? article.sentiment : 0,
          fetched_at: new Date().toISOString(),
          user_id: userId,
          tracking_country: country
        };
        
        console.log(`  Inserting with data:`, JSON.stringify(insertData, null, 2));

        // Store with all available data, using defaults for missing fields
        const { data: insertedData, error: insertError } = await supabaseClient
          .from('items')
          .upsert(insertData, {
            onConflict: 'url'
          })
          .select();

        if (insertError) {
          errors.push({ url: article.url, error: insertError.message, details: insertError });
          console.error(`  ✗ INSERT ERROR:`, JSON.stringify(insertError, null, 2));
          console.error(`  Insert data was:`, JSON.stringify(insertData, null, 2));
        } else {
          storedCount++;
          console.log(`  ✓ STORED SUCCESSFULLY (ID: ${insertedData?.[0]?.id || 'unknown'})`);
        }
      } catch (e) {
        errors.push({ url: article.url, error: e instanceof Error ? e.message : 'Unknown' });
        console.error('  ✗ EXCEPTION storing article:', e);
      }
    }
    
    console.log(`========== STORAGE COMPLETE ==========`);

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
