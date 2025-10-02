import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured')
    }

    console.log('Fetching unprocessed items...')

    const keywords = ['Gripen', 'JAS 39', 'F-35', 'F35', 'Lockheed Martin', 'Saab', 'Força Aérea', 'fighter', 'caça', 'avião de combate', 'Air Force']

    // Get items that haven't been processed - prioritize those with fighter keywords
    const { data: allItems, error: itemsError } = await supabase
      .from('items')
      .select('*, sources!inner(name, type)')
      .is('summary_en', null)
      .order('published_at', { ascending: false })
      .limit(100) // Fetch more to find relevant ones

    if (itemsError) throw itemsError

    // Filter for items with fighter keywords or from defense sources
    const items = (allItems || []).filter(item => {
      const content = (item.fulltext_pt || item.title_pt || '').toLowerCase()
      const hasKeyword = keywords.some(kw => content.includes(kw.toLowerCase()))
      const isDefenseSource = item.sources?.type === 'defense'
      return hasKeyword || isDefenseSource
    }).slice(0, 10) // Process top 10 relevant items

    console.log(`Found ${items?.length || 0} relevant items to process`)

    let processedCount = 0

    for (const item of items || []) {
      try {
        console.log(`Processing: ${item.title_pt}`)

        const content = item.fulltext_pt || item.title_pt

        // Call Lovable AI to analyze content
        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: `You are analyzing Portuguese news articles about the Portuguese fighter jet program. Extract:
1. English title translation
2. English summary (2-3 sentences)
3. Sentiment score (-1.0 to 1.0) where -1 is very negative, 0 is neutral, 1 is very positive
4. Fighter tags: which fighters are mentioned (Gripen, F-35, or both)
5. Political stance: pro-Gripen, pro-F-35, or neutral
6. Key entities mentioned (people, organizations, locations)

Respond in valid JSON format only.`
              },
              {
                role: 'user',
                content: `Title: ${item.title_pt}\n\nContent: ${content.substring(0, 4000)}`
              }
            ],
            tools: [{
              type: 'function',
              function: {
                name: 'analyze_article',
                description: 'Extract structured analysis from the article',
                parameters: {
                  type: 'object',
                  properties: {
                    title_en: { type: 'string' },
                    summary_en: { type: 'string' },
                    sentiment: { type: 'number', minimum: -1, maximum: 1 },
                    fighter_tags: { type: 'array', items: { type: 'string', enum: ['Gripen', 'F-35'] } },
                    political_stance: { type: 'string', enum: ['pro-Gripen', 'pro-F-35', 'neutral'] },
                    entities: {
                      type: 'object',
                      properties: {
                        people: { type: 'array', items: { type: 'string' } },
                        organizations: { type: 'array', items: { type: 'string' } },
                        locations: { type: 'array', items: { type: 'string' } }
                      }
                    }
                  },
                  required: ['title_en', 'summary_en', 'sentiment', 'fighter_tags', 'political_stance']
                }
              }
            }],
            tool_choice: { type: 'function', function: { name: 'analyze_article' } }
          })
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error('AI API error:', response.status, errorText)
          continue
        }

        const data = await response.json()
        const toolCall = data.choices?.[0]?.message?.tool_calls?.[0]
        
        if (!toolCall) {
          console.error('No tool call in response')
          continue
        }

        const analysis = JSON.parse(toolCall.function.arguments)

        // Translate summary to Portuguese using AI
        const translationResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: 'Translate the following text to Portuguese. Return only the translation.' },
              { role: 'user', content: analysis.summary_en }
            ]
          })
        })

        let fulltext_en = analysis.summary_en
        if (translationResponse.ok) {
          const translationData = await translationResponse.json()
          fulltext_en = translationData.choices?.[0]?.message?.content || analysis.summary_en
        }

        // Calculate stance
        const stance: Record<string, number> = {}
        if (analysis.political_stance === 'pro-Gripen') {
          stance['Gripen'] = 0.7
          stance['F-35'] = -0.3
        } else if (analysis.political_stance === 'pro-F-35') {
          stance['Gripen'] = -0.3
          stance['F-35'] = 0.7
        } else {
          stance['Gripen'] = 0
          stance['F-35'] = 0
        }

        // Update item with AI analysis
        const { error: updateError } = await supabase
          .from('items')
          .update({
            title_en: analysis.title_en,
            summary_en: analysis.summary_en,
            fulltext_en: fulltext_en,
            sentiment: analysis.sentiment,
            fighter_tags: analysis.fighter_tags,
            entities: analysis.entities,
            stance: stance
          })
          .eq('id', item.id)

        if (updateError) {
          console.error('Error updating item:', updateError)
          continue
        }

        console.log(`✓ Processed: ${item.title_pt}`)
        processedCount++

      } catch (itemError) {
        console.error('Error processing item:', itemError)
      }
    }

    // Generate daily metrics regardless of processedCount
    console.log('Generating daily metrics...')
    
    const today = new Date().toISOString().split('T')[0]
    
    // Get all processed items from today that have fighter tags
    const { data: todayItems, error: todayError } = await supabase
      .from('items')
      .select('*')
      .gte('published_at', today)
      .not('sentiment', 'is', null)
      .not('fighter_tags', 'eq', '{}')
    
    if (!todayError && todayItems && todayItems.length > 0) {
      // Calculate metrics for each fighter
      const fighters = ['Gripen', 'F-35']
      
      for (const fighter of fighters) {
        const fighterItems = todayItems.filter(i => 
          Array.isArray(i.fighter_tags) && i.fighter_tags.includes(fighter)
        )
        
        if (fighterItems.length > 0) {
          const avgSentiment = fighterItems.reduce((sum, i) => sum + (i.sentiment || 0), 0) / fighterItems.length
          const stanceScore = fighterItems.reduce((sum, i) => sum + (i.stance?.[fighter] || 0), 0) / fighterItems.length
          const hotness = Math.abs(stanceScore) * fighterItems.length * (1 + Math.abs(avgSentiment))
          
          // Check if metrics exist for this fighter today
          const { data: existingMetric } = await supabase
            .from('metrics')
            .select('id, hotness')
            .eq('day', today)
            .eq('fighter', fighter)
            .maybeSingle()
          
          const momentum = existingMetric ? hotness - (existingMetric.hotness || 0) : 0
          
          if (existingMetric) {
            await supabase
              .from('metrics')
              .update({
                mentions: fighterItems.length,
                avg_sentiment: avgSentiment,
                hotness: hotness,
                momentum: momentum
              })
              .eq('id', existingMetric.id)
          } else {
            await supabase
              .from('metrics')
              .insert({
                day: today,
                fighter: fighter,
                mentions: fighterItems.length,
                avg_sentiment: avgSentiment,
                hotness: hotness,
                momentum: momentum
              })
          }
          
          console.log(`✓ Metrics for ${fighter}: ${fighterItems.length} mentions, hotness: ${hotness.toFixed(2)}`)
        } else {
          console.log(`No items found for ${fighter} today`)
        }
      }
    } else {
      console.log('No processed items with fighter tags found for today')
    }

    return new Response(
      JSON.stringify({
        success: true,
        processedCount,
        totalItems: items?.length || 0
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in process-items:', error)
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})