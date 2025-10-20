import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
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
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Get all media sources for the active country
    const { data: sources, error: sourcesError } = await supabase
      .from('sources')
      .select('url, name')
      .eq('country', country)
      .eq('enabled', true);
    
    if (sourcesError) {
      console.error('Error fetching sources:', sourcesError);
    }

    const allOutlets = sources?.map(s => s.url) || [];
    console.log(`Found ${allOutlets.length} media outlets for ${country}`);

    console.log('Searching for fighter articles:', { country, competitors, trackingPeriod: `${startDate} to ${endDate}` });

    const fighters = ['Gripen', ...competitors];
    const allFighters = fighters.join(' OR ');
    
    // Parse tracking period dates
    const trackingStart = new Date(startDate);
    const trackingEnd = new Date(endDate);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.toLocaleString('en-US', { month: 'long' });
    const trackingStartMonth = trackingStart.toLocaleString('en-US', { month: 'long' });
    const trackingStartYear = trackingStart.getFullYear();
    
    // Multi-language search terms by country
    const searchTermsByCountry: Record<string, {
      fighter: string[];
      aircraft: string[];
      procurement: string[];
      airForce: string[];
    }> = {
      'PT': {
        fighter: ['caça', 'caças'],
        aircraft: ['avião de combate', 'aviões de combate'],
        procurement: ['aquisição', 'compra', 'substituição'],
        airForce: ['FAP', 'Força Aérea']
      },
      'ES': {
        fighter: ['caza', 'cazas'],
        aircraft: ['avión de combate', 'aviones de combate'],
        procurement: ['adquisición', 'compra', 'sustitución'],
        airForce: ['Ejército del Aire']
      },
      'FR': {
        fighter: ['chasseur', 'chasseurs'],
        aircraft: ['avion de chasse', 'avions de chasse'],
        procurement: ['acquisition', 'achat'],
        airForce: ['Armée de l\'Air']
      },
      'DE': {
        fighter: ['Kampfflugzeug', 'Kampfflugzeuge', 'Kampfjet'],
        aircraft: ['Kampfjet', 'Kampfjets'],
        procurement: ['Beschaffung', 'Kauf'],
        airForce: ['Luftwaffe']
      },
      'SE': {
        fighter: ['jaktplan', 'jaktflygplan'],
        aircraft: ['stridsflygplan'],
        procurement: ['upphandling', 'inköp'],
        airForce: ['Flygvapnet']
      },
      'IT': {
        fighter: ['caccia', 'cacciabombardiere'],
        aircraft: ['aereo da combattimento'],
        procurement: ['acquisizione', 'acquisto'],
        airForce: ['Aeronautica Militare']
      },
      'NO': {
        fighter: ['jagerfly', 'kampfly'],
        aircraft: ['stridsfly'],
        procurement: ['anskaffelse', 'innkjøp'],
        airForce: ['Luftforsvaret']
      },
      'PL': {
        fighter: ['myśliwiec', 'myśliwce'],
        aircraft: ['samolot bojowy'],
        procurement: ['zakup', 'pozyskanie'],
        airForce: ['Siły Powietrzne']
      },
      'FI': {
        fighter: ['hävittäjä', 'hävittäjät'],
        aircraft: ['taistelukone'],
        procurement: ['hankinta'],
        airForce: ['Ilmavoimat']
      },
      'CZ': {
        fighter: ['stíhačka', 'stíhací letoun'],
        aircraft: ['bojový letoun'],
        procurement: ['nákup', 'pořízení', 'akvizice'],
        airForce: ['Vzdušné síly']
      },
      'BG': {
        fighter: ['изтребител', 'изтребители'],
        aircraft: ['боен самолет', 'бойни самолети'],
        procurement: ['закупуване', 'придобиване'],
        airForce: ['Военновъздушни сили']
      },
      'SA': {
        fighter: ['مقاتلة', 'مقاتلات', 'طائرة مقاتلة'],
        aircraft: ['طائرة حربية', 'طائرات حربية'],
        procurement: ['شراء', 'اقتناء', 'صفقة'],
        airForce: ['القوات الجوية', 'سلاح الجو']
      },
      'DEFAULT': {
        fighter: ['fighter', 'fighters'],
        aircraft: ['fighter jet', 'fighter aircraft'],
        procurement: ['procurement', 'acquisition', 'purchase'],
        airForce: ['air force']
      }
    };

    // Helper to get combined native + English search terms
    const getSearchTerms = (country: string) => {
      const nativeTerms = searchTermsByCountry[country] || searchTermsByCountry['DEFAULT'];
      const englishTerms = searchTermsByCountry['DEFAULT'];
      
      return {
        native: nativeTerms,
        english: englishTerms,
        combined: {
          fighter: [...nativeTerms.fighter, ...englishTerms.fighter].join(' OR '),
          aircraft: [...nativeTerms.aircraft, ...englishTerms.aircraft].join(' OR '),
          procurement: [...nativeTerms.procurement, ...englishTerms.procurement].join(' OR '),
          airForce: [...nativeTerms.airForce, ...englishTerms.airForce].join(' OR ')
        }
      };
    };
    
    // Get country-specific domain
    const countryDomains: Record<string, string> = {
      'PT': '.pt', 'US': '.us', 'GB': '.uk', 'FR': '.fr', 'DE': '.de', 
      'ES': '.es', 'IT': '.it', 'SE': '.se', 'NO': '.no', 'DK': '.dk',
      'FI': '.fi', 'PL': '.pl', 'IN': '.in', 'BR': '.br', 'CA': '.ca',
      'AU': '.au', 'NZ': '.nz', 'JP': '.jp', 'KR': '.kr', 'CN': '.cn',
      'CZ': '.cz', 'BG': '.bg', 'SA': '.sa', 'AE': '.ae', 'EG': '.eg'
    };
    
    const countryDomain = countryDomains[country] || '';
    const searchTerms = getSearchTerms(country);

    console.log(`Using search terms for ${country}:`, {
      native: searchTerms.native.fighter,
      hasNativeTerms: searchTerms.native !== searchTermsByCountry['DEFAULT']
    });
    
    // Helper function to batch fetch requests to avoid overwhelming the runtime
    const batchFetch = async (urls: string[], batchSize = 10): Promise<Response[]> => {
      const results: Response[] = [];
      for (let i = 0; i < urls.length; i += batchSize) {
        const batch = urls.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(
          batch.map(url => 
            fetch(url, { 
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
              signal: AbortSignal.timeout(10000) // 10 second timeout per request
            })
          )
        );
        results.push(...batchResults.filter(r => r.status === 'fulfilled').map(r => (r as PromiseFulfilledResult<Response>).value));
        // Small delay between batches to avoid rate limiting
        if (i + batchSize < urls.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      return results;
    };
    
    // Build searches for ALL media outlets (not just prioritized)
    const outletSearchUrls: string[] = [];
    if (allOutlets.length > 0) {
      console.log(`Searching across ALL ${allOutlets.length} media outlets for ${country}`);
      
      allOutlets.forEach((outlet: string) => {
        // Handle both exact domain and parent domain
        const domains = [outlet];
        const domainParts = outlet.split('.');
        if (domainParts.length > 2) {
          const parentDomain = domainParts.slice(-2).join('.');
          if (parentDomain !== outlet) {
            domains.push(parentDomain);
          }
        }
        
        domains.forEach(domain => {
          // Search 1: Tracking period articles
          outletSearchUrls.push(
            `https://html.duckduckgo.com/html/?q=${encodeURIComponent(
              `site:${domain} (${searchTerms.combined.fighter}) ${allFighters} after:${trackingStartMonth} ${trackingStartYear}`
            )}`
          );
          
          // Search 2: Current month focus
          outletSearchUrls.push(
            `https://html.duckduckgo.com/html/?q=${encodeURIComponent(
              `site:${domain} (${searchTerms.combined.fighter}) ${allFighters} ${currentMonth} ${currentYear}`
            )}`
          );
        });
      });
      
      console.log(`Generated ${outletSearchUrls.length} outlet-specific searches`);
    }
    
    // Build general search URLs for the tracking period
    const generalSearchUrls: string[] = [
      // Tracking period articles
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(
        `(${searchTerms.combined.fighter}) ${allFighters} after:${trackingStartMonth} ${trackingStartYear}${countryDomain ? ` site:${countryDomain}` : ''}`
      )}`,
      
      // Current month focus
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(
        `(${searchTerms.combined.fighter}) ${allFighters} ${currentMonth} ${currentYear}${countryDomain ? ` site:${countryDomain}` : ''}`
      )}`,
      
      // Procurement terms across tracking period
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(
        `${country} (${searchTerms.combined.procurement}) ${allFighters} ${trackingStartYear}..${currentYear}${countryDomain ? ` site:${countryDomain}` : ''}`
      )}`,
    ];
    
    // Combine all search URLs
    const allSearchUrls = [...outletSearchUrls, ...generalSearchUrls];
    
    console.log(`Executing ${allSearchUrls.length} searches in batches...`);
    
    // Execute searches in batches
    const localSearches = await batchFetch(allSearchUrls, 8);

    // International search (using PURE English terms for global coverage)
    const intlSearches = await Promise.all([
      fetch(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`${country} fighter jet ${allFighters} ${currentMonth} ${currentYear}`)}`,
        { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }
      ),
      fetch(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`${country} fighter procurement ${allFighters} latest news`)}`,
        { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }
      ),
      fetch(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`${country} ${allFighters} air force defense contract`)}`,
        { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }
      ),
      fetch(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`${country} military aircraft ${allFighters} purchase decision`)}`,
        { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }
      ),
      fetch(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`${country} fighter jet competition ${allFighters}`)}`,
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
    const trackingStartDate = new Date(startDate);
    const trackingEndDate = new Date(endDate);
    
    const analysisPrompt = `Analyze these search results for fighter aircraft procurement news in ${country}.

LANGUAGE CONTEXT FOR ${country}:
Native language terms used in local media:
- Fighter: ${searchTerms.native.fighter.join(', ')}
- Aircraft: ${searchTerms.native.aircraft.join(', ')}
- Procurement: ${searchTerms.native.procurement.join(', ')}
- Air Force: ${searchTerms.native.airForce.join(', ')}

**CRITICAL**: Articles using these native terms ARE VALID fighter jet articles. Also recognize English terms: fighter, jet, aircraft, procurement.

TODAY'S DATE: ${trackingEndDate.toISOString().split('T')[0]}
TRACKING PERIOD: ${trackingStartDate.toISOString().split('T')[0]} to ${trackingEndDate.toISOString().split('T')[0]}
ONLY INCLUDE ARTICLES FROM THIS TRACKING PERIOD

ALL MEDIA OUTLETS FOR ${country}:
${allOutlets.map((outlet: string) => `- ${outlet}`).join('\n')}

**REQUIREMENTS FOR ALL OUTLETS:**
1. Articles from these outlets MUST have sourceCountry: "${country}"
2. Include articles from ALL these outlets across the tracking period
3. Recognize BOTH native language (${searchTerms.native.fighter.join(', ')}) AND English terms
4. Prioritize recent articles but include ALL relevant articles from tracking period
5. Articles from ${country} outlets are PRIMARY sources


PRIORITY INSTRUCTIONS:
1. **TRACKING PERIOD**: Only include articles from ${trackingStartDate.toISOString().split('T')[0]} to ${trackingEndDate.toISOString().split('T')[0]}
2. Include ALL ${country} media outlets listed above
3. **NATIVE + ENGLISH**: Recognize articles in BOTH local language and English
4. Include ALL relevant articles from all ${country} outlets
5. ${country} media sources are PRIMARY, international coverage is SECONDARY
6. **LANGUAGE RECOGNITION**: Articles mentioning "${searchTerms.native.fighter.join('", "')}" or "${searchTerms.native.aircraft.join('", "')}" are fighter jet articles

Fighter aircraft we're tracking: ${fighters.join(', ')}

Search results (LOCAL SOURCES FIRST):
${allResults.map((r, i) => `${i + 1}. Title: ${r.title}\n   URL: ${r.url}\n   Snippet: ${r.snippet}`).join('\n\n')}

REQUIREMENTS:
- MUST include ALL relevant articles from ALL ${country} media outlets
- **CRITICAL**: Articles from ${country} outlets MUST have sourceCountry: "${country}"
- ONLY articles from tracking period: ${trackingStartDate.toISOString().split('T')[0]} to ${trackingEndDate.toISOString().split('T')[0]}
- **NATIVE + ENGLISH**: Recognize articles using: ${searchTerms.native.fighter.join(', ')}, ${searchTerms.native.procurement.join(', ')}, AND English equivalents
- Identify source country accurately:
  * ${country} outlets listed above = "${country}" (MANDATORY)
  * ${countryDomain} domains = "${country}"
  * Subdomains of ${country} outlets = "${country}"
  * .uk domains = "GB"
  * .com domains = "US" unless clearly from another country
  * Use domain TLD to determine country
- Include international English coverage as secondary
- Only articles about fighter procurement/defense in BOTH native language and English



**DATE EXTRACTION REQUIREMENTS:**
- Extract dates from URLs: Look for "/2025/09/25/", "/20250925/", etc.
- Extract dates from titles/snippets: "Sep 2025", "September 2025", "25 Sep", etc.
- If you find a date in URL or content, use it
- **TRACKING PERIOD**: Only include if date is between ${trackingStartDate.toISOString().split('T')[0]} and ${trackingEndDate.toISOString().split('T')[0]}
- If no clear date but appears recent and relevant, estimate within tracking period
- **CRITICAL**: Exclude articles clearly outside the tracking period
- Calculate relative dates ("2 days ago") from TODAY: ${trackingEndDate.toISOString().split('T')[0]}

**BALANCED APPROACH:**
- Prioritize articles with clear dates within tracking period
- Include potentially relevant articles even if exact date is unclear (estimate within tracking period)
- EXCLUDE articles clearly outside tracking period
- Include comprehensive coverage from all ${country} outlets

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
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || content.match(/\[[\s\S]*\]/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      articles = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      articles = [];
    }

    console.log(`Structured ${articles.length} articles`);

    // Store articles in database with sentiment analysis
    if (articles.length > 0) {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Prepare articles for database insertion
        const articlesToInsert = articles.map((article: any) => ({
          url: article.url,
          title_en: article.title,
          published_at: article.publishedAt,
          fighter_tags: article.fighters,
          sentiment: 0, // Will be updated with AI sentiment analysis
          source_country: article.sourceCountry,
          fetched_at: new Date().toISOString()
        }));

        // Analyze sentiment for each article using AI
        const sentimentPrompt = `Analyze the sentiment of these fighter aircraft news articles. For each article, provide a sentiment score from -1.0 (very negative) to 1.0 (very positive).

