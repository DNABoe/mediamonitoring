import { Card } from "@/components/ui/card";
import { Loader2, AlertCircle, Newspaper, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow, format, subDays } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MediaArticle {
  id: string;
  title_en: string;
  url: string;
  published_at: string;
  source: {
    name: string;
    type: string;
  };
  fighter_tags: string[];
}

interface TopSource {
  name: string;
  url: string;
  type: string;
  country: string;
  mention_count: number;
}

interface ResearchReport {
  id: string;
  created_at: string;
  report_date: string;
  executive_summary: string;
  media_presence: any;
  media_tonality: any;
}

interface ResearchExecutiveSummaryProps {
  activeCompetitors: string[];
}

export const ResearchExecutiveSummary = ({ activeCompetitors }: ResearchExecutiveSummaryProps) => {
  const [report, setReport] = useState<ResearchReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [topSources, setTopSources] = useState<TopSource[]>([]);
  const [mediaArticles, setMediaArticles] = useState<MediaArticle[]>([]);

  useEffect(() => {
    fetchLatestReport();
    fetchTopSources();
    fetchMediaArticles();

    const channel = supabase
      .channel('research-reports')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'research_reports'
      }, () => {
        fetchLatestReport();
      })
      .subscribe();

    const itemsChannel = supabase
      .channel('items-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'items'
      }, () => {
        fetchTopSources();
        fetchMediaArticles();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(itemsChannel);
    };
  }, []);

  const fetchLatestReport = async () => {
    try {
      const { data, error } = await supabase
        .from('research_reports')
        .select('*')
        .order('report_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setReport(data);
    } catch (error) {
      console.error('Error fetching research report:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTopSources = async () => {
    try {
      // Get source mention counts from items
      const { data: items, error: itemsError } = await supabase
        .from('items')
        .select('source_id')
        .not('source_id', 'is', null);

      if (itemsError) throw itemsError;

      // Count mentions per source
      const sourceCounts = items?.reduce((acc: Record<string, number>, item) => {
        const sourceId = item.source_id;
        if (sourceId) {
          acc[sourceId] = (acc[sourceId] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>) || {};

      // Get top 5 source IDs
      const topSourceIds = Object.entries(sourceCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([id]) => id);

      if (topSourceIds.length === 0) {
        setTopSources([]);
        return;
      }

      // Fetch source details
      const { data: sources, error: sourcesError } = await supabase
        .from('sources')
        .select('id, name, url, type, country')
        .in('id', topSourceIds);

      if (sourcesError) throw sourcesError;

      // Combine with counts
      const topSourcesWithCounts = sources?.map(source => ({
        ...source,
        mention_count: sourceCounts[source.id] || 0
      }))
      .sort((a, b) => b.mention_count - a.mention_count) || [];

      setTopSources(topSourcesWithCounts);
    } catch (error) {
      console.error('Error fetching top sources:', error);
    }
  };

  const fetchMediaArticles = async () => {
    try {
      const sixtyDaysAgo = subDays(new Date(), 60);
      
      const { data: items, error } = await supabase
        .from('items')
        .select(`
          id,
          title_en,
          url,
          published_at,
          fighter_tags,
          sources (
            name,
            type
          )
        `)
        .gte('published_at', sixtyDaysAgo.toISOString())
        .not('fighter_tags', 'is', null)
        .order('published_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      const articlesWithSources = items?.map(item => ({
        id: item.id,
        title_en: item.title_en || 'Untitled',
        url: item.url,
        published_at: item.published_at,
        fighter_tags: item.fighter_tags || [],
        source: Array.isArray(item.sources) ? item.sources[0] : item.sources
      })).filter(article => article.source) || [];

      setMediaArticles(articlesWithSources);
    } catch (error) {
      console.error('Error fetching media articles:', error);
    }
  };

  if (loading) {
    return (
      <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Card>
    );
  }

  if (!report) {
    return (
      <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10">
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">No Research Available</h3>
          <p className="text-muted-foreground">
            Generate a new intelligence report to see the analysis
          </p>
        </div>
      </Card>
    );
  }

  const timeAgo = formatDistanceToNow(new Date(report.created_at), { addSuffix: true });

  return (
    <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Intelligence Summary</h2>
          <span className="text-sm text-muted-foreground">Updated {timeAgo}</span>
        </div>

        <div className="prose prose-sm max-w-none">
          <p className="text-base leading-relaxed whitespace-pre-line">
            {report.executive_summary}
          </p>
        </div>

        {report.media_presence && (
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">
                {report.media_presence.total_gripen_mentions || 0}
              </div>
              <div className="text-sm text-muted-foreground">Gripen Mentions</div>
            </div>
            {activeCompetitors.map((competitor) => {
              const mentionKey = `total_${competitor.toLowerCase().replace(/[^a-z0-9]/g, '_')}_mentions`;
              return (
                <div key={competitor} className="text-center">
                  <div className="text-3xl font-bold text-primary">
                    {report.media_presence[mentionKey] || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">{competitor} Mentions</div>
                </div>
              );
            })}
          </div>
        )}

        {topSources.length > 0 && (
          <div className="pt-4 border-t space-y-3">
            <div className="flex items-center gap-2">
              <Newspaper className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Top Referenced Media Sources</h3>
            </div>
            <div className="space-y-2">
              {topSources.map((source, index) => (
                <div 
                  key={source.url} 
                  className="flex items-center justify-between p-3 bg-background/50 rounded-lg border border-border/50 hover:border-primary/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-muted-foreground">#{index + 1}</span>
                      <a 
                        href={source.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="font-semibold text-foreground hover:text-primary transition-colors truncate"
                      >
                        {source.name}
                      </a>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {source.type}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {source.country}
                      </Badge>
                    </div>
                  </div>
                  <div className="ml-4 text-right">
                    <div className="text-2xl font-bold text-primary">
                      {source.mention_count}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      mentions
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {mediaArticles.length > 0 && (
          <div className="pt-4 border-t space-y-3">
            <div className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Key Media References (Last 60 Days)</h3>
            </div>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {mediaArticles.map((article) => (
                  <div 
                    key={article.id}
                    className="p-4 bg-background/50 rounded-lg border border-border/50 hover:border-primary/30 transition-colors"
                  >
                    <a 
                      href={article.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="group"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors flex-1 line-clamp-2">
                          {article.title_en}
                        </h4>
                        <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
                      </div>
                    </a>
                    
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      <span className="font-medium">{article.source.name}</span>
                      <span>•</span>
                      <span>{format(new Date(article.published_at), 'MMM d, yyyy')}</span>
                    </div>
                    
                    <div className="flex flex-wrap gap-1.5">
                      {article.fighter_tags.map((tag) => (
                        <Badge 
                          key={tag} 
                          variant="secondary" 
                          className="text-xs"
                        >
                          {tag}
                        </Badge>
                      ))}
                      <Badge variant="outline" className="text-xs">
                        {article.source.type}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </Card>
  );
};