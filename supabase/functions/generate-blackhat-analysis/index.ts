import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BlackHatIssue {
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  impact: string;
  likelihood: string;
  mitigation?: string;
}

interface PlatformAnalysis {
  platform: string;
  issues: BlackHatIssue[];
}

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
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }
    
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabaseClient = createClient(supabaseUrl, supabaseKey);
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const body = await req.json();
    const { country, competitors, report } = body;
    
    // Validate input parameters
    if (!country || typeof country !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid country parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    if (!Array.isArray(competitors) || competitors.length === 0 || competitors.length > 10) {
      return new Response(JSON.stringify({ error: 'Invalid competitors. Must be array with 1-10 items' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    if (!report || typeof report !== 'object') {
      return new Response(JSON.stringify({ error: 'Invalid report parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log('Generating black hat analysis for:', { country, competitors });

    const allPlatforms = ['Gripen', ...competitors];
    
    const analysisPrompt = `You are a defense procurement adversarial analyst conducting a comprehensive "black hat" vulnerability assessment.

CONTEXT:
Country: ${country}
Competing Fighter Platforms: ${allPlatforms.join(', ')}

RESEARCH DATA:
Political Analysis:
${report.political_analysis}

Capability Analysis:
${report.capability_analysis}

Cost Analysis:
${report.cost_analysis}

Industrial Cooperation:
${report.industrial_cooperation}

YOUR MISSION:
For EACH platform (${allPlatforms.join(', ')}), identify comprehensive vulnerabilities, weaknesses, and risks that opponents would exploit. Think like an adversary trying to discredit each option.

ANALYSIS CATEGORIES:
1. **Political Vulnerabilities**: Opposition talking points, geopolitical dependencies, sovereignty concerns
2. **Technical Weaknesses**: Capability gaps, technological limitations, interoperability issues
3. **Financial Risks**: Cost overruns, lifecycle expenses, budget strain, hidden costs
4. **Strategic Dependencies**: Foreign control, supply chain risks, upgrade limitations
5. **Operational Limitations**: Maintenance complexity, availability issues, training requirements
6. **Industrial Concerns**: Limited tech transfer, weak offset packages, dependency on foreign suppliers
7. **Data Sovereignty**: ALIS/logistics systems, data sharing requirements, cybersecurity risks
8. **Timeline Risks**: Delivery delays, development issues, certification problems
9. **Interoperability**: NATO compatibility, existing infrastructure fit, coalition operations
10. **Sustainability**: Long-term support, spare parts availability, obsolescence risk

PLATFORM-SPECIFIC FOCUS AREAS:

**F-35:**
- ALIS dependency & data sovereignty
- High operating costs (CPFH)
- Maintenance complexity & availability rates
- US dependency & export controls
- Cost escalation history
- Software maturity issues
- Limited maneuverability vs 4.5 gen
- Political alignment requirements

**Gripen:**
- Limited stealth capability
- Smaller weapons payload
- Range limitations
- 4.5 gen vs 5th gen gap
- Market share concerns
- Industrial scale vs larger programs
- Long-term support questions
- Limited combat proven record vs F-35

**Rafale:**
- High acquisition cost
- Limited 5th gen features
- French dependency
- Smaller operator base
- Proprietary systems lock-in
- Operating cost concerns
- Limited stealth
- Industrial cooperation constraints

**Eurofighter:**
- Consortium complexity
- Cost overruns history
- Delayed upgrades
- Multi-national decision making
- Operating costs
- Limited ground attack vs air superiority
- 4.5 gen limitations
- Export control complexities

SEVERITY LEVELS:
- **CRITICAL**: Could derail procurement or cause severe operational/financial harm
- **HIGH**: Significant risk requiring immediate attention
- **MEDIUM**: Notable concern that needs mitigation
- **LOW**: Minor issue, manageable with planning

For EACH platform, identify 4-8 distinct vulnerabilities across different categories.

Return ONLY a JSON array following this exact structure:
[
  {
    "platform": "Gripen",
    "issues": [
      {
        "title": "Brief descriptive title",
        "description": "Detailed explanation of the vulnerability (2-3 sentences)",
        "severity": "critical|high|medium|low",
        "category": "Political|Technical|Financial|Strategic|Operational|Industrial|Data Sovereignty|Timeline|Interoperability|Sustainability",
        "impact": "Specific impact on Portugal's defense posture or procurement",
        "likelihood": "Very High|High|Medium|Low",
        "mitigation": "Potential mitigation strategy if applicable"
      }
    ]
  }
]

CRITICAL REQUIREMENTS:
- Be specific to ${country}'s context and needs
- Base analysis on the provided research data
- Identify REAL weaknesses each platform's opponents would exploit
- Provide 4-8 issues per platform
- Vary severity levels appropriately
- Include actionable mitigation strategies where possible
- Think like an adversary trying to discredit each option`;

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

    console.log('AI analysis response received');

    // Parse the JSON array from the response
    let analysis: PlatformAnalysis[] = [];
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || content.match(/\[[\s\S]*\]/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      analysis = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      throw new Error('Failed to parse AI analysis');
    }

    console.log(`Generated analysis for ${analysis.length} platforms with ${analysis.reduce((sum, p) => sum + p.issues.length, 0)} total issues`);

    return new Response(
      JSON.stringify({ success: true, analysis }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('Error in generate-blackhat-analysis:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
