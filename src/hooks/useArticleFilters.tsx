import { useState, useMemo } from 'react';
import { format, isAfter, isBefore, parseISO } from 'date-fns';

export interface ArticleFiltersState {
  searchText: string;
  dateFrom: Date | null;
  dateTo: Date | null;
  sentiment: 'all' | 'positive' | 'neutral' | 'negative';
  sourceType: 'all' | 'local' | 'international';
  competitors: string[];
}

export const useArticleFilters = (articles: any[]) => {
  const [filters, setFilters] = useState<ArticleFiltersState>({
    searchText: '',
    dateFrom: null,
    dateTo: null,
    sentiment: 'all',
    sourceType: 'all',
    competitors: []
  });

  const filteredArticles = useMemo(() => {
    return articles.filter(article => {
      // Text search
      if (filters.searchText) {
        const searchLower = filters.searchText.toLowerCase();
        const titleMatch = article.title?.toLowerCase().includes(searchLower);
        const sourceMatch = article.source?.toLowerCase().includes(searchLower);
        if (!titleMatch && !sourceMatch) return false;
      }

      // Date range
      if (filters.dateFrom) {
        const articleDate = parseISO(article.published_at);
        if (isBefore(articleDate, filters.dateFrom)) return false;
      }
      if (filters.dateTo) {
        const articleDate = parseISO(article.published_at);
        if (isAfter(articleDate, filters.dateTo)) return false;
      }

      // Sentiment filter
      if (filters.sentiment !== 'all') {
        const sentiment = article.sentiment || 0;
        if (filters.sentiment === 'positive' && sentiment <= 0) return false;
        if (filters.sentiment === 'negative' && sentiment >= 0) return false;
        if (filters.sentiment === 'neutral' && Math.abs(sentiment) > 0.1) return false;
      }

      // Competitor filter - always include Gripen
      if (filters.competitors.length > 0) {
        const hasGripen = article.fighter_tags?.some((tag: string) => 
          tag.toLowerCase().includes('gripen')
        );
        const hasSelectedCompetitor = filters.competitors.some(comp =>
          article.fighter_tags?.some((tag: string) => 
            tag.toLowerCase().includes(comp.toLowerCase())
          )
        );
        // Include if it has Gripen OR any selected competitor
        if (!hasGripen && !hasSelectedCompetitor) return false;
      }

      return true;
    });
  }, [articles, filters]);

  const setSearchText = (text: string) => {
    setFilters(prev => ({ ...prev, searchText: text }));
  };

  const setDateRange = (from: Date | null, to: Date | null) => {
    setFilters(prev => ({ ...prev, dateFrom: from, dateTo: to }));
  };

  const setSentiment = (sentiment: ArticleFiltersState['sentiment']) => {
    setFilters(prev => ({ ...prev, sentiment }));
  };

  const setSourceType = (sourceType: ArticleFiltersState['sourceType']) => {
    setFilters(prev => ({ ...prev, sourceType }));
  };

  const setCompetitors = (competitors: string[]) => {
    setFilters(prev => ({ ...prev, competitors }));
  };

  const clearFilters = () => {
    setFilters({
      searchText: '',
      dateFrom: null,
      dateTo: null,
      sentiment: 'all',
      sourceType: 'all',
      competitors: []
    });
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.searchText) count++;
    if (filters.dateFrom || filters.dateTo) count++;
    if (filters.sentiment !== 'all') count++;
    if (filters.sourceType !== 'all') count++;
    if (filters.competitors.length > 0) count++;
    return count;
  }, [filters]);

  return {
    filters,
    filteredArticles,
    setSearchText,
    setDateRange,
    setSentiment,
    setSourceType,
    setCompetitors,
    clearFilters,
    activeFilterCount
  };
};