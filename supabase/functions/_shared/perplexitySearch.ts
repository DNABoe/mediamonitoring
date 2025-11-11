/**
 * Perplexity AI-powered search helper
 * Uses sonar-pro model for real-time web search with citations
 */

interface PerplexitySearchParams {
  query: string;
  country?: string;
  domains?: string[];
  recencyFilter?: 'day' | 'week' | 'month' | 'year';
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
}

/**
 * Perform AI-powered search using Perplexity API
 * @param params Search parameters
 * @param apiKey Perplexity API key
 * @returns Array of search results with titles, URLs, and snippets
 */
export async function perplexitySearch(
  params: PerplexitySearchParams,
  apiKey: string
): Promise<SearchResult[]> {
  const { query, country, domains, recencyFilter = 'month' } = params;

  // Build enhanced query with domain filtering
  let enhancedQuery = query;
  
  if (domains && domains.length > 0) {
    const domainFilter = domains.slice(0, 5).map(d => `site:${d}`).join(' OR ');
    enhancedQuery += ` (${domainFilter})`;
  }
  
  if (country) {
    enhancedQuery += ` ${country}`;
  }

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'user',
            content: enhancedQuery
          }
        ],
        temperature: 0.0,
        top_p: 0.9,
        return_images: false,
        return_related_questions: false,
        search_recency_filter: recencyFilter,
        return_citations: true
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Perplexity API error: ${response.status} - ${errorText}`);
      
      if (response.status === 429) {
        throw new Error('Perplexity API rate limit exceeded. Please try again later.');
      }
      if (response.status === 402) {
        throw new Error('Perplexity API payment required. Please check your account balance.');
      }
      
      return [];
    }

    const data = await response.json();
    const citations = data.citations || [];

    // Parse the AI response to extract structured results
    const results: SearchResult[] = [];

    // Perplexity returns citations as an array of URLs
    // We need to extract titles from the page using the URL or from AI response
    if (citations && citations.length > 0) {
      console.log(`✓ Found ${citations.length} search results from Perplexity API`);
      
      for (const url of citations) {
        // Extract domain and create basic title from URL
        let title = 'Untitled';
        try {
          const urlObj = new URL(url);
          const pathname = urlObj.pathname;
          // Try to create a readable title from the URL path
          const pathParts = pathname.split('/').filter(p => p && p.length > 2);
          if (pathParts.length > 0) {
            title = pathParts[pathParts.length - 1]
              .replace(/[-_]/g, ' ')
              .replace(/\.(html|htm|php|asp|aspx)$/i, '')
              .split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ')
              .substring(0, 100);
          }
          
          if (title === 'Untitled' || title.length < 5) {
            title = urlObj.hostname.replace('www.', '') + ' article';
          }
        } catch {
          title = 'News Article';
        }

        results.push({
          title,
          url,
          snippet: `Article from ${new URL(url).hostname}`,
          publishedDate: undefined
        });
      }
    }

    console.log(`✓ Perplexity found ${results.length} results for: "${query.substring(0, 60)}"`);
    return results;

  } catch (error) {
    console.error(`Perplexity search error for "${query.substring(0, 60)}":`, error);
    throw error;
  }
}

/**
 * Batch Perplexity searches with rate limiting
 */
export async function batchPerplexitySearch(
  searches: PerplexitySearchParams[],
  apiKey: string,
  delayMs = 1000 // Perplexity has rate limits, so use 1s delay
): Promise<{
  results: SearchResult[];
  successCount: number;
  failCount: number;
  rateLimitHit: boolean;
}> {
  const allResults: SearchResult[] = [];
  let successCount = 0;
  let failCount = 0;
  let rateLimitHit = false;

  console.log(`Starting ${searches.length} Perplexity searches...`);

  for (let i = 0; i < searches.length; i++) {
    try {
      const results = await perplexitySearch(searches[i], apiKey);
      
      if (results.length > 0) {
        allResults.push(...results);
        successCount++;
      } else {
        failCount++;
      }

      // Progress logging
      if ((i + 1) % 3 === 0 || i === searches.length - 1) {
        console.log(`Progress: ${i + 1}/${searches.length} searches | ${successCount} with results | ${failCount} empty | ${allResults.length} total articles`);
      }

    } catch (error) {
      console.error(`Search ${i + 1} failed:`, error);
      failCount++;
      
      if (error instanceof Error && error.message.includes('rate limit')) {
        rateLimitHit = true;
        console.warn(`⚠️ Rate limit hit at search ${i + 1}/${searches.length}, stopping batch`);
        break;
      }
    }

    // Rate limiting delay between searches
    if (i < searches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  console.log(`Perplexity search complete: ${successCount} successful, ${failCount} failed, ${allResults.length} total articles`);
  
  return {
    results: allResults,
    successCount,
    failCount,
    rateLimitHit
  };
}
