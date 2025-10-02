import { Card } from "@/components/ui/card";
import { ExternalLink, Newspaper } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface Article {
  id: string;
  title_en: string;
  url: string;
  published_at: string;
  fighter_tags: string[];
  sentiment: number;
  source_id: string;
}

interface Source {
  id: string;
  name: string;
}

export const SourceArticles = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [sources, setSources] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchArticles = async () => {
      setLoading(true);
      
      // Fetch recent fighter-related articles
      const { data: items } = await supabase
        .from('items')
        .select('id, title_en, url, published_at, fighter_tags, sentiment, source_id')
        .not('fighter_tags', 'is', null)
        .order('published_at', { ascending: false })
        .limit(20);

      if (items) {
        setArticles(items as Article[]);
        
        // Fetch source names
        const sourceIds = [...new Set(items.map(i => i.source_id).filter(Boolean))];
        if (sourceIds.length > 0) {
          const { data: sourcesData } = await supabase
            .from('sources')
            .select('id, name')
            .in('id', sourceIds);
          
          if (sourcesData) {
            const sourceMap: Record<string, string> = {};
            sourcesData.forEach((s: Source) => {
              sourceMap[s.id] = s.name;
            });
            setSources(sourceMap);
          }
        }
      }
      
      setLoading(false);
    };

    fetchArticles();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('items-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'items' },
        () => fetchArticles()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getSentimentColor = (sentiment: number) => {
    if (sentiment > 0.3) return "text-success";
    if (sentiment < -0.3) return "text-destructive";
    return "text-muted-foreground";
  };

  const getSentimentLabel = (sentiment: number) => {
    if (sentiment > 0.3) return "Positive";
    if (sentiment < -0.3) return "Negative";
    return "Neutral";
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Newspaper className="h-5 w-5 text-primary" />
          <h3 className="text-xl font-bold">Source Articles</h3>
        </div>
        <div className="text-sm text-muted-foreground">Loading articles...</div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Newspaper className="h-5 w-5 text-primary" />
          <h3 className="text-xl font-bold">Source Articles</h3>
        </div>
        <Badge variant="secondary">{articles.length} articles</Badge>
      </div>

      <div className="space-y-3 max-h-[600px] overflow-y-auto">
        {articles.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            No articles found. Run the scraper to fetch articles.
          </div>
        ) : (
          articles.map((article) => (
            <div
              key={article.id}
              className="p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm mb-2 line-clamp-2">
                    {article.title_en || 'Untitled'}
                  </h4>
                  
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {article.fighter_tags?.map((tag) => (
                      <Badge
                        key={tag}
                        variant={tag === 'Gripen' ? 'default' : 'destructive'}
                        className="text-xs"
                      >
                        {tag}
                      </Badge>
                    ))}
                    <span className={`text-xs font-medium ${getSentimentColor(article.sentiment)}`}>
                      {getSentimentLabel(article.sentiment)}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {article.source_id && sources[article.source_id] && (
                      <span>{sources[article.source_id]}</span>
                    )}
                    {article.published_at && (
                      <span>
                        {format(new Date(article.published_at), 'MMM d, yyyy HH:mm')}
                      </span>
                    )}
                  </div>
                </div>
                
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 p-2 hover:bg-accent rounded-md transition-colors"
                  title="Open article"
                >
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </a>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
};
