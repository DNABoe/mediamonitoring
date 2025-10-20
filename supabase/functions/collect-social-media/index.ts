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

    // Collect social media posts for each competitor
    for (const fighter of competitors) {
      console.log(`Searching social media for ${fighter}`);
      
      // Search for social media posts (Reddit, Twitter mentions via Google)
      const searchQuery = `${fighter} fighter aircraft site:reddit.com OR site:twitter.com`;
      const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${googleSearchEngineId}&q=${encodeURIComponent(searchQuery)}&num=10&dateRestrict=m6`;
      
      const searchResponse = await fetch(searchUrl);
      const searchData = await searchResponse.json();

      if (searchData.items && searchData.items.length > 0) {
        for (const item of searchData.items) {
          try {
            // Determine platform from URL
            let platform = 'web';
            if (item.link.includes('reddit.com')) platform = 'reddit';
            else if (item.link.includes('twitter.com') || item.link.includes('x.com')) platform = 'twitter';
            
            // Extract post ID from URL
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

            // Insert social media post
            const { error: insertError } = await supabaseClient
              .from('social_media_posts')
              .insert({
                user_id: userId,
                tracking_country: country,
                platform: platform,
                post_id: postId,
                post_url: item.link,
                author_name: item.displayLink,
                content: item.snippet || item.title,
                published_at: new Date().toISOString(), // Google doesn't provide exact date
                fighter_tags: tags,
                sentiment: sentiment,
                engagement: { source: 'google_search' }
              })
              .select()
              .single();

            if (!insertError) {
              totalCollected++;
              console.log(`Stored social media post: ${item.title}`);
            }
          } catch (error) {
            console.error('Error processing social media item:', error);
          }
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
