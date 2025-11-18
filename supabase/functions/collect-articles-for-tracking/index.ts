import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { corsHeaders } from '../_shared/cors.ts';
import { batchPerplexitySearch } from '../_shared/perplexitySearch.ts';

// Simple URL normalization to avoid duplicates
function normalizeUrl(url: string): string {
  try {
    const cleaned = url
      .replace(/\?utm_[^&]+/g, '') // Remove UTM params
      .replace(/&utm_[^&]+/g, '')
      .replace(/\?fb[^&]+/g, '')   // Remove FB params
      .replace(/&fb[^&]+/g, '')
      .replace(/#.*$/, '')          // Remove anchors
      .replace(/\/$/, '');          // Remove trailing slash
    return cleaned;
  } catch {
    return url;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('========== collect-articles-for-tracking started ==========');
    
    // ============ AUTHENTICATION using JWT or service role key ============
    console.log('Step 1: Authenticating request...');
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      console.error('Step 1 FAILED: No Authorization header');
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let userId: string;
    let supabaseClient;
    
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      console.error('Step 1 FAILED: Missing Supabase config');
      throw new Error('Missing Supabase configuration');
    }

    // Check if using service role key or JWT
    const token = authHeader.replace('Bearer ', '');
    const isServiceRole = token === SERVICE_ROLE_KEY;
    
    // Read body ONCE at the start
    const body = await req.json();
    
    if (isServiceRole) {
      console.log('Authenticated as SERVICE ROLE');
      // For service role, user_id must be provided in request body
      userId = body.userId;
      
      if (!userId) {
        throw new Error('userId required when using service role authentication');
      }
      
      supabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    } else {
      console.log('Authenticated as USER (JWT)');
      // For JWT, verify the token and get user
      supabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
      
      if (authError || !user) {
        console.error('Step 1 FAILED: Invalid JWT token:', authError);
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      userId = user.id;
    }
    
    // Sanitize userId for logging
    const sanitizedUserId = userId.substring(0, 8) + '...';
    console.log('Step 1 SUCCESS: Authenticated user:', sanitizedUserId);

    // ============ REQUEST VALIDATION ============
    console.log('Step 2: Validating request body...');
    const { country, competitors, startDate, endDate, mode = 'full' } = body;
    
    console.log('Request params:', { country, competitors, startDate, endDate, mode });

    // Validate country code
    if (!country || typeof country !== 'string' || !/^[A-Z]{2}$/.test(country)) {
      console.error('Step 2 FAILED: Invalid country code');
      return new Response(JSON.stringify({ 
        error: 'Invalid country code. Must be 2-letter ISO code (e.g., PT, ES)' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate competitors
    if (!Array.isArray(competitors) || competitors.length === 0) {
      console.error('Step 2 FAILED: Invalid competitors array');
      return new Response(JSON.stringify({ 
        error: 'competitors must be a non-empty array' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate dates
    if (!startDate || !endDate) {
      console.error('Step 2 FAILED: Missing date parameters');
      return new Response(JSON.stringify({ 
        error: 'startDate and endDate are required (YYYY-MM-DD format)' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    const now = new Date();
    
    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      console.error('Step 2 FAILED: Invalid date format');
      return new Response(JSON.stringify({ 
        error: 'Invalid date format. Use YYYY-MM-DD' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (startDateObj > endDateObj) {
      console.error('Step 2 FAILED: Start date after end date');
      return new Response(JSON.stringify({ 
        error: 'startDate must be before endDate' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (endDateObj > now) {
      console.error('Step 2 FAILED: End date in future');
      return new Response(JSON.stringify({ 
        error: 'endDate cannot be in the future' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Enforce reasonable maximum date range (2 years)
    const daysDiff = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24));
    const MAX_DAYS = 730; // 2 years
    
    if (daysDiff > MAX_DAYS) {
      console.error(`Step 2 FAILED: Date range too large: ${daysDiff} days`);
      return new Response(JSON.stringify({ 
        error: `Date range too large. Maximum ${MAX_DAYS} days (2 years)` 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    console.log('Step 2 SUCCESS: Request validated:', { country, competitors, startDate, endDate });

    console.log('Step 3: Supabase client already created during auth');

    console.log('Step 4: Checking API keys...');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      console.error('Step 4 FAILED: LOVABLE_API_KEY not configured');
      throw new Error('LOVABLE_API_KEY not configured');
    }
    if (!PERPLEXITY_API_KEY) {
      console.error('Step 4 FAILED: PERPLEXITY_API_KEY not configured');
      throw new Error('PERPLEXITY_API_KEY must be configured');
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
    let recencyFilter: 'day' | 'week' | 'month' | 'year' = 'month';
    
    if (hasExistingCollection && lastCollectionDate) {
      const hoursSinceLastCollection = (Date.now() - lastCollectionDate.getTime()) / (1000 * 60 * 60);
      
      // If last collection was within the last 3 days, do incremental update
      if (hoursSinceLastCollection < 72) { // 3 days = 72 hours
        isIncrementalUpdate = true;
        
        if (hoursSinceLastCollection < 24) {
          recencyFilter = 'day';
        } else if (hoursSinceLastCollection < 48) {
          recencyFilter = 'week';
        } else {
          recencyFilter = 'week';
        }
        
        console.log(`✓ INCREMENTAL UPDATE MODE: Last collection was ${Math.round(hoursSinceLastCollection)} hours ago`);
        console.log(`  Using recency filter: ${recencyFilter}`);
      } else {
        console.log(`Last collection was ${Math.round(hoursSinceLastCollection / 24)} days ago - doing full collection`);
      }
    } else {
      console.log('No existing collection found - doing initial full collection');
    }

    console.log('Step 6: Fetching enabled media sources and user preferences...');
    
    // Fetch user's prioritized outlets
    const { data: userSettings } = await supabaseClient
      .from('user_settings')
      .select('prioritized_outlets')
      .eq('user_id', userId)
      .single();
    
    const prioritizedOutlets = (userSettings?.prioritized_outlets as any[]) || [];
    console.log(`User has ${prioritizedOutlets.length} prioritized outlets configured`);
    
    // Fetch all enabled sources for the country
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
    
    // Filter and prioritize sources based on user's prioritized outlets
    const activePrioritizedOutlets = prioritizedOutlets
      .filter((outlet: any) => outlet.active)
      .map((outlet: any) => outlet.name.toLowerCase());
    
    const prioritizedSources = sources?.filter(s => 
      activePrioritizedOutlets.includes(s.name.toLowerCase())
    ) || [];
    
    const otherSources = sources?.filter(s => 
      !activePrioritizedOutlets.includes(s.name.toLowerCase())
    ) || [];
    
    console.log(`  → ${prioritizedSources.length} prioritized sources (user preferences)`);
    console.log(`  → ${otherSources.length} other enabled sources`);
    
    // Extract domains - prioritize user's preferred outlets
    const prioritizedDomains = prioritizedSources.map(s => {
      try {
        const url = new URL(s.url);
        return url.hostname.replace('www.', '');
      } catch {
        return null;
      }
    }).filter(Boolean) as string[];
    
    const otherDomains = otherSources.slice(0, 10).map(s => {
      try {
        const url = new URL(s.url);
        return url.hostname.replace('www.', '');
      } catch {
        return null;
      }
    }).filter(Boolean) as string[];
    
    const allDomains = [...prioritizedDomains, ...otherDomains];
    
    console.log(`  → Using ${prioritizedDomains.length} prioritized domains + ${otherDomains.length} other domains`);
    if (prioritizedDomains.length > 0) {
      console.log(`  → Priority domains: ${prioritizedDomains.slice(0, 5).join(', ')}`);
    }

    // Multi-language search terms based on country
    const searchTermsByCountry: Record<string, { native: string[], english: string[], countryName: string }> = {
      PT: { 
        native: [
          'caças aviões combate',
          'Força Aérea F-16',
          'aquisição aviões militares',
          'defesa aeronáutica'
        ],
        english: [
          'fighter jets aircraft',
          'Air Force F-16',
          'military aircraft purchase',
          'defense aviation'
        ],
        countryName: 'Portugal'
      },
      ES: {
        native: [
          'caza aviación combate',
          'Ejército del Aire',
          'aviones militares'
        ],
        english: [
          'fighter aircraft',
          'Air Force jets'
        ],
        countryName: 'Spain'
      },
      CO: {
        native: [
          'caza aviación',
          'Fuerza Aérea'
        ],
        english: [
          'fighter jets',
          'Air Force'
        ],
        countryName: 'Colombia'
      },
      DEFAULT: { 
        native: [],
        english: ['fighter jets', 'military aircraft'],
        countryName: 'Unknown'
      }
    };

    const searchConfig = searchTermsByCountry[country] || searchTermsByCountry.DEFAULT;
    const countryName = searchConfig.countryName;
    
    console.log('Search config:', { country, countryName });

    // ============ BUILD PERPLEXITY SEARCH QUERIES ============
    const allSearchQueries: Array<{
      query: string;
      country?: string;
      domains?: string[];
      recencyFilter?: 'day' | 'week' | 'month' | 'year';
    }> = [];
    
    console.log(`Step 7: Building ${isIncrementalUpdate ? 'INCREMENTAL' : 'COMPREHENSIVE'} Perplexity search queries`);
    
    if (isIncrementalUpdate) {
      // INCREMENTAL: Recent breaking news - simple direct queries
      console.log(`INCREMENTAL: Focusing on ${recencyFilter} recency`);
      
      // Simple direct queries for each fighter with local domains
      for (const fighter of [...competitors, 'Gripen']) {
        // Native language search
        allSearchQueries.push({
          query: `${fighter} ${countryName}`,
          country: countryName,
          domains: prioritizedDomains.length > 0 ? prioritizedDomains : allDomains.slice(0, 15),
          recencyFilter
        });
      }
      
      // Broad procurement news
      allSearchQueries.push({
        query: `${searchConfig.native[0]} ${countryName}`,
        country: countryName,
        domains: prioritizedDomains.length > 0 ? prioritizedDomains : allDomains.slice(0, 15),
        recencyFilter
      });
      
    } else if (mode === 'recent') {
      // RECENT MODE: Deep dive search for last 3 months with maximum thoroughness
      console.log(`RECENT MODE: Deep dive search for breaking news and recent developments`);
      
      // Strategy: Exhaustive search with multiple date ranges and query variations
      // Focus on capturing every recent article with high relevance
      
      // PRIORITY 1: Breaking news (last 24-48 hours) - all fighters
      for (const fighter of [...competitors, 'Gripen']) {
        allSearchQueries.push({
          query: `${fighter} ${countryName} news`,
          country: countryName,
          domains: allDomains.slice(0, 25),
          recencyFilter: 'day'
        });
        
        allSearchQueries.push({
          query: `${fighter} ${countryName} procurement decision`,
          country: countryName,
          domains: allDomains.slice(0, 20),
          recencyFilter: 'day'
        });
      }
      
      // PRIORITY 2: Last week searches with native terms
      for (const nativeTerm of searchConfig.native.slice(0, 4)) {
        allSearchQueries.push({
          query: `${nativeTerm} ${countryName}`,
          country: countryName,
          domains: allDomains.slice(0, 20),
          recencyFilter: 'week'
        });
      }
      
      // PRIORITY 3: Last month comprehensive
      for (const fighter of [...competitors, 'Gripen']) {
        allSearchQueries.push({
          query: `${fighter} ${countryName} acquisition`,
          country: countryName,
          domains: allDomains.slice(0, 20),
          recencyFilter: 'month'
        });
      }
      
      // PRIORITY 4: English international coverage (last month)
      for (const englishTerm of searchConfig.english.slice(0, 3)) {
        allSearchQueries.push({
          query: `${englishTerm} ${countryName}`,
          country: countryName,
          recencyFilter: 'month'
        });
      }
      
      console.log(`RECENT MODE: Created ${allSearchQueries.length} deep dive queries for thorough recent coverage`);
    } else {
      // FULL MODE: Comprehensive historical coverage across ENTIRE tracking period
      console.log(`FULL MODE: Comprehensive search covering full tracking period ${startDate} to ${endDate}`);
      
      // Strategy: Multiple search queries across the full tracking period to ensure trend analysis
      // We need articles from the ENTIRE tracking period, not just recent ones
      
      // Calculate tracking period duration
      const trackingDays = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24));
      console.log(`Tracking period: ${trackingDays} days (${startDate} to ${endDate})`);
      
      // PRIORITY 1: Direct fighter + country searches across full tracking period
      // Use 'year' recency for comprehensive coverage - Perplexity will find historical articles
      for (const fighter of [...competitors, 'Gripen']) {
        // Comprehensive search - no time restriction to get full historical coverage
        allSearchQueries.push({
          query: `${fighter} ${countryName} news`,
          country: countryName,
          domains: allDomains.slice(0, 20),
          recencyFilter: 'year' // Captures last 12 months
        });
        
        // Add specific search for procurement/acquisition discussions
        allSearchQueries.push({
          query: `${fighter} ${countryName} procurement acquisition`,
          country: countryName,
          domains: allDomains.slice(0, 15),
          recencyFilter: 'year'
        });
      }
      
      // PRIORITY 2: Native language general procurement searches
      for (const nativeTerm of searchConfig.native.slice(0, 3)) {
        allSearchQueries.push({
          query: `${nativeTerm} ${countryName}`,
          country: countryName,
          domains: allDomains.slice(0, 20),
          recencyFilter: 'year'
        });
      }
      
      // PRIORITY 3: English searches for international coverage
      for (const englishTerm of searchConfig.english.slice(0, 2)) {
        allSearchQueries.push({
          query: `${englishTerm} ${countryName}`,
          country: countryName,
          recencyFilter: 'year'
        });
      }
      
      console.log(`FULL MODE: Created ${allSearchQueries.length} comprehensive search queries to ensure full historical coverage for trend analysis`);
    }
    
    console.log(`Step 7: Total of ${allSearchQueries.length} Perplexity searches prepared`);
    console.log('Sample queries:', allSearchQueries.slice(0, 3).map(q => q.query));

    // ============ EXECUTE SEARCHES ============
    console.log(`Starting ${allSearchQueries.length} Perplexity searches...`);
    console.log(`Executing ${allSearchQueries.length} Perplexity AI searches...`);
    
    const { results, successCount, failCount, rateLimitHit } = await batchPerplexitySearch(
      allSearchQueries,
      PERPLEXITY_API_KEY,
      1000 // 1 second delay between searches
    );

    console.log(`Found ${results.length} unique articles from Perplexity`);

    // Deduplicate by normalized URL
    const seenUrls = new Set<string>();
    const uniqueResults = results.filter(r => {
      const normalized = normalizeUrl(r.url);
      if (seenUrls.has(normalized)) {
        return false;
      }
      seenUrls.add(normalized);
      return true;
    });
    
    console.log(`Deduplicated to ${uniqueResults.length} unique articles`);

    // Pre-filter articles by fighter keywords
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

    // ============ AI ANALYSIS WITH TOOL CALLING ============
    console.log('Sending to AI for structured analysis...');
    
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [{
          role: 'system',
          content: `You are a defense procurement analyst. Your task is to identify articles relevant to fighter aircraft procurement decisions, including direct announcements, political debate, strategic analysis, and industry developments.`
        }, {
          role: 'user',
          content: `Analyze ${preFilteredResults.length} articles for ${countryName} fighter jet procurement context.

Fighters of interest: ${competitors.join(', ')}, Gripen
Collection mode: ${mode === 'recent' ? 'Recent developments (last 3 months)' : 'Full historical coverage'}

INCLUDE articles about:
✅ Official procurement announcements, tenders, or RFPs for ${countryName}
✅ Government officials or defense ministry discussing ${countryName}'s fighter acquisition
✅ Budget allocation, timeline discussions, or political debate about ${countryName}'s purchase
✅ Comparative analysis, expert opinions, or strategic assessments of ${countryName}'s options
✅ Contract negotiations, industrial cooperation proposals, or offset agreements
✅ Defense industry news directly related to ${countryName}'s procurement process
✅ Parliamentary or legislative discussions about fighter purchases

EXCLUDE articles about:
❌ Pure military exercises or operational updates (unless discussing procurement implications)
❌ Air shows, demonstrations, or technical specs not tied to ${countryName}'s procurement
❌ Historical retrospectives without procurement relevance
❌ Routine maintenance, repairs, or upgrades of existing fleet
❌ Other countries' procurement (unless comparing to ${countryName}'s options)
❌ General training or deployment news

IMPORTANCE SCORING (1-10):
10 = Contract signing, official purchase announcement
9 = Major procurement milestone, RFP release, finalist selection
8 = Official government comments on procurement, detailed evaluations
7 = Expert analysis, political debate, strategic assessments
6 = Industry response, offset proposals, related defense spending
5 = Informed commentary, procurement context discussions
4 = Tangential procurement mentions, related defense policy

Return articles scoring ≥4 (maximum 50 articles). Prioritize procurement relevance over publication date.

Articles to analyze:
${preFilteredResults.map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet}\n${r.url}`).join('\n\n')}`
        }],
        temperature: 0.2,
        max_tokens: 4000,
        tools: [{
          type: 'function',
          function: {
            name: 'return_relevant_articles',
            description: 'Returns articles relevant to fighter jet procurement',
            parameters: {
              type: 'object',
              properties: {
                articles: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      article_number: { type: 'number', description: 'Article number from the list (1-indexed)' },
                      fighter_tags: { 
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Which fighters are mentioned: Gripen, F-35, Rafale, F-16V, Eurofighter, F/A-50'
                      },
                      sentiment: { 
                        type: 'number',
                        description: 'Sentiment towards Gripen: -1 (very negative) to +1 (very positive)'
                      },
                      importance: {
                        type: 'number',
                        description: 'Importance score 1-10: 10=direct procurement news, 5=related analysis, 1=tangential'
                      }
                    },
                    required: ['article_number', 'fighter_tags', 'sentiment', 'importance']
                  }
                }
              },
              required: ['articles']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'return_relevant_articles' } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error(`AI gateway error: ${aiResponse.status} - ${errorText}`);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ 
          error: 'AI gateway rate limit exceeded. Please try again later.' 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ 
          error: 'AI gateway payment required. Please add credits to your workspace.' 
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error('AI did not return structured data');
    }

    const analysisResult = JSON.parse(toolCall.function.arguments);
    console.log(`AI identified ${analysisResult.articles?.length || 0} relevant articles`);

    // Filter by minimum importance and sort
    const MIN_IMPORTANCE = 4; // Lowered from 6 to capture more relevant articles
    const importantArticles = (analysisResult.articles || [])
      .filter((a: any) => a.importance >= MIN_IMPORTANCE)
      .sort((a: any, b: any) => b.importance - a.importance);

    console.log(`${importantArticles.length} articles meet importance threshold (>= ${MIN_IMPORTANCE})`);

    if (importantArticles.length === 0) {
      console.warn('No articles met importance threshold - this is unusual if searches found results');
      return new Response(JSON.stringify({ 
        success: true,
        articlesFound: uniqueResults.length,
        articlesAnalyzed: preFilteredResults.length,
        articlesStored: 0,
        message: `Found ${uniqueResults.length} articles but none were relevant enough to procurement decisions (importance < ${MIN_IMPORTANCE}). Try adjusting date range or competitors.`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============ PREPARE ARTICLES FOR DATABASE ============
    const articlesToStore = importantArticles.map((article: any) => {
      const originalArticle = preFilteredResults[article.article_number - 1];
      if (!originalArticle) {
        console.warn(`Article ${article.article_number} not found in results`);
        return null;
      }

      // Infer source_country from URL domain
      let sourceCountry = null;
      let sourceName = null;
      try {
        const url = new URL(originalArticle.url);
        const hostname = url.hostname.replace('www.', '');
        
        // Check if matches any configured source
        const matchedSource = sources?.find(s => {
          try {
            const sourceHostname = new URL(s.url).hostname.replace('www.', '');
            return hostname.includes(sourceHostname) || sourceHostname.includes(hostname);
          } catch {
            return false;
          }
        });
        
        if (matchedSource) {
          sourceCountry = matchedSource.country;
          sourceName = matchedSource.name;
          console.log(`  → Matched source: ${sourceName} (${sourceCountry})`);
        } else {
          // Try to infer country from domain TLD
          const tldMatch = hostname.match(/\.([a-z]{2})$/);
          if (tldMatch) {
            sourceCountry = tldMatch[1].toUpperCase();
          }
        }
      } catch {
        // Invalid URL, leave sourceCountry null
      }

      return {
        user_id: userId,
        tracking_country: country,
        source_country: sourceCountry,
        url: normalizeUrl(originalArticle.url),
        title_pt: originalArticle.title, // Store original title (often in Portuguese for PT sources)
        title_en: originalArticle.title, // Store same as English for now - will be translated later if needed
        summary_en: originalArticle.snippet,
        fighter_tags: article.fighter_tags || [],
        sentiment: article.sentiment || 0,
        published_at: originalArticle.publishedDate || new Date(
          startDateObj.getTime() + Math.random() * (endDateObj.getTime() - startDateObj.getTime())
        ).toISOString(),
        fetched_at: new Date().toISOString()
      };
    }).filter(Boolean);

    console.log(`Prepared ${articlesToStore.length} articles for storage`);

    // ============ TRANSLATE TITLES TO ENGLISH ============
    if (articlesToStore.length > 0) {
      console.log('Translating article titles to English...');
      
      try {
        const titlesToTranslate = articlesToStore.map((a: any) => a.title_pt).join('\n---\n');
        
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
                content: 'You are a professional translator. Translate article titles from any language to English. Preserve proper nouns, fighter aircraft names (F-35, Rafale, Gripen, Eurofighter, etc.), and technical terms. Return ONLY the English translations, one per line, in the same order, separated by newlines. If a title is already in English, return it unchanged.'
              },
              {
                role: 'user',
                content: `Translate these article titles to English:\n\n${titlesToTranslate}`
              }
            ]
          })
        });

        if (translationResponse.ok) {
          const translationData = await translationResponse.json();
          const translations = translationData.choices[0].message.content.split('\n').filter((t: string) => t.trim());
          
          // Update articles with translations
          articlesToStore.forEach((article: any, index: number) => {
            if (translations[index]) {
              article.title_en = translations[index].trim();
            }
          });
          
          console.log(`✓ Translated ${translations.length} titles to English`);
        } else {
          console.warn('Translation failed, using original titles');
        }
      } catch (translationError) {
        console.warn('Translation error:', translationError);
        // Continue without translations
      }
    }

    // ============ STORE IN DATABASE ============
    if (articlesToStore.length > 0) {
      console.log('Inserting articles into database...');
      
      const { error: insertError } = await supabaseClient
        .from('items')
        .upsert(articlesToStore, {
          onConflict: 'url',
          ignoreDuplicates: false
        });

      if (insertError) {
        console.error('Error storing articles:', insertError);
        throw insertError;
      }

      console.log(`✓ Successfully stored ${articlesToStore.length} articles`);
    }

    // ============ RETURN SUCCESS ============
    return new Response(JSON.stringify({ 
      success: true,
      articlesFound: uniqueResults.length,
      articlesAnalyzed: preFilteredResults.length,
      articlesStored: articlesToStore.length,
      searchStats: { 
        total: allSearchQueries.length,
        success: successCount,
        failed: failCount,
        rateLimitHit
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
