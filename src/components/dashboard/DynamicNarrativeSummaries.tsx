import { Card } from "@/components/ui/card";
import { FileText, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const DynamicNarrativeSummaries = () => {
  const [summaries, setSummaries] = useState<{
    gripen: string;
    f35: string;
    gripenCount: number;
    f35Count: number;
    lastUpdate: Date;
  } | null>(null);

  useEffect(() => {
    const loadSummaries = async () => {
      // Get recent items with summaries AND fighter tags
      const { data: items } = await supabase
        .from('items')
        .select('summary_en, fighter_tags, created_at')
        .not('summary_en', 'is', null)
        .not('fighter_tags', 'eq', '{}')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(100);

      if (!items || items.length === 0) {
        setSummaries(null);
        return;
      }

      const gripenItems = items.filter(i => 
        i.fighter_tags?.some((tag: string) => tag.toLowerCase().includes('gripen'))
      );
      const f35Items = items.filter(i => 
        i.fighter_tags?.some((tag: string) => tag.toLowerCase().includes('f-35') || tag.toLowerCase().includes('f35'))
      );

      // Aggregate summaries - use all available summaries
      const gripenSummary = gripenItems.length > 0
        ? `Recent coverage highlights: ${gripenItems.map(i => i.summary_en).join(' ')}`
        : 'No recent Gripen-related articles found.';

      const f35Summary = f35Items.length > 0
        ? `Recent coverage focuses on: ${f35Items.map(i => i.summary_en).join(' ')}`
        : 'No recent F-35-related articles found.';

      setSummaries({
        gripen: gripenSummary,
        f35: f35Summary,
        gripenCount: gripenItems.length,
        f35Count: f35Items.length,
        lastUpdate: new Date()
      });
    };

    loadSummaries();
    
    // Refresh every 5 minutes
    const interval = setInterval(loadSummaries, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (!summaries) {
    return (
      <Card className="p-6">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
          <FileText className="h-5 w-5" />
          AI Narrative Summaries
        </h3>
        <p className="text-sm text-muted-foreground">
          Loading recent articles... Click "Scrape Sources" and "Process with AI" to generate summaries.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
        <FileText className="h-5 w-5" />
        AI Narrative Summaries
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h4 className="font-bold text-success">Gripen</h4>
          <div className="prose prose-sm prose-invert max-w-none">
            <p className="text-sm text-foreground leading-relaxed">
              {summaries.gripen}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingUp className="h-3 w-3" />
            <span>Based on {summaries.gripenCount} sources • Updated {Math.floor((Date.now() - summaries.lastUpdate.getTime()) / 60000)} min ago</span>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="font-bold text-destructive">F-35</h4>
          <div className="prose prose-sm prose-invert max-w-none">
            <p className="text-sm text-foreground leading-relaxed">
              {summaries.f35}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingUp className="h-3 w-3" />
            <span>Based on {summaries.f35Count} sources • Updated {Math.floor((Date.now() - summaries.lastUpdate.getTime()) / 60000)} min ago</span>
          </div>
        </div>
      </div>
    </Card>
  );
};