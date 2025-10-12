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
    const { country, competitors, prioritizedOutlets = [] } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log('Searching for fighter articles:', { country, competitors });

    const fighters = ['Gripen', ...competitors];
    const allFighters = fighters.join(' OR ');
    
    // Get current date for dynamic searches
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.toLocaleString('en-US', { month: 'long' });
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleString('en-US', { month: 'long' });
    
    // Get country-specific domain
    const countryDomains: Record<string, string> = {
      'PT': '.pt', 'US': '.us', 'GB': '.uk', 'FR': '.fr', 'DE': '.de', 
      'ES': '.es', 'IT': '.it', 'SE': '.se', 'NO': '.no', 'DK': '.dk',
      'FI': '.fi', 'PL': '.pl', 'IN': '.in', 'BR': '.br', 'CA': '.ca',
      'AU': '.au', 'NZ': '.nz', 'JP': '.jp', 'KR': '.kr', 'CN': '.cn'
    };
    
    const countryDomain = countryDomains[country] || '';
    
    // Build prioritized outlet searches if provided
    const prioritizedSearches: Promise<Response>[] = [];
    if (prioritizedOutlets.length > 0) {
      console.log(`Prioritizing ${prioritizedOutlets.length} media outlets`);
      
      // Search each prioritized outlet specifically with MULTIPLE strategies
      prioritizedOutlets.forEach((outlet: string) => {
        // Search 1: Current year + fighters
        prioritizedSearches.push(
          fetch(
            `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`site:${outlet} ${allFighters} ${currentYear}`)}`,
            { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }
          )
        );
        // Search 2: Current month
        prioritizedSearches.push(
          fetch(
            `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`site:${outlet} ${allFighters} ${currentMonth}`)}`,
            { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }
          )
        );
        // Search 3: Last month
        prioritizedSearches.push(
          fetch(
            `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`site:${outlet} ${allFighters} ${lastMonth}`)}`,
            { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }
          )
        );
        // Search 4: Each individual fighter on this outlet
        fighters.forEach(fighter => {
          prioritizedSearches.push(
            fetch(
              `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`site:${outlet} ${fighter} ${currentYear}`)}`,
              { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }
            )
          );
        });
      });
    }
    
    // Multiple LOCAL searches with different approaches - FOCUS ON LATEST
    const localSearches = await Promise.all([
      ...prioritizedSearches,
      // Priority searches for LATEST articles with current dates
      fetch(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`${country} ${allFighters} ${currentMonth} ${currentYear}${countryDomain ? ` site:${countryDomain}` : ''}`)}`,
        { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }
      ),
      fetch(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`${country} ${allFighters} ${lastMonth} ${currentYear}${countryDomain ? ` site:${countryDomain}` : ''}`)}`,
        { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }
      ),
      fetch(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`${country} ${allFighters} news ${currentYear}${countryDomain ? ` site:${countryDomain}` : ''}`)}`,
        { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }
      ),
      fetch(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`${country} fighter jet latest ${currentYear}${countryDomain ? ` site:${countryDomain}` : ''}`)}`,
        { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }
      ),
      // Search: fighter jet procurement
      fetch(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`${country} fighter jet procurement ${allFighters}${countryDomain ? ` site:${countryDomain}` : ''}`)}`,
        { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }
      ),
      // Search: defense aviation
      fetch(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`${country} defense aviation ${allFighters}${countryDomain ? ` site:${countryDomain}` : ''}`)}`,
        { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }
      ),
      // Search: Each fighter individually with latest
      ...fighters.map(fighter =>
        fetch(
          `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`${fighter} ${country} latest${countryDomain ? ` site:${countryDomain}` : ''}`)}`,
          { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }
        )
      ),
      // Search: Each fighter with current year
      ...fighters.map(fighter =>
        fetch(
          `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`${country} ${fighter} ${currentYear}${countryDomain ? ` site:${countryDomain}` : ''}`)}`,
          { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }
        )
      )
    ]);

    // International search (more comprehensive, focus on latest)
    const intlSearches = await Promise.all([
      fetch(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`${country} ${allFighters} ${currentMonth} ${currentYear} news`)}`,
        { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }
      ),
      fetch(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`${country} fighter jet procurement ${allFighters} latest ${currentYear}`)}`,
        { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }
      ),
      fetch(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`${country} ${allFighters} defense contract latest`)}`,
        { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }
      )
    ]);

    const intlHtmls = await Promise.all(
      intlSearches.map(async (response: Response) => response.ok ? await response.text() : '')
    );
    
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
    
    // Process all local search results - NO LIMITS, get everything
    const localHtmls = await Promise.all(
      localSearches.map(async (response: Response) => response.ok ? await response.text() : '')
    );
    const localResults = localHtmls.flatMap((html: string) => extractResults(html));
    
    const intlResults = intlHtmls.flatMap((html: string) => extractResults(html));
    
    // Take ALL results, prioritize local but don't limit
    const allResultsWithDupes = [
      ...localResults,  // All local results first
      ...intlResults    // Then all international
    ];
    
    const seenUrls = new Set<string>();
    const allResults = allResultsWithDupes.filter(result => {
      if (seenUrls.has(result.url)) return false;
      seenUrls.add(result.url);
      return true;
    });

    console.log(`Found ${localResults.length} local + ${intlResults.length} international = ${allResults.length} unique results (NO LIMITS)`);

    if (allResults.length === 0) {
      return new Response(
        JSON.stringify({ success: true, articles: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use AI to analyze and structure the results
    const currentDate = new Date();
    const sixtyDaysAgo = new Date(currentDate.getTime() - (60 * 24 * 60 * 60 * 1000));
    
    const analysisPrompt = `Analyze these search results for fighter aircraft procurement news in ${country}. 
    