Consider:
- Positive mentions, endorsements, advantages highlighted
- Negative mentions, criticism, problems highlighted
- Neutral reporting vs. advocacy

Articles:
${articles.map((a: any, i: number) => `${i + 1}. "${a.title}" - Fighters: ${a.fighters.join(', ')}`).join('\n')}

Return ONLY a JSON array of sentiment scores in the same order:
[0.8, -0.3, 0.5, ...]`;

        try {
          const sentimentResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [{ role: "user", content: sentimentPrompt }],
            }),
          });

          if (sentimentResponse.ok) {
            const sentimentData = await sentimentResponse.json();
            const sentimentContent = sentimentData.choices?.[0]?.message?.content;
            const sentimentMatch = sentimentContent.match(/\[[\s\S]*?\]/) || sentimentContent.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
            const sentimentScores = sentimentMatch ? JSON.parse(sentimentMatch[1] || sentimentMatch[0]) : [];
            
            // Apply sentiment scores to articles
            articlesToInsert.forEach((article: any, index: number) => {
              if (sentimentScores[index] !== undefined) {
                article.sentiment = sentimentScores[index];
              }
            });
          }
        } catch (sentimentError) {
          console.error('Error analyzing sentiment:', sentimentError);
        }

        // Insert articles into database (upsert to avoid duplicates)
        try {
          const { error: insertError } = await supabase
            .from('items')
            .upsert(articlesToInsert, { onConflict: 'url', ignoreDuplicates: false });
          
          if (insertError) {
            console.error('Error inserting articles:', insertError);
          } else {
            console.log(`Stored ${articlesToInsert.length} articles in database`);
          }
        } catch (dbError) {
          console.error('Database error:', dbError);
        }
      }
    }

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
