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

      // Calculate date 60 days ago
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      // Fetch recent fighter-related articles (max 60 days old)
      const {
        data: items
      } = await supabase.from('items').select('id, title_en, url, published_at, fighter_tags, sentiment, source_id').not('fighter_tags', 'is', null).gte('published_at', sixtyDaysAgo.toISOString()).order('published_at', {
        ascending: false
      }).limit(20);
      if (items) {
        setArticles(items as Article[]);

        // Fetch source names
        const sourceIds = [...new Set(items.map(i => i.source_id).filter(Boolean))];
        if (sourceIds.length > 0) {
          const {
            data: sourcesData
          } = await supabase.from('sources').select('id, name').in('id', sourceIds);
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
    const channel = supabase.channel('items-changes').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'items'
    }, () => fetchArticles()).subscribe();
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
    return <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Newspaper className="h-5 w-5 text-primary" />
          <h3 className="text-xl font-bold">Source Articles</h3>
        </div>
        <div className="text-sm text-muted-foreground">Loading articles...</div>
      </Card>;
  }
  return;
};