TODAY'S DATE: ${currentDate.toISOString().split('T')[0]}
ONLY INCLUDE ARTICLES FROM THE LAST 60 DAYS (after ${sixtyDaysAgo.toISOString().split('T')[0]})

${prioritizedOutlets.length > 0 ? `
🔴 CRITICAL PRIORITY - PRIORITIZED MEDIA OUTLETS:
${prioritizedOutlets.map((outlet: string) => `- ${outlet}`).join('\n')}

**MANDATORY REQUIREMENTS FOR PRIORITIZED OUTLETS:**
1. Articles from these outlets MUST appear FIRST in your results
2. You MUST include AT LEAST 60-70% of articles from these prioritized outlets
3. Articles from prioritized outlets take precedence over ALL other sources
4. If an article is from a prioritized outlet, it should be included even if slightly less relevant
5. MAXIMUM importance on ${currentMonth} ${currentYear} articles from these outlets
6. The first 10-15 results MUST be from prioritized outlets if available

Only after exhausting relevant articles from prioritized outlets, then include other sources.
` : ''}

CRITICAL PRIORITY INSTRUCTIONS:
1. **ABSOLUTE PRIORITY: NEWEST ARTICLES FIRST** - Heavily favor articles from ${currentMonth} ${currentYear}, then ${lastMonth} ${currentYear}
2. ${prioritizedOutlets.length > 0 ? 'Prioritized outlets DOMINATE the results (60-70% minimum)' : 'Prioritize LOCAL ' + country + ' media sources'}
3. Include ALL relevant articles from prioritized outlets
4. If an article is from the current month AND from a prioritized outlet, it is MANDATORY
5. Recent articles (last 30 days) from prioritized outlets are MORE important than any other content

Fighter aircraft we're tracking: ${fighters.join(', ')}

Search results (LOCAL SOURCES FIRST):
${allResults.map((r, i) => `${i + 1}. Title: ${r.title}\n   URL: ${r.url}\n   Snippet: ${r.snippet}`).join('\n\n')}

REQUIREMENTS:
- MUST include ALL relevant local ${country} articles (especially ${countryDomain} domains)
- ONLY articles from the last 60 days
- Identify source country accurately from domain (${countryDomain} = ${country}, .uk = GB, .com = US unless clearly from another country)
- Include international coverage as secondary
- Only articles about fighter procurement/defense

**CRITICAL DATE REQUIREMENTS:**
- You MUST ONLY include articles if you can find a REAL date in the title or snippet
- Look for: "Oct 2025", "October 2025", "2025-10-12", "12 Oct", month names, specific dates
- If NO date is visible in title/snippet, use the current month: ${currentMonth} ${currentYear}
- DO NOT make up dates or use placeholder dates
- DO NOT distribute dates evenly across the 60-day period
- If you see "2 days ago" or "last week" in snippet, calculate from TODAY: ${currentDate.toISOString().split('T')[0]}
- Articles WITHOUT visible dates should default to CURRENT MONTH only

CRITICAL FIGHTER TAG DETECTION:
Read the ENTIRE title AND snippet carefully. For the "fighters" field:
- Look for mentions of: ${fighters.join(', ')}
- Include EVERY fighter that is mentioned or discussed
- If "Gripen" appears ANYWHERE in the title or snippet, include "Gripen" in the array
- If "F-35" appears ANYWHERE, include "F-35" in the array  
- If "Rafale" appears ANYWHERE, include "Rafale" in the array
- If "Eurofighter" appears ANYWHERE, include "Eurofighter" in the array
- An article can mention MULTIPLE fighters - include ALL of them
- DO NOT default to just ["F-35"] - read carefully!

Example: If title says "Portugal considers Gripen and F-35" then fighters should be ["Gripen", "F-35"]

For each relevant article, provide:
1. title (original language, cleaned)
2. url (actual article URL)
3. source (publication name)
4. publishedAt (YYYY-MM-DD format - MUST be from visible date in content OR current month if no date found)
5. fighters (array of ALL fighters mentioned - read carefully!)
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
