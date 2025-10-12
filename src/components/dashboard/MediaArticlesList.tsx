import { Card } from "@/components/ui/card";
import { Loader2, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MediaArticle {
  id: string;
  title_en: string | null;
  title_pt: string | null;
  url: string;
  published_at: string;
  source: {
    name: string;
    type: string;
    country: string;
  };
  fighter_tags: string[];
}

export const MediaArticlesList = () => {
  const [mediaArticles, setMediaArticles] = useState<MediaArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMediaArticles();

    const itemsChannel = supabase
      .channel('items-articles-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'items'
      }, () => {
        fetchMediaArticles();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(itemsChannel);
    };
  }, []);

  const fetchMediaArticles = async () => {
    try {
      const sixtyDaysAgo = subDays(new Date(), 60);
      
      const { data: items, error } = await supabase
        .from('items')
        .select(`
          id,
          title_en,
          title_pt,
          url,
          published_at,
          fighter_tags,
          sources (
            name,
            type,
            country
          )
        `)
        .gte('published_at', sixtyDaysAgo.toISOString())
        .not('fighter_tags', 'is', null)
        .order('published_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Filter for articles that actually have fighter tags (not empty arrays) and valid sources
      // Prioritize local Portuguese media (country = 'PT')
      const articlesWithSources = items?.map(item => ({
        id: item.id,
        title_en: item.title_en,
        title_pt: item.title_pt,
        url: item.url,
        published_at: item.published_at,
        fighter_tags: item.fighter_tags || [],
        source: Array.isArray(item.sources) ? item.sources[0] : item.sources
      }))
      .filter(article => 
        article.source && 
        (article.title_en || article.title_pt) && 
        article.fighter_tags.length > 0
      )
      .sort((a, b) => {
        // Prioritize PT sources first
        if (a.source.country === 'PT' && b.source.country !== 'PT') return -1;
        if (a.source.country !== 'PT' && b.source.country === 'PT') return 1;
        // Then sort by date
        return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
      }) || [];

      setMediaArticles(articlesWithSources);
    } catch (error) {
      console.error('Error fetching media articles:', error);
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

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <ExternalLink className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Key Media References (Last 60 Days)</h2>
        </div>
        
        <p className="text-sm text-muted-foreground">
          Articles discussing fighter procurement programs and selected platforms
        </p>

        {mediaArticles.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No media articles found
          </div>
        ) : (
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-2">
              {mediaArticles.map((article) => (
                <div 
                  key={article.id}
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
                        {article.title_en || article.title_pt}
                      </h3>
                      <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-0.5" />
                    </div>
                  </a>
                  
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <span className="font-medium">{article.source.name}</span>
                    <span>•</span>
                    <Badge variant="outline" className="text-xs py-0 h-5">
                      {article.source.country}
                    </Badge>
                    <span>•</span>
                    <span>{format(new Date(article.published_at), 'MMM d, yyyy')}</span>
                  </div>
                  
                  <div className="flex flex-wrap gap-1">
                    {article.fighter_tags.map((tag) => (
                      <Badge 
                        key={tag} 
                        variant="secondary" 
                        className="text-xs py-0 h-5"
                      >
                        {tag}
                      </Badge>
                    ))}
                    <Badge variant="outline" className="text-xs py-0 h-5">
                      {article.source.type}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </Card>
  );
};
