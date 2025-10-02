import { Card } from "@/components/ui/card";
import { FileText, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ItemSummary {
  id: string;
  title_en: string;
  summary_en: string;
  sentiment: number;
  fighter_tags: string[];
  published_at: string;
}

export const NarrativeSummaries = () => {
  const [gripenItems, setGripenItems] = useState<ItemSummary[]>([]);
  const [f35Items, setF35Items] = useState<ItemSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSummaries = async () => {
      // Get recent items with fighter tags
      const { data: items } = await supabase
        .from('items')
        .select('id, title_en, summary_en, sentiment, fighter_tags, published_at')
        .not('summary_en', 'is', null)
        .order('published_at', { ascending: false })
        .limit(50);

      if (items) {
        setGripenItems(items.filter(i => i.fighter_tags?.includes('Gripen')));
        setF35Items(items.filter(i => i.fighter_tags?.includes('F-35')));
      }
      setLoading(false);
    };

    fetchSummaries();
  }, []);

  const generateNarrative = (items: ItemSummary[]) => {
    if (items.length === 0) return "No recent coverage available.";
    
    const avgSentiment = items.reduce((sum, i) => sum + (i.sentiment || 0), 0) / items.length;
    const recentItems = items.slice(0, 3);
    
    return (
      <>
        {recentItems.map((item, idx) => (
          <p key={item.id} className="text-sm text-foreground leading-relaxed mb-2">
            {item.summary_en}
          </p>
        ))}
        <p className="text-xs text-muted-foreground mt-2">
          Average sentiment: {(avgSentiment * 100).toFixed(0)}% {avgSentiment > 0 ? '(Positive)' : avgSentiment < 0 ? '(Negative)' : '(Neutral)'}
        </p>
      </>
    );
  };

  return (
    <Card className="p-6">
      <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
        <FileText className="h-5 w-5" />
        AI Narrative Summaries
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-3">
          <h4 className="font-bold text-success">Gripen</h4>
          <div className="prose prose-sm prose-invert max-w-none">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : (
              generateNarrative(gripenItems)
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingUp className="h-3 w-3" />
            <span>Based on {gripenItems.length} sources</span>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="font-bold text-destructive">F-35</h4>
          <div className="prose prose-sm prose-invert max-w-none">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : (
              generateNarrative(f35Items)
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingUp className="h-3 w-3" />
            <span>Based on {f35Items.length} sources</span>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="font-bold">Key Insights</h4>
          <div className="space-y-3">
            {gripenItems.length + f35Items.length === 0 ? (
              <div className="p-3 rounded-lg bg-secondary/50">
                <p className="text-xs text-muted-foreground">
                  No recent fighter-related articles. Click "Scrape Sources" and "Process with AI" to populate data.
                </p>
              </div>
            ) : (
              <>
                <div className="p-3 rounded-lg bg-secondary/50">
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-lg">📊</span>
                    <div>
                      <div className="font-semibold text-sm">Coverage Analysis</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {gripenItems.length} Gripen articles vs {f35Items.length} F-35 articles in recent coverage.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-secondary/50">
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-lg">🔥</span>
                    <div>
                      <div className="font-semibold text-sm">Media Attention</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {gripenItems.length > f35Items.length 
                          ? 'Gripen receiving more media coverage' 
                          : f35Items.length > gripenItems.length
                          ? 'F-35 receiving more media coverage'
                          : 'Equal media coverage for both fighters'}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};
