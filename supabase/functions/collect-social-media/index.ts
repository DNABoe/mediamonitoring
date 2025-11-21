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
    const sanitizedUserId = userId.substring(0, 8) + '...';
    console.log('Authenticated user:', sanitizedUserId);
    
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

    console.log('Checking for existing social media posts to determine collection strategy...');
    
    // Check if we already have posts collected
    const { data: existingPosts, error: existingError } = await supabaseClient
      .from('social_media_posts')
      .select('fetched_at, published_at')
      .eq('user_id', userId)
      .eq('tracking_country', country)
      .order('fetched_at', { ascending: false })
      .limit(1);
    
    const hasExistingCollection = existingPosts && existingPosts.length > 0;
    const lastCollectionDate = hasExistingCollection ? new Date(existingPosts[0].fetched_at) : null;
    
    // Always do comprehensive collection to maintain 6-month coverage
    // Only use focused incremental if collection was very recent (< 6 hours)
    let isIncrementalUpdate = false;
    let incrementalDays = 2;
    
    if (hasExistingCollection && lastCollectionDate) {
      const hoursSinceLastCollection = (Date.now() - lastCollectionDate.getTime()) / (1000 * 60 * 60);
      
      // Only use incremental mode if last collection was within 6 hours (reduced from 72 hours/3 days)
      // This ensures we maintain comprehensive 6-month coverage most of the time
      if (hoursSinceLastCollection < 6) {
        isIncrementalUpdate = true;
        incrementalDays = 2; // Focus on last 2 days for very recent updates
        console.log(`✓ INCREMENTAL UPDATE MODE: Last collection was ${Math.round(hoursSinceLastCollection)} hours ago`);
        console.log(`  Will focus on last ${incrementalDays} days of breaking posts`);
      } else {
        console.log(`Last collection was ${Math.round(hoursSinceLastCollection)} hours ago (${Math.round(hoursSinceLastCollection / 24)} days)`);
        console.log('Performing COMPREHENSIVE collection to maintain 6-month coverage');
      }
    } else {
      console.log('No existing collection found - performing INITIAL COMPREHENSIVE collection');
    }

    let totalCollected = 0;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    // Map country code to language and country name for local search
    const countryLanguageMap: Record<string, { language: string; name: string }> = {
      'AR': { language: 'Spanish', name: 'Argentina' },
      'AT': { language: 'German', name: 'Austria' },
      'AU': { language: 'English', name: 'Australia' },
      'BE': { language: 'Dutch', name: 'Belgium' },
      'BR': { language: 'Portuguese', name: 'Brazil' },
      'BG': { language: 'Bulgarian', name: 'Bulgaria' },
      'CA': { language: 'English', name: 'Canada' },
      'CL': { language: 'Spanish', name: 'Chile' },
      'CN': { language: 'Chinese', name: 'China' },
      'CO': { language: 'Spanish', name: 'Colombia' },
      'HR': { language: 'Croatian', name: 'Croatia' },
      'CZ': { language: 'Czech', name: 'Czech Republic' },
      'DK': { language: 'Danish', name: 'Denmark' },
      'EG': { language: 'Arabic', name: 'Egypt' },
      'FI': { language: 'Finnish', name: 'Finland' },
      'FR': { language: 'French', name: 'France' },
      'DE': { language: 'German', name: 'Germany' },
      'GR': { language: 'Greek', name: 'Greece' },
      'HU': { language: 'Hungarian', name: 'Hungary' },
      'IN': { language: 'English', name: 'India' },
      'ID': { language: 'Indonesian', name: 'Indonesia' },
      'IL': { language: 'Hebrew', name: 'Israel' },
      'IT': { language: 'Italian', name: 'Italy' },
      'JP': { language: 'Japanese', name: 'Japan' },
      'MY': { language: 'Malay', name: 'Malaysia' },
      'MX': { language: 'Spanish', name: 'Mexico' },
      'NL': { language: 'Dutch', name: 'Netherlands' },
      'NZ': { language: 'English', name: 'New Zealand' },
      'NO': { language: 'Norwegian', name: 'Norway' },
      'PK': { language: 'English', name: 'Pakistan' },
      'PE': { language: 'Spanish', name: 'Peru' },
      'PH': { language: 'English', name: 'Philippines' },
      'PL': { language: 'Polish', name: 'Poland' },
      'PT': { language: 'Portuguese', name: 'Portugal' },
      'RO': { language: 'Romanian', name: 'Romania' },
      'SA': { language: 'Arabic', name: 'Saudi Arabia' },
      'SG': { language: 'English', name: 'Singapore' },
      'SK': { language: 'Slovak', name: 'Slovakia' },
      'ZA': { language: 'English', name: 'South Africa' },
      'KR': { language: 'Korean', name: 'South Korea' },
      'ES': { language: 'Spanish', name: 'Spain' },
      'SE': { language: 'Swedish', name: 'Sweden' },
      'CH': { language: 'German', name: 'Switzerland' },
      'TW': { language: 'Chinese', name: 'Taiwan' },
      'TH': { language: 'Thai', name: 'Thailand' },
      'TR': { language: 'Turkish', name: 'Turkey' },
      'UA': { language: 'Ukrainian', name: 'Ukraine' },
      'AE': { language: 'Arabic', name: 'UAE' },
      'GB': { language: 'English', name: 'United Kingdom' },
      'US': { language: 'English', name: 'United States' },
      'VN': { language: 'Vietnamese', name: 'Vietnam' }
    };
    const localLanguage = countryLanguageMap[country]?.language || 'English';
    const countryName = countryLanguageMap[country]?.name || country;

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
          query: `${fighter} ${countryName} procurement site:reddit.com`,
          dateRange: 'd1'
        });
        searchQueries.push({
          platform: 'x',
          query: `${fighter} ${countryName} site:x.com OR site:twitter.com`,
          dateRange: 'd1'
        });
        searchQueries.push({
          platform: 'facebook',
          query: `${fighter} ${countryName} ${localLanguage} site:facebook.com`,
          dateRange: 'd1'
        });
        searchQueries.push({
          platform: 'linkedin',
          query: `${fighter} site:linkedin.com`,
          dateRange: 'd1'
        });
        
        // PASS 2: Last 2-3 days - broader recent coverage with multiple query variations
        const recentRange = `d${incrementalDays}`;
        
        searchQueries.push({
          platform: 'reddit',
          query: `${fighter} ${countryName} defense site:reddit.com`,
          dateRange: recentRange
        });
        searchQueries.push({
          platform: 'x',
          query: `${fighter} ${countryName} contract site:x.com OR site:twitter.com`,
          dateRange: recentRange
        });
        searchQueries.push({
          platform: 'facebook',
          query: `${fighter} ${countryName} ${localLanguage} site:facebook.com`,
          dateRange: recentRange
        });
        searchQueries.push({
          platform: 'linkedin',
          query: `${fighter} ${countryName} site:linkedin.com`,
          dateRange: recentRange
        });
        
      } else {
        // ============ FULL MODE: Comprehensive 6-month+ coverage ============
        console.log(`  FULL MODE: Building comprehensive 6-month queries for ${fighter}`);
      
        // REDDIT - Comprehensive multi-timeframe coverage
        // Breaking news (last 7 days) - CRITICAL for temperature
        searchQueries.push({
          platform: 'reddit',
          query: `${fighter} ${country} fighter jet site:reddit.com`,
          dateRange: 'd7'
        });
        searchQueries.push({
          platform: 'reddit',
          query: `${fighter} ${country} procurement site:reddit.com`,
          dateRange: 'd7'
        });
        
        // Recent month - sustaining discussions
        searchQueries.push({
          platform: 'reddit',
          query: `${fighter} ${countryName} site:reddit.com`,
          dateRange: 'd30'
        });
        searchQueries.push({
          platform: 'reddit',
          query: `${fighter} military aviation site:reddit.com`,
          dateRange: 'd30'
        });
        
        // 3-month coverage - medium-term context
        searchQueries.push({
          platform: 'reddit',
          query: `${fighter} ${country} defense site:reddit.com`,
          dateRange: 'd90'
        });
        searchQueries.push({
          platform: 'reddit',
          query: `${fighter} purchase contract site:reddit.com`,
          dateRange: 'd90'
        });
        
        // 6-month coverage - full tracking period
        searchQueries.push({
          platform: 'reddit',
          query: `${fighter} ${country} site:reddit.com`,
          dateRange: 'd180'
        });
        searchQueries.push({
          platform: 'reddit',
          query: `${fighter} site:reddit.com/r/${country.toLowerCase()}`,
          dateRange: 'd180'
        });
        searchQueries.push({
          platform: 'reddit',
          query: `${fighter} defense site:reddit.com/r/defense`,
          dateRange: 'd180'
        });
        
        // X (TWITTER) - Comprehensive multi-timeframe coverage
        // Breaking (last 3 days)
        searchQueries.push({
          platform: 'x',
          query: `${fighter} ${country} site:x.com OR site:twitter.com`,
          dateRange: 'd3'
        });
        searchQueries.push({
          platform: 'x',
          query: `${fighter} ${country} contract site:x.com OR site:twitter.com`,
          dateRange: 'd3'
        });
        
        // Recent week
        searchQueries.push({
          platform: 'x',
          query: `${fighter} procurement ${localLanguage} site:x.com OR site:twitter.com`,
          dateRange: 'd7'
        });
        searchQueries.push({
          platform: 'x',
          query: `${fighter} ${country} deal site:x.com OR site:twitter.com`,
          dateRange: 'd7'
        });
        
        // Recent month
        searchQueries.push({
          platform: 'x',
          query: `${fighter} military site:x.com OR site:twitter.com`,
          dateRange: 'd30'
        });
        searchQueries.push({
          platform: 'x',
          query: `${fighter} ${countryName} defense site:x.com OR site:twitter.com`,
          dateRange: 'd30'
        });
        
        // 3-month coverage
        searchQueries.push({
          platform: 'x',
          query: `${fighter} ${country} site:x.com OR site:twitter.com`,
          dateRange: 'd90'
        });
        
        // 6-month coverage
        searchQueries.push({
          platform: 'x',
          query: `${fighter} ${countryName} site:x.com OR site:twitter.com`,
          dateRange: 'd180'
        });

        // FACEBOOK - Local language focus with more queries
        searchQueries.push({
          platform: 'facebook',
          query: `${fighter} ${country} ${localLanguage} site:facebook.com`,
          dateRange: 'd7'
        });
        searchQueries.push({
          platform: 'facebook',
          query: `${fighter} procurement ${localLanguage} site:facebook.com`,
          dateRange: 'd7'
        });
        
        searchQueries.push({
          platform: 'facebook',
          query: `${fighter} defense ${localLanguage} site:facebook.com`,
          dateRange: 'd30'
        });
        searchQueries.push({
          platform: 'facebook',
          query: `${fighter} contract ${localLanguage} site:facebook.com`,
          dateRange: 'd30'
        });
        
        // Extended 2-month coverage for Facebook
        searchQueries.push({
          platform: 'facebook',
          query: `${fighter} ${country} site:facebook.com`,
          dateRange: 'd60'
        });

        // LINKEDIN - Professional discourse with comprehensive timeline
        // Recent week
        searchQueries.push({
          platform: 'linkedin',
          query: `${fighter} ${country} aerospace site:linkedin.com`,
          dateRange: 'd7'
        });
        searchQueries.push({
          platform: 'linkedin',
          query: `${fighter} ${country} defense site:linkedin.com`,
          dateRange: 'd7'
        });
        
        // Recent month
        searchQueries.push({
          platform: 'linkedin',
          query: `${fighter} procurement site:linkedin.com`,
          dateRange: 'd30'
        });
        searchQueries.push({
          platform: 'linkedin',
          query: `${fighter} ${countryName} contract site:linkedin.com`,
          dateRange: 'd30'
        });
        
        // 3-month coverage
        searchQueries.push({
          platform: 'linkedin',
          query: `${fighter} ${country} site:linkedin.com`,
          dateRange: 'd90'
        });
        
        // 6-month coverage
        searchQueries.push({
          platform: 'linkedin',
          query: `${fighter} site:linkedin.com`,
          dateRange: 'd180'
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
            await processSocialPost(item, search.platform, userId, country, competitors, supabaseClient, LOVABLE_API_KEY, localLanguage, countryName);
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
  lovableApiKey: string | undefined,
  countryLanguage: string,
  countryName: string
) {
  try {
    const postId = item.link.split('/').pop() || item.link;
    let content = item.snippet || item.title;
    
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
              content: `Analyze this social media post about fighter jet procurement for ${countryName} (${country}).

We are tracking these fighters: ${[...competitors, 'Gripen'].join(', ')}

Post: "${content}"

CRITICAL FILTERING - Only include posts that are DIRECTLY about ${countryName}'s fighter procurement:

✅ INCLUDE ONLY if post discusses:
- ${countryName} actively considering/negotiating purchase of: ${[...competitors, 'Gripen'].join(', ')}
- Direct comparisons between fighters specifically for ${countryName}'s procurement
- Political/economic debates about which fighter ${countryName} should buy
- Official announcements or credible rumors about ${countryName}'s fighter acquisition
- ${countryName}'s defense budget/strategy related to fighter replacement

❌ REJECT if post is about:
- General fighter specs or capabilities (without ${countryName} procurement context)
- Other countries purchasing these fighters (unless comparing to ${countryName})
- Military exercises, airshows, or demonstrations (not procurement)
- Historical content or past purchases
- Technical discussions without procurement decision context
- Generic defense industry news
- Any post that doesn't mention ${countryName} or its procurement

LANGUAGE & TRANSLATION:
- Post language appears to be: ${countryLanguage}
- If the post is NOT in ${countryLanguage}, provide an English translation in the response

RELEVANCE SCORING (be STRICT):
- 9-10: Official procurement announcement or major decision for ${countryName}
- 7-8: Credible discussion of ${countryName}'s procurement options
- 5-6: Tangential mention of ${countryName}'s potential purchase
- 1-4: Weak connection or no procurement context
- 0: Completely irrelevant

FIGHTER TAGS: Only tag fighters that are EXPLICITLY mentioned in the post from: ${[...competitors, 'Gripen'].join(', ')}

If relevance < 7 OR post doesn't mention ${countryName}, return:
{ "sentiment": 0, "fighter_tags": [], "temperature": "cool", "relevance": 0, "procurement_related": false }

If relevant (relevance >= 7), provide:
{
  "sentiment": number (-1.0 to 1.0),
  "fighter_tags": string[] (ONLY fighters explicitly mentioned),
  "temperature": "hot" | "warm" | "cool",
  "relevance": number (7-10),
  "procurement_related": true,
  "sentiment_by_fighter": { "fighter_name": number },
  "translated_content": "English translation if post is not in ${countryLanguage}, otherwise omit this field"
}`
            }],
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const responseText = aiData.choices?.[0]?.message?.content || '';
          
          try {
            const parsed = JSON.parse(responseText);
            
            // STRICT relevance check - only posts with high relevance (>= 7)
            if (parsed.procurement_related === false || !parsed.relevance || parsed.relevance < 7) {
              console.log(`  Skipped low relevance post (relevance: ${parsed.relevance || 0})`);
              return; // Don't store irrelevant posts
            }
            
            sentiment = parsed.sentiment || 0;
            tags = parsed.fighter_tags || [];
            
            // If translation provided, append it to the content
            if (parsed.translated_content) {
              content = `${content}\n\n[Translation: ${parsed.translated_content}]`;
            }
            
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
