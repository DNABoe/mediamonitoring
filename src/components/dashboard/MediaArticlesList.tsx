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
  publishedAt: string;
  fighters: string[];
  sourceCountry: string;
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

  useEffect(() => {
    fetchMediaArticles();
  }, [activeCountry, activeCompetitors, prioritizedOutlets]);

  const fetchMediaArticles = async () => {
    try {
      setLoading(true);
      console.log('Searching for fighter articles using AI...');
      
      // Filter only active outlets
      const activeOutlets = prioritizedOutlets
        .filter(outlet => outlet.active)
        .map(outlet => outlet.name);
      
      const { data, error } = await supabase.functions.invoke('search-fighter-articles', {
        body: { 
          country: activeCountry,
          competitors: activeCompetitors,
          prioritizedOutlets: activeOutlets
        }
      });

      if (error) throw error;

      if (data?.success && data?.articles) {
        console.log(`Found ${data.articles.length} articles`);
        // Sort by date, newest first
        const sortedArticles = data.articles.sort((a: MediaArticle, b: MediaArticle) => {
          return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
        });
        setMediaArticles(sortedArticles);
        
        if (data.articles.length === 0) {
          toast({
            title: "No articles found",
            description: "No recent articles found about fighter procurement. Try again later.",
            duration: 3000,
          });
        }
      } else {
        throw new Error(data?.error || 'Failed to fetch articles');
      }
    } catch (error) {
      console.error('Error fetching media articles:', error);
      toast({
        title: "Error",
        description: "Failed to search for articles. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
      setMediaArticles([]);
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
  const localArticles = mediaArticles.filter(article => article.sourceCountry === activeCountry);
  const internationalArticles = mediaArticles.filter(article => article.sourceCountry !== activeCountry);

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
          {article.sourceCountry}
        </Badge>
        <span>•</span>
        <span>
          {(() => {
            const date = new Date(article.publishedAt);
            return isNaN(date.getTime()) ? 'Recent' : format(date, 'MMM d, yyyy');
          })()}
        </span>
      </div>
      
      <div className="flex flex-wrap gap-1">
        {article.fighters.map((fighter) => (
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
            <h2 className="text-2xl font-bold">Key Media References (Last 60 Days)</h2>
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
          Articles discussing fighter procurement programs from {activeCountry} and international sources
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
                <h3 className="text-lg font-semibold">Local Media ({activeCountry})</h3>
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
