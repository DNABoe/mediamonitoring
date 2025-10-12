import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log('Searching for fighter articles:', { country, competitors });

    const fighters = ['Gripen', ...competitors];
    const allFighters = fighters.join(' OR ');
    
    // Get country-specific domain for local search
    const countryDomains: Record<string, string> = {
      'PT': '.pt', 'US': '.us', 'GB': '.uk', 'FR': '.fr', 'DE': '.de', 
      'ES': '.es', 'IT': '.it', 'SE': '.se', 'NO': '.no', 'DK': '.dk',
      'FI': '.fi', 'PL': '.pl', 'IN': '.in', 'BR': '.br', 'CA': '.ca',
      'AU': '.au', 'NZ': '.nz', 'JP': '.jp', 'KR': '.kr', 'CN': '.cn'
    };
    const countryDomain = countryDomains[country] || '';
    
    // First, search for LOCAL articles from the target country
    const localSearchQuery = `${country} fighter jet procurement defense ${allFighters}${countryDomain ? ` site:${countryDomain}` : ''}`;
    console.log('Local search query:', localSearchQuery);
    
    const localSearchResponse = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(localSearchQuery)}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );

    // Then search for international articles
    const intlSearchQuery = `${country} fighter jet procurement ${allFighters} news defense`;
    console.log('International search query:', intlSearchQuery);
    
    const intlSearchResponse = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(intlSearchQuery)}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );

    if (!localSearchResponse.ok && !intlSearchResponse.ok) {
      throw new Error(`Search failed`);
    }

    const localHtml = localSearchResponse.ok ? await localSearchResponse.text() : '';
    const intlHtml = intlSearchResponse.ok ? await intlSearchResponse.text() : '';
    
    // Extract search results from HTML
    const extractResults = (htmlText: string) => {
      const results = [];
      const resultRegex = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
      const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([^<]+)<\/a>/g;
      
      let match;
      const urls = [];
      const titles = [];
      
      while ((match = resultRegex.exec(htmlText)) !== null) {
        urls.push(match[1]);
        titles.push(match[2]);
      }
      
      const snippets = [];
      while ((match = snippetRegex.exec(htmlText)) !== null) {
        snippets.push(match[1]);
      }
      
      for (let i = 0; i < urls.length; i++) {
        if (urls[i] && titles[i]) {
          results.push({
            url: urls[i],
            title: titles[i],
            snippet: snippets[i] || ''
          });
        }
      }
      return results;
    };
    
    const localResults = extractResults(localHtml);
    const intlResults = extractResults(intlHtml);
    
    // Combine with local results first (prioritized)
    const allResults = [...localResults.slice(0, 15), ...intlResults.slice(0, 10)];

    console.log(`Found ${localResults.length} local + ${intlResults.length} international = ${allResults.length} total results`);

    if (allResults.length === 0) {
      return new Response(
        JSON.stringify({ success: true, articles: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use AI to analyze and structure the results
    const analysisPrompt = `Analyze these search results for fighter aircraft procurement news in ${country}. 
    
CRITICAL: Prioritize LOCAL ${country} media sources. The first results in the list are local sources - these are MOST IMPORTANT.

Fighter aircraft we're tracking: ${fighters.join(', ')}

Search results (LOCAL SOURCES FIRST):
${allResults.map((r, i) => `${i + 1}. Title: ${r.title}\n   URL: ${r.url}\n   Snippet: ${r.snippet}`).join('\n\n')}

REQUIREMENTS:
- MUST include ALL relevant local ${country} articles (especially ${countryDomain} domains)
- Identify source country accurately from domain (${countryDomain} = ${country}, .uk = GB, .com = US unless clearly from another country)
- Include international coverage as secondary
- Only articles about fighter procurement/defense
- CRITICAL: For "fighters" field, carefully check the title AND snippet for mentions of ANY of these fighters: ${fighters.join(', ')}. Include ALL fighters that are mentioned, not just one. For example, if both "Gripen" and "F-35" are mentioned, include both in the array.

For each relevant article, provide:
1. title (original language, cleaned)
2. url (actual article URL)
3. source (publication name)
4. publishedAt (YYYY-MM-DD format - use 2025-10-12 as default if unknown, or estimate recent date)
5. fighters (array of ALL fighters mentioned - check carefully for Gripen, F-35, Rafale, Eurofighter, etc.)
6. sourceCountry (country code)

Return ONLY a JSON array:
[
  {
    "title": "...",
    "url": "...",
    "source": "...",
    "publishedAt": "2025-10-12",
    "fighters": ["Gripen", "F-35"],
    "sourceCountry": "PT"
  }
]`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: analysisPrompt
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error("No content in AI response");
    }

    console.log('AI analysis response:', content);

    // Parse the JSON array from the response
    let articles = [];
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || content.match(/\[[\s\S]*\]/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      articles = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      // If parsing fails, return empty array
      articles = [];
    }

    console.log(`Structured ${articles.length} articles`);

    return new Response(
      JSON.stringify({ success: true, articles }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('Error in search-fighter-articles:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error",
        articles: []
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
