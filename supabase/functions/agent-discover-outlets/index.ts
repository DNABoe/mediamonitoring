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
    const { country, countryName } = await req.json();
    
    console.log(`Discovering media outlets for ${countryName} (${country})`);

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // Get authenticated user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      throw new Error('Authentication required');
    }

    // Use Lovable AI to discover outlets
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const prompt = `You are a media research expert. For ${countryName}, identify reputable news outlets that would cover military fighter jet procurement.

Return ONLY a JSON array with 15-25 outlets. Each outlet must have:
- name: Outlet name
- domain: Website domain (e.g., "elpais.pe")
- type: "mainstream" | "defense" | "government" | "international"
- language: Primary language code (e.g., "es", "en", "pt")
- credibility: 1-10 rating

Focus on:
1. Top mainstream news websites in the country's primary language
2. Defense/military focused publications
3. Government military/defense ministry press offices
4. Major international outlets that cover this country
5. Aviation/aerospace trade publications

Return ONLY the JSON array, no markdown formatting.`;

    console.log('Calling Lovable AI for outlet discovery...');
    
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a media research assistant. Return only valid JSON arrays.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      if (aiResponse.status === 402) {
        throw new Error('AI credits depleted. Please add credits to your workspace.');
      }
      throw new Error('Failed to discover outlets');
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '[]';
    
    console.log('AI response received:', content.substring(0, 200));

    // Parse AI response
    let outlets = [];
    try {
      // Remove markdown code blocks if present
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      outlets = JSON.parse(cleaned);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.error('Raw content:', content);
      throw new Error('Failed to parse outlet data from AI');
    }

    if (!Array.isArray(outlets) || outlets.length === 0) {
      throw new Error('No outlets discovered');
    }

    console.log(`Discovered ${outlets.length} outlets`);

    // Save to user settings - fetch current settings first
    const { data: currentSettings } = await supabaseClient
      .from('user_settings')
      .select('active_country, active_competitors')
      .eq('user_id', user.id)
      .maybeSingle();

    // Update only prioritized_outlets, preserve other fields
    const { error: updateError } = await supabaseClient
      .from('user_settings')
      .upsert({
        user_id: user.id,
        active_country: currentSettings?.active_country || country,
        active_competitors: currentSettings?.active_competitors || [],
        prioritized_outlets: outlets,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      });

    if (updateError) {
      console.error('Error saving outlets:', updateError);
      throw updateError;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        outlets,
        count: outlets.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in agent-discover-outlets:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
