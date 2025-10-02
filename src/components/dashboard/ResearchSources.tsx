import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, BookOpen } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export const ResearchSources = () => {
  const [sources, setSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSources = async () => {
      // Calculate date 60 days ago
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      const dateFilter = sixtyDaysAgo.toISOString().split('T')[0];

      const { data } = await supabase
        .from('research_reports')
        .select('sources, report_date')
        .gte('report_date', dateFilter)
        .order('report_date', { ascending: false });

      if (data && data.length > 0) {
        // Collect all unique sources from the last 60 days
        const allSources = new Set<string>();
        data.forEach(report => {
          if (report.sources) {
            (report.sources as string[]).forEach(source => allSources.add(source));
          }
        });
        setSources(Array.from(allSources));
      }
      setLoading(false);
    };

    fetchSources();

    const channel = supabase
      .channel('research-sources-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'research_reports' },
        () => fetchSources()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!sources.length) {
    return null;
  }

  // Helper to extract domain from URL
  const getDomain = (url: string) => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  // Helper to check if string is a URL
  const isUrl = (str: string) => {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <CardTitle>Key Sources Referenced</CardTitle>
        </div>
        <CardDescription>
          Sources referenced in research reports from the last 60 days
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sources.map((source, index) => (
            <div
              key={index}
              className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/50 transition-colors"
            >
              <ExternalLink className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                {isUrl(source) ? (
                  <a
                    href={source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-primary hover:underline break-words"
                  >
                    {getDomain(source)}
                  </a>
                ) : (
                  <p className="text-sm font-medium text-foreground break-words">
                    {source}
                  </p>
                )}
                {isUrl(source) && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {source}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};