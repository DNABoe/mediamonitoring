import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { DOMParser, Element } from 'https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RSSItem {
  title: string
  link: string
  pubDate: string
  description?: string
  content?: string
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

    console.log('Fetching enabled sources...')
    
    // Get all enabled sources
    const { data: sources, error: sourcesError } = await supabase
      .from('sources')
      .select('*')
      .eq('enabled', true)

    if (sourcesError) {
      throw sourcesError
    }

    console.log(`Found ${sources?.length || 0} enabled sources`)

    let totalItemsScraped = 0
    const results = []

    for (const source of sources || []) {
      try {
        console.log(`Scraping ${source.name} (${source.url})`)
        
        // Construct RSS feed URL (common patterns)
        let rssUrl = source.url
        if (!rssUrl.includes('/feed') && !rssUrl.includes('/rss')) {
          rssUrl = `${source.url}/rss`
        }

        const response = await fetch(rssUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; PortugueseFighterMonitor/1.0)'
          }
        })

        if (!response.ok) {
          console.error(`Failed to fetch ${source.name}: ${response.status}`)
          continue
        }

        const xmlText = await response.text()
        const doc = new DOMParser().parseFromString(xmlText, 'text/xml')
        
        if (!doc) {
          console.error(`Failed to parse XML for ${source.name}`)
          continue
        }

        const items = doc.querySelectorAll('item')
        console.log(`Found ${items.length} items in ${source.name}`)

        for (const itemNode of items) {
          try {
            const item = itemNode as Element
            const title = item.querySelector('title')?.textContent?.trim()
            const link = item.querySelector('link')?.textContent?.trim()
            const pubDate = item.querySelector('pubDate')?.textContent?.trim()
            const description = item.querySelector('description')?.textContent?.trim()
            const contentEncoded = item.querySelector('content\\:encoded')?.textContent?.trim()
            
            if (!title || !link) continue

            // Check if item already exists
            const { data: existing } = await supabase
              .from('items')
              .select('id')
              .eq('url', link)
              .maybeSingle()

            if (existing) {
              console.log(`Item already exists: ${title}`)
              continue
            }

            // Parse date
            let publishedAt = new Date()
            if (pubDate) {
              try {
                publishedAt = new Date(pubDate)
              } catch (e) {
                console.error('Failed to parse date:', pubDate)
              }
            }

            // Insert new item
            const { data: newItem, error: insertError } = await supabase
              .from('items')
              .insert({
                source_id: source.id,
                url: link,
                title_pt: title,
                fulltext_pt: contentEncoded || description || title,
                published_at: publishedAt.toISOString(),
                fetched_at: new Date().toISOString(),
              })
              .select()
              .single()

            if (insertError) {
              console.error('Error inserting item:', insertError)
              continue
            }

            console.log(`✓ Scraped: ${title}`)
            totalItemsScraped++

          } catch (itemError) {
            console.error('Error processing item:', itemError)
          }
        }

        results.push({
          source: source.name,
          itemsFound: items.length,
          success: true
        })

      } catch (sourceError) {
        console.error(`Error scraping ${source.name}:`, sourceError)
        const errorMessage = sourceError instanceof Error ? sourceError.message : 'Unknown error'
        results.push({
          source: source.name,
          error: errorMessage,
          success: false
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalItemsScraped,
        sourcesProcessed: results.length,
        results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in scrape-sources:', error)
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