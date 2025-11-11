/**
 * Perplexity AI-powered search helper
 * Replaces Google Custom Search API with AI-powered search
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

  // Build enhanced query with domain filtering and recency hints
  let enhancedQuery = query;
  
  if (domains && domains.length > 0) {
    enhancedQuery += ` site:${domains.join(' OR site:')}`;
  }
  
  if (country) {
    enhancedQuery += ` ${country}`;
  }

  const systemPrompt = `You are a news article search assistant. Search for recent news articles about the query and return ONLY articles that:
1. Are from credible news sources
2. Match the search criteria
3. Are recent (within the specified timeframe)
4. Contain substantive information about the topic

For each article, extract:
- Exact title as it appears on the source
- Full URL
- Brief snippet (1-2 sentences describing the content)
- Publication date if available

Return results in a structured format that can be parsed.`;

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: `Search for: ${enhancedQuery}\n\nFind the most relevant recent news articles and provide their titles, URLs, and brief descriptions.`
          }
        ],
        temperature: 0.2,
        top_p: 0.9,
        max_tokens: 2000,
        return_images: false,
        return_related_questions: false,
        search_recency_filter: recencyFilter,
        frequency_penalty: 1,
        presence_penalty: 0
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
    const content = data.choices?.[0]?.message?.content || '';
    const citations = data.citations || [];

    // Parse the AI response to extract structured results
    const results: SearchResult[] = [];

    // Try to extract URLs from citations first (most reliable)
    if (citations && citations.length > 0) {
      for (const url of citations) {
        // Try to find corresponding title/snippet in the content
        const urlPattern = new RegExp(`\\[.*?\\]\\(${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`, 'i');
        const match = content.match(urlPattern);
        
        let title = 'Untitled';
        if (match) {
          title = match[0].replace(/\[|\]\(.*\)/g, '');
        }

        results.push({
          title,
          url,
          snippet: content.substring(0, 200), // Use portion of content as snippet
          publishedDate: undefined
        });
      }
    }

    // Also try to parse markdown-style links from content
    const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
    let linkMatch;
    
    while ((linkMatch = linkPattern.exec(content)) !== null) {
      const [, title, url] = linkMatch;
      
      // Skip if already added from citations
      if (!results.some(r => r.url === url)) {
        results.push({
          title: title.trim(),
          url: url.trim(),
          snippet: content.substring(Math.max(0, linkMatch.index - 100), linkMatch.index + 100),
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
