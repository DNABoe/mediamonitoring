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
    console.log('Social media collection started');
    
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const googleApiKey = Deno.env.get('GOOGLE_SEARCH_API_KEY');
    const googleSearchEngineId = Deno.env.get('GOOGLE_SEARCH_ENGINE_ID');
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userId = user.id;
    
    const body = await req.json();
    const { country, competitors, startDate, endDate } = body;
    
    // Validate input parameters
    if (!country || typeof country !== 'string' || !/^[A-Z]{2}$/.test(country)) {
      return new Response(JSON.stringify({ 
        error: 'Invalid country code. Must be 2-letter uppercase code'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    if (!Array.isArray(competitors) || competitors.length === 0 || competitors.length > 10) {
      return new Response(JSON.stringify({ 
        error: 'Invalid competitors. Must be array with 1-10 items'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    for (const competitor of competitors) {
      if (typeof competitor !== 'string' || competitor.length > 50) {
        return new Response(JSON.stringify({ 
          error: 'Invalid competitor name. Must be string, max 50 characters'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    if (!googleApiKey || !googleSearchEngineId) {
      throw new Error('Google Search API credentials not configured');
    }

    console.log('Checking for existing social media posts to enable smart incremental updates...');
    
    // Check if we already have posts collected
    const { data: existingPosts, error: existingError } = await supabaseClient
      .from('social_media_posts')
      .select('fetched_at')
      .eq('user_id', userId)
      .eq('tracking_country', country)
      .order('fetched_at', { ascending: false })
      .limit(1);
    
    const hasExistingCollection = existingPosts && existingPosts.length > 0;
    const lastCollectionDate = hasExistingCollection ? new Date(existingPosts[0].fetched_at) : null;
    
    let isIncrementalUpdate = false;
    let incrementalDays = 3; // Social media: search last 3 days for incremental
    
    if (hasExistingCollection && lastCollectionDate) {
      const hoursSinceLastCollection = (Date.now() - lastCollectionDate.getTime()) / (1000 * 60 * 60);
      
      // If last collection was within the last 3 days, do incremental update (reduced from 7 days)
      if (hoursSinceLastCollection < 72) { // 3 days = 72 hours
        isIncrementalUpdate = true;
        // Focus on 1-2 days for very recent posts
        incrementalDays = Math.max(1, Math.min(2, Math.ceil(hoursSinceLastCollection / 24)));
        console.log(`✓ INCREMENTAL UPDATE MODE: Last collection was ${Math.round(hoursSinceLastCollection)} hours ago`);
        console.log(`  Will PRIORITIZE newest posts (last ${incrementalDays} days) with multiple time ranges`);
        console.log(`  Strategy: Multi-pass approach to catch all breaking discussions`);
      } else {
        console.log(`Last collection was ${Math.round(hoursSinceLastCollection / 24)} days ago - doing full collection`);
      }
    } else {
      console.log('No existing collection found - doing initial full collection');
    }

    let totalCollected = 0;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    // Map country code to language for local search
    const countryLanguageMap: Record<string, string> = {
      'PT': 'Portuguese',
      'ES': 'Spanish',
      'FR': 'French',
      'DE': 'German',
      'IT': 'Italian',
      'PL': 'Polish',
      'SE': 'Swedish',
      'FI': 'Finnish',
      'NO': 'Norwegian'
    };
    const localLanguage = countryLanguageMap[country] || 'English';

    // Calculate date range in days
    const startDateObj = new Date(startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000));
    const endDateObj = new Date(endDate || new Date());
    const daysDiff = Math.floor((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24));

    console.log(`Collecting social media for ${daysDiff} days period (${isIncrementalUpdate ? 'INCREMENTAL' : 'FULL'} mode)`);

    // Comprehensive search queries - reduced for incremental mode
    const searchQueries: Array<{platform: string, query: string, dateRange: string}> = [];

    // Collect social media posts with smart incremental strategy
    for (const fighter of [...competitors, 'Gripen']) {
      console.log(`Building queries for ${fighter} (${isIncrementalUpdate ? 'incremental' : 'full'} mode)`);
      
      if (isIncrementalUpdate) {
        // ============ INCREMENTAL MODE: AGGRESSIVE multi-pass for newest posts ============
        console.log(`  INCREMENTAL: Multi-pass strategy for ${fighter}`);
        
        // PASS 1: Last 24 hours - CRITICAL for breaking discussions (all platforms)
        searchQueries.push({
          platform: 'reddit',
          query: `${fighter} ${country} site:reddit.com`,
          dateRange: 'd1'
        });
        searchQueries.push({
          platform: 'x',
          query: `${fighter} ${country} site:x.com OR site:twitter.com`,
          dateRange: 'd1'
        });
        searchQueries.push({
          platform: 'facebook',
          query: `${fighter} ${localLanguage} site:facebook.com`,
          dateRange: 'd1'
        });
        searchQueries.push({
          platform: 'linkedin',
          query: `${fighter} site:linkedin.com`,
          dateRange: 'd1'
        });
        
        // PASS 2: Last 2 days - broader recent coverage
        const recentRange = `d${incrementalDays}`;
        
        searchQueries.push({
          platform: 'reddit',
          query: `${fighter} military site:reddit.com`,
          dateRange: recentRange
        });
        searchQueries.push({
          platform: 'x',
          query: `${fighter} defense site:x.com OR site:twitter.com`,
          dateRange: recentRange
        });
        searchQueries.push({
          platform: 'facebook',
          query: `${fighter} ${country} site:facebook.com`,
          dateRange: recentRange
        });
        searchQueries.push({
          platform: 'linkedin',
          query: `${fighter} aerospace site:linkedin.com`,
          dateRange: recentRange
        });
        
      } else {
        // ============ FULL MODE: Comprehensive coverage ============
      
        // REDDIT - Multiple search strategies
        // Recent discussions (last 7 days) - MOST IMPORTANT for temperature
        searchQueries.push({
          platform: 'reddit',
          query: `${fighter} ${country} fighter jet site:reddit.com`,
          dateRange: 'd7'
        });
        
        // Recent broader search
        searchQueries.push({
          platform: 'reddit',
          query: `${fighter} military aviation site:reddit.com`,
          dateRange: 'd30'
        });
        
        // Specific subreddits if country-specific
        searchQueries.push({
          platform: 'reddit',
          query: `${fighter} site:reddit.com/r/${country.toLowerCase()}`,
          dateRange: 'd30'
        });
        
        // X (TWITTER) - Multiple angles
        // Very recent (last 3 days for real-time temperature)
        searchQueries.push({
          platform: 'x',
          query: `${fighter} ${country} site:x.com OR site:twitter.com`,
          dateRange: 'd3'
        });
        
        searchQueries.push({
          platform: 'x',
          query: `${fighter} procurement ${localLanguage} site:x.com OR site:twitter.com`,
          dateRange: 'd7'
        });
        
        searchQueries.push({
          platform: 'x',
          query: `${fighter} military site:x.com OR site:twitter.com`,
          dateRange: 'd30'
        });

        // FACEBOOK - Local language focus
        searchQueries.push({
          platform: 'facebook',
          query: `${fighter} ${country} ${localLanguage} site:facebook.com`,
          dateRange: 'd7'
        });
        
        searchQueries.push({
          platform: 'facebook',
          query: `${fighter} defense ${localLanguage} site:facebook.com`,
          dateRange: 'd30'
        });

        // LINKEDIN - Professional discourse
        searchQueries.push({
          platform: 'linkedin',
          query: `${fighter} ${country} aerospace site:linkedin.com`,
          dateRange: 'd7'
        });
        
        searchQueries.push({
          platform: 'linkedin',
          query: `${fighter} procurement site:linkedin.com`,
          dateRange: 'd30'
        });
      }
    }

    const totalQueries = searchQueries.length;
    console.log(`Executing ${totalQueries} social media searches (${isIncrementalUpdate ? 'INCREMENTAL - saves API quota!' : 'FULL collection'})...`);
    
    // Execute all searches with rate limiting
    for (let i = 0; i < totalQueries; i++) {
      const search = searchQueries[i];
      
      try {
        const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${googleSearchEngineId}&q=${encodeURIComponent(search.query)}&num=10&dateRestrict=${search.dateRange}&sort=date`;
        
        console.log(`[${i + 1}/${totalQueries}] ${search.platform}: ${search.query.substring(0, 60)}...`);
        
        const response = await fetch(searchUrl);
        const data = await response.json();

        if (data.items) {
          console.log(`  ✓ Found ${data.items.length} posts`);
          for (const item of data.items) {
            await processSocialPost(item, search.platform, userId, country, competitors, supabaseClient, LOVABLE_API_KEY);
            totalCollected++;
          }
        } else {
          console.log(`  No results`);
        }
        
        // Rate limiting
        if (i < totalQueries - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      } catch (error) {
        console.error(`Error searching ${search.platform}:`, error);
      }
    }

    console.log(`Social media collection complete: ${totalCollected} posts collected`);

    return new Response(
      JSON.stringify({ 
        success: true,
        postsCollected: totalCollected
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in collect-social-media:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Enhanced helper function to process social media posts with deep analysis
async function processSocialPost(
  item: any, 
  platform: string, 
  userId: string, 
  country: string, 
  competitors: string[], 
  supabaseClient: any,
  lovableApiKey: string | undefined
) {
  try {
    const postId = item.link.split('/').pop() || item.link;
    const content = item.snippet || item.title;
    
    // Deep sentiment analysis using Lovable AI with enhanced prompt
    let sentiment = 0;
    let tags: string[] = [];
    
    if (lovableApiKey) {
      try {
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [{
              role: 'user',
              content: `Analyze this social media post about fighter jet procurement for ${country}.

We are tracking these fighters: ${[...competitors, 'Gripen'].join(', ')}

Post: "${content}"

STRICT REQUIREMENTS - Only analyze if post discusses FIGHTER JET PROCUREMENT for ${country}:
✅ INCLUDE if post discusses:
- ${country}'s fighter procurement/acquisition decision
- Comparisons between: ${[...competitors, 'Gripen'].join(', ')} for ${country}
- Opinions/debates about which fighter ${country} should choose
- News/rumors about ${country}'s fighter deals or negotiations
- Political/economic factors affecting ${country}'s fighter choice

❌ REJECT if post is about:
- General military news unrelated to ${country}'s procurement
- Technical specs without procurement context for ${country}
- Historical content or anniversaries
- Other countries' purchases (unless directly comparing to ${country})
- Military exercises or operations unrelated to procurement

CRITICAL: Tag ALL fighters mentioned from our tracking list: ${[...competitors, 'Gripen'].join(', ')}

If NOT relevant to ${country}'s fighter procurement, return:
{ "sentiment": 0, "fighter_tags": [], "temperature": "cool", "relevance": 0, "procurement_related": false }

If relevant, provide:
1. Sentiment (-1.0 to 1.0): Overall tone about the procurement situation
2. fighter_tags: Array of ALL fighters mentioned from: ${[...competitors, 'Gripen'].join(', ')}
3. temperature: "hot" (passionate debate), "warm" (active discussion), "cool" (calm)
4. relevance (1-10): How relevant to ${country}'s procurement decision
5. sentiment_by_fighter: Object with sentiment for each fighter mentioned (optional)

Return JSON: {
  "sentiment": number,
  "fighter_tags": string[],
  "temperature": "hot" | "warm" | "cool",
  "relevance": number,
  "procurement_related": boolean,
  "sentiment_by_fighter": { "fighter_name": number }
}`
            }],
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const responseText = aiData.choices?.[0]?.message?.content || '';
          
          try {
            const parsed = JSON.parse(responseText);
            
            // Check relevance - skip if not procurement-related
            if (parsed.procurement_related === false || (parsed.relevance && parsed.relevance < 5)) {
              console.log(`  Skipped irrelevant post (relevance: ${parsed.relevance})`);
              return; // Don't store irrelevant posts
            }
            
            sentiment = parsed.sentiment || 0;
            tags = parsed.fighter_tags || [];
            
            console.log(`  AI Analysis: sentiment=${sentiment}, temp=${parsed.temperature}, relevance=${parsed.relevance}`);
          } catch {
            // Fallback: extract from text response
            const sentimentMatch = responseText.match(/sentiment["\s:]+(-?\d+\.?\d*)/i);
            if (sentimentMatch) sentiment = parseFloat(sentimentMatch[1]);
            
            // Check if AI indicated irrelevance in text
            if (responseText.toLowerCase().includes('not relevant') || 
                responseText.toLowerCase().includes('irrelevant')) {
              console.log(`  Skipped: AI marked as irrelevant`);
              return;
            }
            
            for (const fighter of [...competitors, 'Gripen']) {
              if (content.toLowerCase().includes(fighter.toLowerCase())) {
                tags.push(fighter);
              }
            }
          }
        }
      } catch (error) {
        console.error('AI analysis failed:', error);
      }
    }
    
    // Additional relevance check - skip if no fighter tags detected
    if (tags.length === 0) {
      // Try basic keyword matching as final check
      for (const fighter of [...competitors, 'Gripen']) {
        if (content.toLowerCase().includes(fighter.toLowerCase())) {
          tags.push(fighter);
        }
      }
      
      // Still no tags? Post is likely irrelevant
      if (tags.length === 0) {
        console.log(`  Skipped: No fighter tags detected`);
        return;
      }
    }

    // Extract author info if available
    let authorName = item.displayLink;
    let authorUsername = null;
    
    // Try to extract username from URL for different platforms
    if (platform === 'x' && item.link.includes('/status/')) {
      const urlParts = item.link.split('/');
      const statusIndex = urlParts.indexOf('status');
      if (statusIndex > 0) {
        authorUsername = urlParts[statusIndex - 1];
      }
    } else if (platform === 'reddit') {
      if (item.link.includes('/u/')) {
        const match = item.link.match(/\/u\/([^\/]+)/);
        if (match) authorUsername = match[1];
      } else if (item.link.includes('/user/')) {
        const match = item.link.match(/\/user\/([^\/]+)/);
        if (match) authorUsername = match[1];
      }
    }

    // Try to extract published date from metadata
    let publishedAt = new Date().toISOString();
    if (item.pagemap?.metatags?.[0]?.['article:published_time']) {
      publishedAt = new Date(item.pagemap.metatags[0]['article:published_time']).toISOString();
    }

    // Insert social media post with upsert to avoid duplicates
    const { error: insertError } = await supabaseClient
      .from('social_media_posts')
      .upsert({
        user_id: userId,
        tracking_country: country,
        platform: platform,
        post_id: postId,
        post_url: item.link,
        author_name: authorName,
        author_username: authorUsername,
        content: content,
        published_at: publishedAt,
        fighter_tags: tags,
        sentiment: sentiment,
        engagement: { source: 'google_search', search_date: new Date().toISOString() }
      }, {
        onConflict: 'post_url'
      });

    if (insertError) {
      console.error(`  ✗ Error storing post:`, insertError);
    } else {
      console.log(`  ✓ Stored ${platform} post (sentiment: ${sentiment.toFixed(2)})`);
    }
  } catch (error) {
    console.error(`Error processing ${platform} post:`, error);
  }
}
