/**
 * Perplexity AI-powered search helper
 * Uses sonar-pro model for real-time web search with structured citations
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

interface PerplexitySearchResult {
  title?: string;
  url: string;
  snippet?: string;
  text?: string;
  date?: string;
  published_date?: string;
  last_updated?: string;
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
    
    // Extract structured search results (most reliable source)
    const searchResults: PerplexitySearchResult[] = data.search_results || [];
    const citations: string[] = data.citations || [];
    
    const results: SearchResult[] = [];

    // PRIMARY: Use structured search_results from Perplexity API
    if (searchResults && searchResults.length > 0) {
      console.log(`✓ Found ${searchResults.length} search results from Perplexity API`);
      
      for (const result of searchResults) {
        // Perplexity provides title, url, snippet, and optional date
        results.push({
          title: result.title || extractTitleFromUrl(result.url),
          url: result.url,
          snippet: result.snippet || result.text || '',
          publishedDate: result.date || result.published_date || result.last_updated
        });
      }
    } 
    // FALLBACK: If no structured results, use citations
    else if (citations && citations.length > 0) {
      console.log(`Using ${citations.length} citations as fallback (no structured results)`);
      
      for (const url of citations) {
        results.push({
          title: extractTitleFromUrl(url),
          url,
          snippet: '',
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
 * Extract a readable title from URL as fallback
 */
function extractTitleFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    
    // Get the last meaningful path segment
    const pathParts = pathname
      .split('/')
      .filter(p => p && p.length > 2 && !p.match(/^\d+$/)); // Filter out empty and numeric-only parts
    
    if (pathParts.length > 0) {
      const lastPart = pathParts[pathParts.length - 1];
      
      // Clean up the path segment
      const title = lastPart
        .replace(/[-_]/g, ' ')
        .replace(/\.(html|htm|php|asp|aspx|jsp)$/i, '')
        .split(' ')
        .map(word => {
          // Capitalize first letter of each word
          if (word.length > 0) {
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
          }
          return word;
        })
        .join(' ')
        .trim();
      
      if (title && title.length >= 5) {
        return title.substring(0, 100);
      }
    }
    
    // Last fallback: use domain name
    return `Article from ${urlObj.hostname.replace('www.', '')}`;
  } catch {
    return 'News Article';
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
