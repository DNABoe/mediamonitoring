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

  // Build enhanced query with domain filtering - Perplexity format
  let enhancedQuery = query;
  
  // Add domain filtering in natural language for better Perplexity processing
  if (domains && domains.length > 0) {
    const topDomains = domains.slice(0, 8); // Increase domain coverage
    const domainStr = topDomains.join(', ');
    enhancedQuery = `Find articles from these sources: ${domainStr}. Search: ${query}`;
  }
  
  if (country) {
    enhancedQuery += ` ${country}`;
  }

  // Add explicit instruction for comprehensive results
  enhancedQuery = `${enhancedQuery}. Find comprehensive, accurate news articles with verified URLs.`;

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar', // Use sonar (not sonar-pro) for better search_results structure
        messages: [
          {
            role: 'system',
            content: 'You are a news research assistant. Find and cite accurate, verified news articles. Always return proper citations with titles, URLs, and publication dates.'
          },
          {
            role: 'user',
            content: enhancedQuery
          }
        ],
        temperature: 0.1, // Low temperature for factual accuracy
        top_p: 0.95,
        return_images: false,
        return_related_questions: false,
        search_recency_filter: recencyFilter,
        return_citations: true,
        search_domain_filter: domains && domains.length > 0 ? domains.slice(0, 10) : undefined
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
    console.log(`Perplexity response structure: ${Object.keys(data).join(', ')}`);
    
    // Extract content from AI message for parsing
    const messageContent = data.choices?.[0]?.message?.content || '';
    
    // Extract structured search results (most reliable source)
    const searchResults: PerplexitySearchResult[] = data.search_results || [];
    const citations: string[] = data.citations || [];
    
    const results: SearchResult[] = [];

    // PRIMARY: Use structured search_results from Perplexity API
    if (searchResults && searchResults.length > 0) {
      console.log(`✓ Found ${searchResults.length} structured search results from Perplexity`);
      
      for (const result of searchResults) {
        // Validate URL before adding
        if (!result.url || !result.url.startsWith('http')) {
          console.warn(`Skipping invalid URL: ${result.url}`);
          continue;
        }
        
        // Perplexity provides title, url, snippet, and optional date
        results.push({
          title: result.title || extractTitleFromUrl(result.url),
          url: result.url,
          snippet: result.snippet || result.text || '',
          publishedDate: result.date || result.published_date || result.last_updated
        });
      }
    } 
    // SECONDARY: Parse citations from message content for additional sources
    else if (citations && citations.length > 0) {
      console.log(`Extracting ${citations.length} citations from message`);
      
      for (const url of citations) {
        if (!url || !url.startsWith('http')) {
          console.warn(`Skipping invalid citation: ${url}`);
          continue;
        }
        
        // Try to extract title from message content near this URL
        let title = extractTitleFromUrl(url);
        const urlIndex = messageContent.indexOf(url);
        if (urlIndex > 0) {
          // Look for text before URL (potential title)
          const beforeUrl = messageContent.substring(Math.max(0, urlIndex - 200), urlIndex);
          const titleMatch = beforeUrl.match(/["']([^"']{20,150})["']/);
          if (titleMatch) {
            title = titleMatch[1];
          }
        }
        
        results.push({
          title,
          url,
          snippet: '',
          publishedDate: undefined
        });
      }
    }

    console.log(`✓ Perplexity extracted ${results.length} verified articles for: "${query.substring(0, 60)}"`);
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
