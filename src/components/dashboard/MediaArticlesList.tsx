import { Card } from "@/components/ui/card";
import { Loader2, ExternalLink, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { ArticleDetail } from "./ArticleDetail";
import { ArticleFilters } from "./ArticleFilters";
import { useArticleFilters } from "@/hooks/useArticleFilters";
import { useRealtimeArticles } from "@/hooks/useRealtimeArticles";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";

interface MediaArticle {
  id: string;
  title: string;
  titleOriginal?: string;
  url: string;
  source: string;
  published_at: string;
  fighter_tags: string[];
  source_country: string;
  sentiment?: number;
}

interface MediaArticlesListProps {
  activeCountry: string;
  activeCompetitors: string[];
  prioritizedOutlets?: Array<{ name: string; active: boolean }>;
}

export const MediaArticlesList = ({ activeCountry, activeCompetitors, prioritizedOutlets = [] }: MediaArticlesListProps) => {
  const [mediaArticles, setMediaArticles] = useState<MediaArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<any>(null);
  const [lastFetchTime, setLastFetchTime] = useState<Date>(new Date());
  const [currentPage, setCurrentPage] = useState(1);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const articlesPerPage = 20;
  const { toast } = useToast();
  
  const { newArticlesCount, resetNewCount } = useRealtimeArticles({
    activeCountry,
    activeCompetitors,
    autoRefreshEnabled
  });

  const {
    filters,
    filteredArticles,
    setSearchText,
    setDateRange,
    setSentiment,
    setSourceType,
    setCompetitors,
    clearFilters,
    activeFilterCount
  } = useArticleFilters(mediaArticles);

  // Helper function to extract source name from URL
  const extractSourceFromUrl = (url: string): string => {
    try {
      const hostname = new URL(url).hostname;
      // Remove www. and get main domain
      return hostname.replace('www.', '').split('.')[0].toUpperCase();
    } catch {
      return 'Unknown Source';
    }
  };

  useEffect(() => {
    fetchMediaArticles();
  }, [activeCountry, activeCompetitors]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    if (!autoRefreshEnabled) return;

    const interval = setInterval(() => {
      fetchMediaArticles();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [activeCountry, activeCompetitors, autoRefreshEnabled]);

  const collectNewArticles = async () => {
    try {
      setLoading(true);
      console.log('=== COLLECT ARTICLES START ===');
      console.log('Active country:', activeCountry);
      console.log('Active competitors:', activeCompetitors);

      const { data: { user } } = await supabase.auth.getUser();
      console.log('User authenticated:', !!user);
      console.log('User ID:', user?.id);
      
      if (!user) {
        console.error('No user authenticated');
        toast({
          title: "Authentication required",
          description: "Please log in to collect articles",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Collecting articles...",
        description: "This may take a few minutes. You'll be notified when complete.",
      });

      // Calculate date range: 60 days ago to today
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 60);

      const requestBody = {
        country: activeCountry,
        competitors: activeCompetitors,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      };
      
      console.log('Invoking collect-articles-for-tracking with:', requestBody);
      console.log('Function URL:', `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/collect-articles-for-tracking`);

      const { data, error } = await supabase.functions.invoke('collect-articles-for-tracking', {
        body: requestBody
      });

      console.log('Function response data:', data);
      console.log('Function response error:', error);

      if (error) {
        console.error('Function invocation error:', error);
        throw error;
      }

      console.log('Collection successful. Total saved:', data?.totalSaved);
      
      // Check for quota issues
      if (data?.quotaExceeded) {
        toast({
          title: "Quota limit reached",
          description: `Collected ${data?.totalSaved || 0} articles before hitting Google API quota. ${data?.searchStats?.success || 0}/${data?.searchStats?.total || 0} searches completed. Try again tomorrow.`,
          variant: "destructive",
          duration: 8000,
        });
      } else {
        toast({
          title: "Collection complete",
          description: `Collected ${data?.totalSaved || 0} new articles. ${data?.searchStats?.success || 0}/${data?.searchStats?.total || 0} searches successful.`,
          duration: 5000,
        });
      }

      // Refresh the list
      console.log('Refreshing article list...');
      await fetchMediaArticles();
      console.log('=== COLLECT ARTICLES END ===');
    } catch (error: any) {
      console.error('=== COLLECT ARTICLES ERROR ===');
      console.error('Error type:', error.constructor.name);
      console.error('Error message:', error.message);
      console.error('Error details:', error);
      console.error('Error stack:', error.stack);
      
      // Check if it's a quota error
      const isQuotaError = error.message?.toLowerCase().includes('quota') || 
                          error.message?.toLowerCase().includes('429') ||
                          error.message?.toLowerCase().includes('rate limit');
      
      toast({
        title: isQuotaError ? "Google API Quota Exceeded" : "Collection failed",
        description: isQuotaError 
          ? "Daily Google API quota limit reached (100 searches/day). Try again tomorrow or upgrade your Google API key."
          : error.message || "Failed to collect articles. Please try again.",
        variant: "destructive",
        duration: isQuotaError ? 10000 : 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMediaArticles = async () => {
    try {
      setLoading(true);
      console.log('Fetching recent media articles from database...');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please log in to view articles",
          variant: "destructive",
        });
        return;
      }

      // Calculate date 6 months ago
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const startDate = sixMonthsAgo.toISOString();

      // Fetch articles from database (last 6 months) for this user and country
      const { data: items, error } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', user.id)
        .eq('tracking_country', activeCountry)
        .gte('published_at', startDate)
        .order('published_at', { ascending: false });

      if (error) throw error;

      // Transform database items to MediaArticle format
      const fetchedArticles: MediaArticle[] = (items || []).map(item => ({
        id: item.id,
        title: item.title_en || item.title_pt || 'Untitled',
        titleOriginal: item.title_pt && item.title_en ? item.title_pt : undefined,
        url: item.url,
        source: extractSourceFromUrl(item.url),
        published_at: item.published_at,
        fighter_tags: item.fighter_tags || [],
        source_country: item.source_country || 'INTERNATIONAL',
        sentiment: item.sentiment || 0
      }));

      // Filter by active competitors + Gripen
      const filteredArticles = fetchedArticles.filter(article => {
        const fightersToTrack = [...activeCompetitors, 'Gripen'];
        return article.fighter_tags.some(tag => 
          fightersToTrack.some(fighter => 
            tag.toLowerCase().includes(fighter.toLowerCase())
          )
        );
      });

      setMediaArticles(filteredArticles);
      setLastFetchTime(new Date());
      resetNewCount();
      console.log(`Loaded ${filteredArticles.length} recent articles from database`);
      
      if (filteredArticles.length === 0) {
        toast({
          title: "No articles found",
          description: "Click 'Collect Articles' to gather recent media coverage.",
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Error fetching media articles:', error);
      toast({
        title: "Error",
        description: "Failed to load articles. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Card>
    );
  }

  // Separate articles by local vs international
  const activePrioritizedOutlets = prioritizedOutlets
    .filter(outlet => outlet.active)
    .map(outlet => outlet.name.toLowerCase());
  
  const localArticles = filteredArticles.filter(article => {
    if (activePrioritizedOutlets.length > 0) {
      return activePrioritizedOutlets.some(outlet => 
        article.source.toLowerCase().includes(outlet) || 
        article.url.toLowerCase().includes(outlet)
      );
    }
    return article.source_country === activeCountry;
  });
  
  const internationalArticles = filteredArticles.filter(article => {
    if (activePrioritizedOutlets.length > 0) {
      return !activePrioritizedOutlets.some(outlet => 
        article.source.toLowerCase().includes(outlet) || 
        article.url.toLowerCase().includes(outlet)
      );
    }
    return article.source_country !== activeCountry;
  });

  // Pagination
  const allArticles = [...localArticles, ...internationalArticles];
  const totalPages = Math.ceil(allArticles.length / articlesPerPage);
  const startIndex = (currentPage - 1) * articlesPerPage;
  const endIndex = startIndex + articlesPerPage;
  const paginatedArticles = allArticles.slice(startIndex, endIndex);
  
  const paginatedLocal = paginatedArticles.filter(a => localArticles.includes(a));
  const paginatedInternational = paginatedArticles.filter(a => internationalArticles.includes(a));

  const ArticleCard = ({ article, index }: { article: MediaArticle; index: number }) => (
    <div 
      key={`${article.url}-${index}`}
      className="p-3 bg-background/50 rounded-lg border border-border/50 hover:border-primary/30 transition-colors cursor-pointer"
      onClick={() => setSelectedArticle(article)}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1">
          <h3 className="font-semibold text-base text-foreground hover:text-primary transition-colors leading-snug mb-1">
            {article.title}
          </h3>
          {article.titleOriginal && (
            <p className="text-sm text-muted-foreground italic">
              Original: {article.titleOriginal}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            window.open(article.url, '_blank');
          }}
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        <span className="font-medium">{article.source}</span>
        <span>•</span>
        <Badge variant="outline" className="text-xs py-0 h-5">
          {article.source_country}
        </Badge>
        <span>•</span>
        <span className="font-medium">
          {(() => {
            const date = new Date(article.published_at);
            return isNaN(date.getTime()) ? 'Recent' : format(date, 'MMM d, yyyy');
          })()}
        </span>
      </div>
      
      <div className="flex flex-wrap gap-1">
        {article.fighter_tags.map((fighter) => (
          <Badge 
            key={fighter} 
            variant="secondary" 
            className="text-xs py-0 h-5"
          >
            {fighter}
          </Badge>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ExternalLink className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-bold">Media Monitoring - Fighter Procurement</h2>
              {newArticlesCount > 0 && (
                <Badge variant="default" className="animate-pulse">
                  {newArticlesCount} new
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="text-xs text-muted-foreground">
                Last updated: {formatDistanceToNow(lastFetchTime, { addSuffix: true })}
              </div>
              <Button 
                onClick={collectNewArticles} 
                variant="default" 
                size="sm"
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Collect Articles
              </Button>
              <Button 
                onClick={fetchMediaArticles} 
                variant="outline" 
                size="sm"
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
          
          <p className="text-sm text-muted-foreground">
            Monitoring media coverage of Gripen vs {activeCompetitors.join(', ')} in {activeCountry} fighter procurement (Last 6 months)
          </p>

          <ArticleFilters
            filters={filters}
            onSearchChange={setSearchText}
            onDateRangeChange={setDateRange}
            onSentimentChange={setSentiment}
            onSourceTypeChange={setSourceType}
            onCompetitorsChange={setCompetitors}
            onClearFilters={clearFilters}
            activeFilterCount={activeFilterCount}
            availableCompetitors={['Gripen', ...activeCompetitors]}
          />

          <div className="text-sm text-muted-foreground">
            Showing {startIndex + 1}-{Math.min(endIndex, allArticles.length)} of {allArticles.length} articles
            {activeFilterCount > 0 && ` (filtered from ${mediaArticles.length} total)`}
          </div>

          {allArticles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No media articles found
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Local Media Column */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Local Media</h3>
                    <Badge variant="secondary">{localArticles.length}</Badge>
                  </div>
                  {paginatedLocal.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No local articles on this page
                    </div>
                  ) : (
                    <ScrollArea className="h-[600px] pr-4">
                      <div className="space-y-2">
                        {paginatedLocal.map((article, index) => (
                          <ArticleCard key={`local-${article.id}-${index}`} article={article} index={index} />
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>

                {/* International Media Column */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">International Media</h3>
                    <Badge variant="secondary">{internationalArticles.length}</Badge>
                  </div>
                  {paginatedInternational.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No international articles on this page
                    </div>
                  ) : (
                    <ScrollArea className="h-[600px] pr-4">
                      <div className="space-y-2">
                        {paginatedInternational.map((article, index) => (
                          <ArticleCard key={`intl-${article.id}-${index}`} article={article} index={index} />
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <PaginationItem key={pageNum}>
                          <PaginationLink
                            onClick={() => setCurrentPage(pageNum)}
                            isActive={currentPage === pageNum}
                            className="cursor-pointer"
                          >
                            {pageNum}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    })}
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </>
          )}
        </div>
      </Card>

      {selectedArticle && (
        <ArticleDetail
          article={selectedArticle}
          isOpen={!!selectedArticle}
          onClose={() => setSelectedArticle(null)}
          competitors={['Gripen', ...activeCompetitors]}
        />
      )}
    </>
  );
};
