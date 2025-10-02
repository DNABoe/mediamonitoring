import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

    // Known RSS feed URLs for Portuguese sources
    const rssUrls: Record<string, string> = {
      'RTP': 'https://www.rtp.pt/noticias/rss',
      'SIC Notícias': 'https://sicnoticias.pt/rss',
      'Público': 'https://www.publico.pt/rss',
      'Expresso': 'https://expresso.pt/rss',
      'Observador': 'https://observador.pt/feed/',
      'ECO': 'https://eco.sapo.pt/feed/',
    }

    for (const source of sources || []) {
      try {
        console.log(`Scraping ${source.name} (${source.url})`)
        
        // Get RSS URL from mapping or construct it
        let rssUrl = rssUrls[source.name]
        if (!rssUrl) {
          // Try common patterns
          if (source.url.includes('saab.com')) {
            rssUrl = 'https://www.saabgroup.com/feed/'
          } else if (source.url.includes('lockheedmartin.com')) {
            rssUrl = 'https://news.lockheedmartin.com/rss'
          } else if (source.url.includes('f35.com')) {
            rssUrl = 'https://www.f35.com/feed'
          } else {
            rssUrl = `${source.url}/feed`
          }
        }

        console.log(`Fetching RSS from: ${rssUrl}`)

        const response = await fetch(rssUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; PortugueseFighterMonitor/1.0)',
            'Accept': 'application/rss+xml, application/xml, text/xml, */*'
          }
        })

        if (!response.ok) {
          console.error(`Failed to fetch ${source.name}: ${response.status}`)
          continue
        }

        const xmlText = await response.text()
        
        // Parse XML manually using regex patterns (simpler and more reliable in Deno)
        const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi
        const items = [...xmlText.matchAll(itemRegex)]
        
        console.log(`Found ${items.length} items in ${source.name}`)

        for (const itemMatch of items) {
          try {
            const itemXml = itemMatch[1]
            
            // Extract data using regex
            const titleMatch = itemXml.match(/<title[^>]*><!\[CDATA\[(.*?)\]\]><\/title>|<title[^>]*>(.*?)<\/title>/i)
            const linkMatch = itemXml.match(/<link[^>]*>(.*?)<\/link>/i)
            const pubDateMatch = itemXml.match(/<pubDate[^>]*>(.*?)<\/pubDate>/i)
            const descMatch = itemXml.match(/<description[^>]*><!\[CDATA\[(.*?)\]\]><\/description>|<description[^>]*>(.*?)<\/description>/i)
            const contentMatch = itemXml.match(/<content:encoded[^>]*><!\[CDATA\[(.*?)\]\]><\/content:encoded>/i)
            
            const title = (titleMatch?.[1] || titleMatch?.[2])?.trim()
            const link = linkMatch?.[1]?.trim()
            const pubDate = pubDateMatch?.[1]?.trim()
            const description = (descMatch?.[1] || descMatch?.[2])?.trim()
            const contentEncoded = contentMatch?.[1]?.trim()
            
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