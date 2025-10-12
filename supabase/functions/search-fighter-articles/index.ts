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
    
    // Search for articles using DuckDuckGo
    const searchQuery = `${country} fighter jet procurement ${allFighters} news`;
    console.log('Search query:', searchQuery);
    
    const searchResponse = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );

    if (!searchResponse.ok) {
      throw new Error(`Search failed: ${searchResponse.status}`);
    }

    const htmlText = await searchResponse.text();
    
    // Extract search results from HTML
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
    
    // Combine results (take up to 20 results)
    for (let i = 0; i < Math.min(20, urls.length); i++) {
      if (urls[i] && titles[i]) {
        results.push({
          url: urls[i],
          title: titles[i],
          snippet: snippets[i] || ''
        });
      }
    }

    console.log(`Found ${results.length} raw search results`);

    if (results.length === 0) {
      return new Response(
        JSON.stringify({ success: true, articles: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use AI to analyze and structure the results
    const analysisPrompt = `Analyze these search results for fighter aircraft procurement news in ${country}. 
    
Fighter aircraft we're tracking: ${fighters.join(', ')}

Search results:
${results.map((r, i) => `${i + 1}. Title: ${r.title}\n   URL: ${r.url}\n   Snippet: ${r.snippet}`).join('\n\n')}

For each relevant article about fighter procurement, return structured data with:
1. title (original language, cleaned up)
2. url (the actual article URL)
3. source (publication name extracted from URL/title)
4. publishedAt (estimate as "2025-10-12" if not available, or recent date)
5. fighters (array of which fighters from our list are mentioned)
6. sourceCountry (country code like PT, US, etc.)

Only include articles that are actually about fighter aircraft procurement. Skip generic news or unrelated content.

Return ONLY a JSON array, no other text:
[
  {
    "title": "...",
    "url": "...",
    "source": "...",
    "publishedAt": "2025-10-12",
    "fighters": ["Gripen"],
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
