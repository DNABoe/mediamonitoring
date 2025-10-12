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
    const { country, competitors } = await req.json();
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Fetch enabled media sources
    const { data: sources, error: sourcesError } = await supabaseClient
      .from('sources')
      .select('*')
      .eq('country', country)
      .eq('enabled', true);

    if (sourcesError) throw sourcesError;

    // Calculate date 60 days ago
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const startDate = sixtyDaysAgo.toISOString().split('T')[0];
    
    console.log(`Searching for recent articles (last 60 days from ${startDate})`);

    // Multi-language search terms
    const searchTermsByCountry: Record<string, { native: string[], english: string[] }> = {
      PT: { 
        native: ['caça', 'caças'],
        english: ['fighter', 'jet', 'aircraft']
      },
      DEFAULT: { 
        native: [],
        english: ['fighter', 'jet', 'aircraft']
      }
    };

    const searchTerms = searchTermsByCountry[country] || searchTermsByCountry.DEFAULT;
    const domainSuffix = country === 'PT' ? '.pt' : '';

    // Helper: batch fetch
    async function batchFetch(urls: string[], batchSize = 10) {
      const results = [];
      for (let i = 0; i < urls.length; i += batchSize) {
        const batch = urls.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (url) => {
            try {
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 10000);
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
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      return results;
    }

    // Generate search URLs for last 60 days only
    const searchUrls: string[] = [];
    
    // Search specific outlets
    for (const source of sources || []) {
      const domain = source.url.replace(/^https?:\/\//i, '').split('/')[0];
      
      for (const term of [...searchTerms.native, ...searchTerms.english].slice(0, 2)) {
        searchUrls.push(
          `https://html.duckduckgo.com/html/?q=site:${domain}+${encodeURIComponent(term)}+after:${startDate}`
        );
      }
      
      // Add competitor searches
      for (const competitor of competitors) {
        searchUrls.push(
          `https://html.duckduckgo.com/html/?q=site:${domain}+${encodeURIComponent(competitor)}+after:${startDate}`
        );
      }
    }

    // Add general recent searches
    for (const term of searchTerms.native.slice(0, 2)) {
      searchUrls.push(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(term)}+${domainSuffix}+after:${startDate}`
      );
    }

    const searchResults = await batchFetch(searchUrls);

    // Extract results
    function extractResults(html: string): Array<{title: string, url: string}> {
      const results: Array<{title: string, url: string}> = [];
      const resultRegex = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
      
      let match;
      while ((match = resultRegex.exec(html)) !== null) {
        results.push({
          url: match[1],
          title: match[2].trim()
        });
      }
      
      return results;
    }

    const allResults = searchResults
      .filter(html => html !== null)
      .flatMap(html => extractResults(html!));
    
    const uniqueResults = Array.from(
      new Map(allResults.map(r => [r.url, r])).values()
    );

    console.log(`Found ${uniqueResults.length} recent articles`);

    // Quick categorization
    const articles = uniqueResults.map(result => {
      // Determine if local or international
      let isLocal = false;
      let sourceName = 'Unknown Source';
      
      if (sources) {
        for (const source of sources) {
          const sourceDomain = source.url.replace(/^https?:\/\//i, '').split('/')[0];
          if (result.url.includes(sourceDomain)) {
            isLocal = true;
            sourceName = source.name;
            break;
          }
        }
      }
      
      if (!isLocal && result.url.includes(domainSuffix)) {
        isLocal = true;
      }

      // Extract fighters from title
      const title = result.title.toLowerCase();
      const fighters = [];
      if (title.includes('gripen')) fighters.push('Gripen');
      if (title.includes('f-35') || title.includes('f35')) fighters.push('F-35');
      if (title.includes('rafale')) fighters.push('Rafale');

      return {
        title: result.title,
        url: result.url,
        source: sourceName,
        source_country: isLocal ? country : 'INTERNATIONAL',
        published_at: new Date().toISOString(),
        fighter_tags: fighters
      };
    });

    return new Response(JSON.stringify({ 
      articles,
      count: articles.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in search-recent-media-references:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
