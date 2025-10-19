import { Card } from "@/components/ui/card";
import { Loader2, ExternalLink, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

interface MediaArticle {
  title: string;
  url: string;
  source: string;
  published_at: string;
  fighter_tags: string[];
  source_country: string;
}

interface MediaArticlesListProps {
  activeCountry: string;
  activeCompetitors: string[];
  prioritizedOutlets?: Array<{ name: string; active: boolean }>;
}

export const MediaArticlesList = ({ activeCountry, activeCompetitors, prioritizedOutlets = [] }: MediaArticlesListProps) => {
  const [mediaArticles, setMediaArticles] = useState<MediaArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

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
        title: item.title_en || item.title_pt || 'Untitled',
        url: item.url,
        source: extractSourceFromUrl(item.url),
        published_at: item.published_at,
        fighter_tags: item.fighter_tags || [],
        source_country: item.source_country || 'INTERNATIONAL'
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
      console.log(`Loaded ${filteredArticles.length} recent articles from database`);
      
      if (filteredArticles.length === 0) {
        toast({
          title: "No articles found",
          description: "No recent articles found. Try setting a tracking period or refreshing.",
          duration: 3000,
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
  // ALWAYS prioritize articles from outlets in prioritizedOutlets list, regardless of activeCountry
  const activePrioritizedOutlets = prioritizedOutlets
    .filter(outlet => outlet.active)
    .map(outlet => outlet.name.toLowerCase());
  
  const localArticles = mediaArticles.filter(article => {
    // If we have prioritized outlets, use those to determine "local"
    if (activePrioritizedOutlets.length > 0) {
      return activePrioritizedOutlets.some(outlet => 
        article.source.toLowerCase().includes(outlet) || 
        article.url.toLowerCase().includes(outlet)
      );
    }
    // Otherwise fall back to country matching
    return article.source_country === activeCountry;
  });
  
  const internationalArticles = mediaArticles.filter(article => {
    // If we have prioritized outlets, anything NOT in that list is international
    if (activePrioritizedOutlets.length > 0) {
      return !activePrioritizedOutlets.some(outlet => 
        article.source.toLowerCase().includes(outlet) || 
        article.url.toLowerCase().includes(outlet)
      );
    }
    // Otherwise fall back to country matching
    return article.source_country !== activeCountry;
  });

  const ArticleCard = ({ article, index }: { article: MediaArticle; index: number }) => (
    <div 
      key={`${article.url}-${index}`}
      className="p-3 bg-background/50 rounded-lg border border-border/50 hover:border-primary/30 transition-colors"
    >
      <a 
        href={article.url} 
        target="_blank" 
        rel="noopener noreferrer"
        className="group"
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-base text-foreground group-hover:text-primary transition-colors flex-1 leading-snug">
            {article.title}
          </h3>
          <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-0.5" />
        </div>
      </a>
      
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        <span className="font-medium">{article.source}</span>
        <span>•</span>
        <Badge variant="outline" className="text-xs py-0 h-5">
          {article.source_country}
        </Badge>
        <span>•</span>
        <span>
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
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ExternalLink className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold">Media Monitoring - Fighter Procurement</h2>
          </div>
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
        
        <p className="text-sm text-muted-foreground">
          Monitoring media coverage of Gripen vs {activeCompetitors.join(', ')} in {activeCountry} fighter procurement (Last 6 months)
        </p>

        {mediaArticles.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No media articles found
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Local Media Column */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Local Media</h3>
                <Badge variant="secondary">{localArticles.length}</Badge>
              </div>
              {localArticles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No local articles found
                </div>
              ) : (
                <ScrollArea className="h-[600px] pr-4">
                  <div className="space-y-2">
                    {localArticles.map((article, index) => (
                      <ArticleCard key={`local-${article.url}-${index}`} article={article} index={index} />
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
              {internationalArticles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No international articles found
                </div>
              ) : (
                <ScrollArea className="h-[600px] pr-4">
                  <div className="space-y-2">
                    {internationalArticles.map((article, index) => (
                      <ArticleCard key={`intl-${article.url}-${index}`} article={article} index={index} />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
