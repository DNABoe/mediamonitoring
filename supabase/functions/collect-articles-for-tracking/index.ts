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
    
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const token = authHeader.replace('Bearer ', '');
    
    let userId: string;
    
    // Check if this is a service role call (from agent) or user call (from UI)
    if (token === SUPABASE_SERVICE_ROLE_KEY) {
      // Service role call - userId must be in the request body
      console.log('Service role authentication detected');
      const body = await req.json();
      userId = body.userId;
      
      if (!userId) {
        return new Response(JSON.stringify({ error: 'userId required for service role calls' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      console.log('Step 1 SUCCESS: Service role authenticated for user:', userId);
      
      // Re-parse the body for later use
      req = new Request(req.url, {
        method: req.method,
        headers: req.headers,
        body: JSON.stringify(body)
      });
    } else {
      // User authentication
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

    console.log('Step 2: Parsing and validating request body...');
    const body = await req.json();
    
    // Validate input parameters
    const { country, competitors, startDate, endDate } = body;
    
    console.log('Received parameters:', { country, competitors, startDate, endDate });
    
    if (!country || typeof country !== 'string' || !/^[A-Z]{2}$/.test(country)) {
      console.error('Invalid country:', country);
      return new Response(JSON.stringify({ 
        error: 'Invalid request parameters',
        details: 'Country must be a 2-letter uppercase code'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    if (!Array.isArray(competitors) || competitors.length === 0 || competitors.length > 10) {
      console.error('Invalid competitors array:', competitors);
      return new Response(JSON.stringify({ 
        error: 'Invalid request parameters',
        details: 'Competitors must be an array with 1-10 items'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    for (const competitor of competitors) {
      if (typeof competitor !== 'string' || competitor.length > 50) {
        console.error('Invalid competitor:', competitor);
        return new Response(JSON.stringify({ 
          error: 'Invalid request parameters',
          details: 'Each competitor must be a string ≤ 50 characters'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }
    
    if (!startDate || !endDate) {
      console.error('Missing dates - startDate:', startDate, 'endDate:', endDate);
      return new Response(JSON.stringify({ 
        error: 'Invalid request parameters',
        details: 'Both startDate and endDate are required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    
    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      console.error('Invalid date format - startDate:', startDate, 'endDate:', endDate);
      return new Response(JSON.stringify({ 
        error: 'Invalid request parameters',
        details: 'Dates must be in valid YYYY-MM-DD format'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    if (endDateObj <= startDateObj) {
      console.error('End date must be after start date - start:', startDate, 'end:', endDate);
      return new Response(JSON.stringify({ 
        error: 'Invalid request parameters',
        details: 'End date must be after start date'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Limit date range to maximum 2 years to prevent resource exhaustion
    // (increased to accommodate tracking from baseline date)
    const maxDays = 730;
    const daysDiff = Math.floor((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24));
    console.log(`Date range: ${daysDiff} days (max allowed: ${maxDays})`);
    
    if (daysDiff > maxDays) {
      console.error(`Date range too large: ${daysDiff} days exceeds maximum of ${maxDays} days`);
      return new Response(JSON.stringify({ 
        error: 'Invalid request parameters',
        details: `Date range too large: ${daysDiff} days exceeds maximum of ${maxDays} days. Please select a shorter time period.`
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    console.log('Step 2 SUCCESS: Request validated:', { country, competitors, startDate, endDate });

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

    console.log('Step 5: Checking for existing collection to enable smart incremental updates...');
    
    // Check if we already have articles collected for this tracking period
    const { data: existingArticles, error: existingError } = await supabaseClient
      .from('items')
      .select('fetched_at')
      .eq('user_id', userId)
      .eq('tracking_country', country)
      .order('fetched_at', { ascending: false })
      .limit(1);
    
    const hasExistingCollection = existingArticles && existingArticles.length > 0;
    const lastCollectionDate = hasExistingCollection ? new Date(existingArticles[0].fetched_at) : null;
    
    let isIncrementalUpdate = false;
    let incrementalDays = 2; // Default: focus on last 2 days for incremental updates
    
    if (hasExistingCollection && lastCollectionDate) {
      const hoursSinceLastCollection = (Date.now() - lastCollectionDate.getTime()) / (1000 * 60 * 60);
      
      // If last collection was within the last 3 days, do incremental update (reduced from 7 days)
      if (hoursSinceLastCollection < 72) { // 3 days = 72 hours
        isIncrementalUpdate = true;
        // Focus on 1-2 days for very recent articles
        incrementalDays = Math.max(1, Math.min(2, Math.ceil(hoursSinceLastCollection / 24)));
        console.log(`✓ INCREMENTAL UPDATE MODE: Last collection was ${Math.round(hoursSinceLastCollection)} hours ago`);
        console.log(`  Will PRIORITIZE newest articles (last ${incrementalDays} days) with multiple date-sorted passes`);
        console.log(`  Strategy: Focus on absolute newest content to catch breaking news`);
      } else {
        console.log(`Last collection was ${Math.round(hoursSinceLastCollection / 24)} days ago - doing full collection`);
      }
    } else {
      console.log('No existing collection found - doing initial full collection');
    }

    console.log('Step 6: Fetching enabled media sources...');
    const { data: sources, error: sourcesError } = await supabaseClient
      .from('sources')
      .select('*')
      .eq('country', country)
      .eq('enabled', true);

    if (sourcesError) {
      console.error('Step 6 FAILED: Error fetching sources:', sourcesError);
      throw sourcesError;
    }
    console.log(`Step 6 SUCCESS: Found ${sources?.length || 0} enabled sources for ${country}`);
    
    // If no country-specific sources, use general domain search
    const hasCountrySources = sources && sources.length > 0;
    if (!hasCountrySources) {
      console.log(`No sources configured for ${country}, will use general domain search`);
    }

    // Multi-language search terms based on country - enhanced for better relevance
    const searchTermsByCountry: Record<string, { native: string[], countryName: string }> = {
      PT: { 
        native: ['caça', 'caças', 'avião de combate', 'aviões de combate', 'aquisição avião militar', 'Força Aérea Portuguesa', 'F-35', 'Gripen', 'Rafale'],
        countryName: 'Portugal'
      },
      ES: {
        native: ['caza', 'cazas', 'avión de combate', 'aviones de combate', 'adquisición militar', 'Ejército del Aire', 'F-35', 'Gripen', 'Rafale'],
        countryName: 'Spain'
      },
      CO: {
        native: ['caza', 'cazas', 'avión de combate', 'aviones de combate', 'adquisición militar', 'Fuerza Aérea Colombiana', 'FAC', 'F-35', 'Gripen', 'Rafale'],
        countryName: 'Colombia'
      },
      MX: {
        native: ['caza', 'cazas', 'avión de combate', 'aviones de combate', 'adquisición militar', 'Fuerza Aérea Mexicana', 'F-35', 'Gripen'],
        countryName: 'Mexico'
      },
      AR: {
        native: ['caza', 'cazas', 'avión de combate', 'aviones de combate', 'adquisición militar', 'Fuerza Aérea Argentina', 'F-35', 'Gripen'],
        countryName: 'Argentina'
      },
      CL: {
        native: ['caza', 'cazas', 'avión de combate', 'aviones de combate', 'adquisición militar', 'Fuerza Aérea de Chile', 'F-35', 'Gripen'],
        countryName: 'Chile'
      },
      PE: {
        native: ['caza', 'cazas', 'avión de combate', 'aviones de combate', 'adquisición militar', 'Fuerza Aérea del Perú', 'FAP', 'F-35', 'Gripen'],
        countryName: 'Peru'
      },
      BR: {
        native: ['caça', 'caças', 'avião de combate', 'aviões de combate', 'aquisição militar', 'Força Aérea Brasileira', 'F-35', 'Gripen', 'Rafale'],
        countryName: 'Brazil'
      },
      CZ: {
        native: ['stíhačka', 'stíhací letoun', 'bojový letoun', 'nákup stíhaček', 'Vzdušné síly', 'F-35', 'Gripen'],
        countryName: 'Czech Republic'
      },
      PL: {
        native: ['myśliwiec', 'samolot bojowy', 'zakup myśliwców', 'Siły Powietrzne', 'F-35', 'Gripen'],
        countryName: 'Poland'
      },
      RO: {
        native: ['avion de vânătoare', 'avion de luptă', 'achiziție avioane militare', 'Forțele Aeriene Române', 'F-35', 'Gripen'],
        countryName: 'Romania'
      },
      GR: {
        native: ['μαχητικό αεροσκάφος', 'πολεμική αεροπορία', 'αγορά μαχητικών', 'F-35', 'Gripen', 'Rafale'],
        countryName: 'Greece'
      },
      FR: {
        native: ['avion de chasse', 'chasseur', 'acquisition avions de combat', 'Armée de l\'Air', 'F-35', 'Rafale'],
        countryName: 'France'
      },
      DE: {
        native: ['Kampfflugzeug', 'Jagdflugzeug', 'Beschaffung Kampfjets', 'Luftwaffe', 'F-35', 'Eurofighter'],
        countryName: 'Germany'
      },
      IT: {
        native: ['caccia', 'aereo da combattimento', 'acquisizione caccia', 'Aeronautica Militare', 'F-35', 'Eurofighter'],
        countryName: 'Italy'
      },
      DEFAULT: { 
        native: ['fighter jet procurement', 'military aircraft acquisition', 'air force fighters', 'defense procurement fighters', 'F-35', 'Gripen', 'Rafale'],
        countryName: 'Unknown'
      }
    };

    const searchConfig = searchTermsByCountry[country] || searchTermsByCountry.DEFAULT;
    const localSearchTerms = searchConfig.native;
    const countryName = searchConfig.countryName;
    
    console.log('Search config:', { country, localSearchTerms, countryName });

    // Determine domain suffix from country code
    const domainSuffix = `.${country.toLowerCase()}`;

    // Helper: Google Custom Search with better error handling, sorting, and date filtering
    async function googleSearch(query: string, siteRestrict?: string, dateRange?: string, sortByDate = false): Promise<any[]> {
      try {
        let searchUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_SEARCH_API_KEY}&cx=${GOOGLE_SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}&num=10`;
        
        if (siteRestrict) {
          searchUrl += `&siteSearch=${encodeURIComponent(siteRestrict)}&siteSearchFilter=i`;
        }
        
        if (dateRange) {
          searchUrl += `&dateRestrict=${dateRange}`;
        }
        
        // Sort by date to get newest articles (critical for real-time monitoring)
        if (sortByDate) {
          searchUrl += `&sort=date`;
        }
        
        console.log(`  Google search: "${query.substring(0, 80)}"${siteRestrict ? ` (site: ${siteRestrict})` : ''}${sortByDate ? ' [SORTED BY DATE]' : ''}`);
        
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
          snippet: item.snippet || item.htmlSnippet || '',
          // Try to extract date from pagemap metadata if available
          publishedDate: item.pagemap?.metatags?.[0]?.['article:published_time'] || 
                        item.pagemap?.metatags?.[0]?.['datePublished'] ||
                        null
        }));
      } catch (e) {
        console.error(`  Google search error for "${query.substring(0, 60)}":`, e);
        return [];
      }
    }

    // Batch searches with rate limiting, progress tracking, quota detection, and date sorting
    async function batchGoogleSearch(searches: Array<{query: string, site?: string, dateRange?: string, sortByDate?: boolean}>, delayMs = 200) {
      const results = [];
      let successCount = 0;
      let failCount = 0;
      let quotaExceeded = false;
      
      console.log(`Starting ${searches.length} Google searches...`);
      
      for (let i = 0; i < searches.length; i++) {
        const search = searches[i];
        const items = await googleSearch(search.query, search.site, search.dateRange, search.sortByDate || false);
        
        // Check for quota exceeded (empty results after successful ones might indicate quota)
        if (items.length === 0 && successCount > 0 && i > 10) {
          console.warn(`Possible quota exceeded at search ${i + 1}/${searches.length}`);
          quotaExceeded = true;
        }
        
        if (items.length > 0) {
          results.push(...items);
          successCount++;
        } else {
          failCount++;
        }
        
        // Progress logging every 5 searches
        if ((i + 1) % 5 === 0 || i === searches.length - 1) {
          console.log(`Progress: ${i + 1}/${searches.length} searches | ${successCount} with results | ${failCount} empty | ${results.length} total articles`);
        }
        
        // Rate limiting delay
        if (i < searches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
      
      console.log(`Search complete: ${successCount} successful, ${failCount} empty, ${results.length} total articles found`);
      if (quotaExceeded) {
        console.warn(`⚠️ Google API quota may have been exceeded`);
      }
      return { results, quotaExceeded, successCount, failCount };
    }

    // Generate SMART search queries - full or incremental based on existing collection
    const allSearchQueries: Array<{query: string, site?: string, dateRange?: string, sortByDate?: boolean}> = [];
    
    if (isIncrementalUpdate) {
      console.log(`Step 7: Building INCREMENTAL search queries (last ${incrementalDays} days ONLY) - drastically reduced API calls`);
      console.log(`Strategy: Only newest articles with date sorting to minimize searches`);
    } else {
      console.log(`Step 7: Building COMPREHENSIVE search queries for initial collection: ${startDate} to ${endDate} (${daysDiff} days)`);
      console.log(`Strategy: Multiple date ranges (recent + historical) for complete coverage`);
    }
    
    if (isIncrementalUpdate) {
      // ============ INCREMENTAL MODE: AGGRESSIVE newest content focus ============
      console.log(`INCREMENTAL: Multi-pass strategy to catch ALL newest articles`);
      
      // PASS 1: Last 24 hours - CRITICAL for breaking news (SUPER RECENT)
      console.log(`  PASS 1: Last 24 hours (BREAKING NEWS priority)`);
      for (const fighter of [...competitors, 'Gripen']) {
        allSearchQueries.push({
          query: `${fighter} ${countryName}`,
          dateRange: 'd1',
          sortByDate: true
        });
      }
      
      // PASS 2: Last 2-3 days with date sorting
      const recentDateRange = `d${incrementalDays}`;
      console.log(`  PASS 2: Last ${incrementalDays} days (recent coverage)`);
      for (const fighter of [...competitors, 'Gripen']) {
        allSearchQueries.push({
          query: `${fighter} ${countryName}`,
          dateRange: recentDateRange,
          sortByDate: true
        });
      }
      
      // PASS 3: Configured sources - last 2 days ONLY
      if (hasCountrySources && sources && sources.length > 0) {
        console.log(`  PASS 3: Top 3 sources (last 2 days)`);
        const topSources = sources.slice(0, 3);
        for (const source of topSources) {
          const domain = source.url.replace(/^https?:\/\//i, '').split('/')[0];
          for (const fighter of [...competitors, 'Gripen']) {
            allSearchQueries.push({
              query: fighter,
              site: domain,
              dateRange: 'd2',
              sortByDate: true
            });
          }
        }
      }
      
      // PASS 4: Country domain - newest only
      console.log(`  PASS 4: Country domain (last 2 days)`);
      for (const fighter of [...competitors, 'Gripen']) {
        allSearchQueries.push({
          query: `${fighter} site:${domainSuffix}`,
          dateRange: 'd2',
          sortByDate: true
        });
      }
      
      console.log(`INCREMENTAL MODE: ${allSearchQueries.length} targeted searches focusing on NEWEST content`);
      
    } else {
      // ============ FULL MODE: Comprehensive searches for initial collection ============
      
      // STRATEGY 1: NEWEST articles first (CRITICAL - sorted by date for real-time monitoring)
      console.log(`Building DATE-SORTED queries for NEWEST articles (last 7 days)`);
      const recentDateRange = 'd7';
      
      // All competitors + Gripen, sorted by date
      for (const fighter of [...competitors, 'Gripen']) {
        allSearchQueries.push({
          query: `${fighter} ${countryName}`,
          dateRange: recentDateRange,
          sortByDate: true
        });
      }
      
      // Country domain, date-sorted
      for (const fighter of [...competitors, 'Gripen']) {
        allSearchQueries.push({
          query: `${fighter} site:${domainSuffix}`,
          dateRange: recentDateRange,
          sortByDate: true
        });
      }
      
      // STRATEGY 2: Configured local sources with multiple date ranges
      if (hasCountrySources && sources && sources.length > 0) {
        const topSources = sources.slice(0, 5);
        console.log(`Building queries for TOP ${topSources.length} configured local sources`);
        
        for (const source of topSources) {
          const domain = source.url.replace(/^https?:\/\//i, '').split('/')[0];
          
          for (const fighter of [...competitors, 'Gripen']) {
            // Recent (last 30 days) - sorted by date
            allSearchQueries.push({
              query: fighter,
              site: domain,
              dateRange: 'd30',
              sortByDate: true
            });
            
            // Historical (no date restriction for older articles)
            allSearchQueries.push({
              query: fighter,
              site: domain,
              dateRange: undefined
            });
          }
        }
      }

      // STRATEGY 3: Country domain searches with better coverage
      console.log(`Building comprehensive ${domainSuffix} domain searches`);
      
      for (const fighter of [...competitors, 'Gripen']) {
        // Recent
        allSearchQueries.push({
          query: `${fighter} site:${domainSuffix}`,
          dateRange: 'd30',
          sortByDate: true
        });
        // Historical
        allSearchQueries.push({
          query: `${fighter} site:${domainSuffix}`,
          dateRange: undefined
        });
      }
      
      // Native search terms
      for (const term of localSearchTerms.slice(0, 3)) {
        allSearchQueries.push({
          query: `${term} site:${domainSuffix}`,
          dateRange: 'd30',
          sortByDate: true
        });
      }
      
      // Broad procurement terms
      for (const fighter of [...competitors, 'Gripen']) {
        allSearchQueries.push({
          query: `${fighter} ${countryName} procurement`,
          dateRange: 'd30',
          sortByDate: true
        });
        allSearchQueries.push({
          query: `${fighter} ${countryName} acquisition`,
          dateRange: undefined
        });
      }

      // STRATEGY 4: International defense media with comprehensive coverage
      console.log(`Building international media searches`);
      
      const topInternationalOutlets = [
        'defensenews.com',
        'janes.com',
        'flightglobal.com',
        'airforce-technology.com',
        'defenseworld.net'
      ];
      
      for (const domain of topInternationalOutlets) {
        for (const fighter of [...competitors, 'Gripen']) {
          // Recent
          allSearchQueries.push({
            query: `${fighter} ${countryName}`,
            site: domain,
            dateRange: 'd30',
            sortByDate: true
          });
          // Historical
          allSearchQueries.push({
            query: `${fighter} ${countryName}`,
            site: domain,
            dateRange: undefined
          });
        }
      }

      // STRATEGY 5: General defense procurement terms
      allSearchQueries.push(
        { query: `fighter aircraft procurement ${countryName}`, dateRange: 'd30', sortByDate: true },
        { query: `air force modernization ${countryName}`, dateRange: 'd30', sortByDate: true },
        { query: `combat aircraft ${countryName}`, dateRange: undefined },
        { query: `military aviation ${countryName}`, dateRange: undefined }
      );
    }

    console.log(`Step 7: Total of ${allSearchQueries.length} Google search queries prepared`);
    console.log(`Sample queries:`, allSearchQueries.slice(0, 5).map(q => `"${q.query}"${q.site ? ` site:${q.site}` : ''}`));

    console.log(`Step 7: Executing ${allSearchQueries.length} OPTIMIZED Google searches (reduced from ~100+)...`);

    // Execute all searches
    const { results: searchResults, quotaExceeded, successCount, failCount } = await batchGoogleSearch(allSearchQueries);
    
    // Deduplicate by URL
    const uniqueResults = Array.from(
      new Map(searchResults.map(r => [normalizeUrl(r.url), r])).values()
    );

    console.log(`Found ${uniqueResults.length} unique articles for tracking period`);

    if (uniqueResults.length === 0) {
      return new Response(JSON.stringify({ 
        articles: [],
        message: 'No articles found for tracking period',
        quotaExceeded,
        searchStats: { total: allSearchQueries.length, success: successCount, failed: failCount }
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
1. STRICTLY identify articles about fighter jet PROCUREMENT, ACQUISITION, or PURCHASE for ${countryName}'s Air Force
2. Focus on these specific fighters: ${competitors.join(', ')}, Gripen
3. Return ONLY highly relevant articles (max 40 articles)
4. Assign importance score based on relevance to procurement (10 = direct procurement news, 1 = barely relevant)

STRICT EXCLUSION RULES - REJECT articles about:
❌ General military exercises or training operations
❌ Existing fleet maintenance or repairs  
❌ Historical articles or anniversaries
❌ Technical specifications without procurement context
❌ Other countries' purchases (unless directly comparing to ${countryName})
❌ Air shows, demonstrations, or exhibitions (unless procurement announcement)
❌ General defense budget news (unless specifically mentioning fighter procurement)
❌ Pilot training programs (unless tied to new aircraft acquisition)

ONLY INCLUDE articles that:
✅ Discuss ${countryName}'s procurement decision, tender, or competition
✅ Mention negotiations, offers, or bids for new fighters
✅ Announce purchase decisions or contracts
✅ Compare fighter options for ${countryName}'s acquisition
✅ Quote officials about fighter acquisition plans
✅ Report on parliamentary/government approval for fighter purchase

Minimum importance threshold: 5/10 (discard anything lower)

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
                        description: 'Relevance score 1-10: 10=breaking procurement news, 8-9=negotiations/bids, 6-7=comparison/analysis, 5=tangentially related, <5=not relevant (discard)'
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
    
    // Filter by relevance threshold and sort by importance
    structuredArticles = structuredArticles
      .filter((a: any) => {
        // Strict filtering: importance must be >= 6 for high relevance
        if (a.importance < 6) {
          console.log(`  Rejected low relevance (${a.importance}/10): "${a.title?.substring(0, 50)}"`);
          return false;
        }
        return true;
      })
      .sort((a: any, b: any) => (b.importance || 0) - (a.importance || 0))
      .slice(0, 40); // Max 40 highly relevant articles
    
    console.log(`Step 12: Filtered to top ${structuredArticles.length} highly relevant articles (importance >= 6/10)`);

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

        // If no source match, detect from URL domain with improved local detection
        if (!sourceId) {
          try {
            const urlObj = new URL(article.url);
            const hostname = urlObj.hostname.toLowerCase();
            
            // Enhanced local detection - check multiple patterns
            const isLocalDomain = 
              hostname.endsWith(domainSuffix) || // .pt, .es, etc.
              hostname.endsWith(`.${country.toLowerCase()}.`) || // subdomain pattern
              hostname.includes(`.${country.toLowerCase()}.`); // middle domain pattern
            
            // Additional manual checks for known local domains that might not follow TLD pattern
            const knownLocalDomains: Record<string, string[]> = {
              'PT': ['publico.pt', 'observador.pt', 'jornaldenegocios.pt', 'dn.pt', 'rtp.pt', 'sapo.pt'],
              'ES': ['elpais.com', 'elmundo.es', 'lavanguardia.com', 'abc.es'],
              'BR': ['globo.com', 'uol.com.br', 'folha.uol.com.br'],
              // Add more as needed
            };
            
            const localDomainsForCountry = knownLocalDomains[country] || [];
            const isKnownLocal = localDomainsForCountry.some(domain => hostname.includes(domain));
            
            if (isLocalDomain || isKnownLocal) {
              sourceCountry = country;
              console.log(`  ✓ Detected LOCAL domain: ${hostname} -> ${sourceCountry}${isKnownLocal ? ' (known local)' : ''}`);
            } else {
              // International domain (.com, .org, .net, .co.uk, etc.)
              sourceCountry = 'INTERNATIONAL';
              console.log(`  ✓ Detected INTERNATIONAL domain: ${hostname} -> INTERNATIONAL`);
            }
          } catch (urlError) {
            console.error('  ✗ Error parsing URL for country detection:', article.url, urlError);
            sourceCountry = 'INTERNATIONAL'; // Fallback to international
          }
        }

        // Try to extract or estimate publication date
        let publishedAt = new Date().toISOString();
        
        // Distribute articles evenly across the FULL baseline period
        const baselineStart = new Date(startDate);
        const baselineEnd = new Date(endDate);
        
        // Distribute across the entire date range instead of just last 60 days
        const distributionRange = baselineEnd.getTime() - baselineStart.getTime();
        const randomOffset = Math.random() * distributionRange;
        publishedAt = new Date(baselineStart.getTime() + randomOffset).toISOString();
        
        console.log(`  Published at: ${publishedAt.substring(0, 10)} (distributed across full ${daysDiff} day range)`);

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
      totalSaved: storedCount,
      trackingPeriod: `${startDate} to ${endDate}`,
      quotaExceeded,
      searchStats: { 
        total: allSearchQueries.length, 
        success: successCount, 
        failed: failCount 
      }
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
