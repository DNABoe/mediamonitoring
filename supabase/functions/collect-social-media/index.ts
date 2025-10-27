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

    let totalCollected = 0;

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

    // Collect social media posts for each competitor
    for (const fighter of competitors) {
      console.log(`Searching social media for ${fighter}`);
      
      // Search Reddit
      const redditQuery = `${fighter} fighter aircraft ${country} site:reddit.com`;
      const redditUrl = `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${googleSearchEngineId}&q=${encodeURIComponent(redditQuery)}&num=10&dateRestrict=m6`;
      
      const redditResponse = await fetch(redditUrl);
      const redditData = await redditResponse.json();

      if (redditData.items) {
        for (const item of redditData.items) {
          await processSocialPost(item, 'reddit', fighter, userId, country, competitors, supabaseClient);
          totalCollected++;
        }
      }

      // Search X (Twitter)
      const xQuery = `${fighter} ${country} procurement site:x.com OR site:twitter.com`;
      const xUrl = `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${googleSearchEngineId}&q=${encodeURIComponent(xQuery)}&num=10&dateRestrict=m6`;
      
      const xResponse = await fetch(xUrl);
      const xData = await xResponse.json();

      if (xData.items) {
        for (const item of xData.items) {
          await processSocialPost(item, 'x', fighter, userId, country, competitors, supabaseClient);
          totalCollected++;
        }
      }

      // Search Facebook (local language)
      const fbQuery = `${fighter} ${country} defense ${localLanguage} site:facebook.com`;
      const fbUrl = `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${googleSearchEngineId}&q=${encodeURIComponent(fbQuery)}&num=10&dateRestrict=m6`;
      
      const fbResponse = await fetch(fbUrl);
      const fbData = await fbResponse.json();

      if (fbData.items) {
        for (const item of fbData.items) {
          await processSocialPost(item, 'facebook', fighter, userId, country, competitors, supabaseClient);
          totalCollected++;
        }
      }

      // Search LinkedIn
      const linkedinQuery = `${fighter} ${country} procurement site:linkedin.com`;
      const linkedinUrl = `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${googleSearchEngineId}&q=${encodeURIComponent(linkedinQuery)}&num=10&dateRestrict=m6`;
      
      const linkedinResponse = await fetch(linkedinUrl);
      const linkedinData = await linkedinResponse.json();

      if (linkedinData.items) {
        for (const item of linkedinData.items) {
          await processSocialPost(item, 'linkedin', fighter, userId, country, competitors, supabaseClient);
          totalCollected++;
        }
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

// Helper function to process social media posts
async function processSocialPost(
  item: any, 
  platform: string, 
  fighter: string, 
  userId: string, 
  country: string, 
  competitors: string[], 
  supabaseClient: any
) {
  try {
    const postId = item.link.split('/').pop() || item.link;
    
    // Analyze sentiment using Lovable AI
    const { data: aiData } = await supabaseClient.functions.invoke('analyze-sentiment', {
      body: {
        text: item.snippet || item.title,
        fighters: competitors
      }
    });

    const sentiment = aiData?.sentiment || 0;
    const tags = aiData?.fighter_tags || [fighter];

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
    } else if (platform === 'reddit' && item.link.includes('/u/')) {
      const match = item.link.match(/\/u\/([^\/]+)/);
      if (match) authorUsername = match[1];
    }

    // Insert social media post
    await supabaseClient
      .from('social_media_posts')
      .insert({
        user_id: userId,
        tracking_country: country,
        platform: platform,
        post_id: postId,
        post_url: item.link,
        author_name: authorName,
        author_username: authorUsername,
        content: item.snippet || item.title,
        published_at: new Date().toISOString(),
        fighter_tags: tags,
        sentiment: sentiment,
        engagement: { source: 'google_search' }
      });

    console.log(`Stored ${platform} post: ${item.title}`);
  } catch (error) {
    console.error(`Error processing ${platform} post:`, error);
  }
}
