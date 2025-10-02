import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Item {
  id: string;
  title_en: string;
  published_at: string;
  url: string;
  fighter_tags: string[];
  sentiment: number;
  sources: { name: string; type: string };
  engagement: any;
}

export const LiveStream = () => {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    const fetchItems = async () => {
      const { data } = await supabase
        .from('items')
        .select('*, sources(name, type)')
        .order('published_at', { ascending: false })
        .limit(20);

      if (data) {
        setItems(data as any);
      }
    };

    fetchItems();

    const channel = supabase
      .channel('items-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'items' },
        () => fetchItems()
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

  return (
    <Card className="p-6">
      <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
        <span className="animate-pulse">🔴</span>
        Live Stream
      </h3>

      <div className="space-y-3 max-h-[600px] overflow-y-auto">
        {items.map((item) => (
          <div
            key={item.id}
            className="p-4 rounded-lg bg-secondary/50 border border-border hover:border-primary transition-all"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs">
                    {item.sources?.name || 'Unknown'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {item.published_at
                      ? formatDistanceToNow(new Date(item.published_at), { addSuffix: true })
                      : 'Recently'}
                  </span>
                </div>
                <h4 className="font-semibold text-sm leading-tight mb-2">
                  {item.title_en || 'No title'}
                </h4>
                <div className="flex flex-wrap gap-1 mb-2">
                  {item.fighter_tags?.map((tag) => (
                    <Badge
                      key={tag}
                      variant={tag === 'Gripen' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div
                  className={`text-xl font-bold ${getSentimentColor(item.sentiment)}`}
                >
                  {item.sentiment > 0 ? '😊' : item.sentiment < 0 ? '😞' : '😐'}
                </div>
                {item.engagement?.comments && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MessageSquare className="h-3 w-3" />
                    {item.engagement.comments}
                  </div>
                )}
              </div>
            </div>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              View original (PT) <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        ))}

        {items.length === 0 && (
          <div className="text-center text-muted-foreground py-12">
            No items yet. Data will appear as sources are monitored.
          </div>
        )}
      </div>
    </Card>
  );
};
