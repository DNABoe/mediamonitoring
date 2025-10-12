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

    const fighters = ['Gripen', ...competitors].join(', ');
    
    const searchPrompt = `Search the web for recent news articles (from the last 60 days) about fighter aircraft procurement in ${country}. 
    
Focus on articles that discuss any of these fighter aircraft: ${fighters}.

For each article you find, provide:
1. The article title (in original language, don't translate)
2. The full URL to the article
3. The publication/source name
4. Publication date (format: YYYY-MM-DD)
5. Which fighters are mentioned (from this list: ${fighters})
6. Source country code (e.g., PT for Portugal, US for United States, etc.)

Prioritize:
- Local ${country} media sources first
- Recent articles (last 60 days)
- Articles specifically about fighter procurement decisions
- Defense industry publications

Return ONLY a JSON array with this exact structure:
[
  {
    "title": "Article title in original language",
    "url": "https://full-article-url.com",
    "source": "Publication Name",
    "publishedAt": "2025-10-12",
    "fighters": ["Gripen", "F-35"],
    "sourceCountry": "PT"
  }
]

Find at least 20-30 relevant articles. Do not include articles older than 60 days.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: searchPrompt
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error("No content in AI response");
    }

    console.log('AI response:', content);

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

    console.log(`Found ${articles.length} articles`);

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
