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

  // Helper to check if domain is Portuguese
  const isPortugueseDomain = (url: string) => {
    try {
      const domain = new URL(url).hostname.toLowerCase();
      return domain.endsWith('.pt') || 
             domain.includes('observador') || 
             domain.includes('publico') || 
             domain.includes('expresso') ||
             domain.includes('visao') ||
             domain.includes('jornaldenegocios');
    } catch {
      return false;
    }
  };

  // Helper to check if source is fighter-related
  const isFighterRelated = (url: string) => {
    const fighterKeywords = [
      'gripen', 'f-35', 'f35', 'fighter', 'aircraft', 'aviao', 'aviação',
      'defesa', 'defense', 'militar', 'military', 'forca aerea', 'air force',
      'procurement', 'aquisição', 'saab', 'lockheed', 'nato', 'otan'
    ];
    const urlLower = url.toLowerCase();
    return fighterKeywords.some(keyword => urlLower.includes(keyword));
  };

  // Filter sources to only include fighter-related URLs
  const fighterSources = sources.filter(isFighterRelated);

  // Sort sources: Portuguese domains first, then alphabetically
  const sortedSources = [...fighterSources].sort((a, b) => {
    const aIsPortuguese = isPortugueseDomain(a);
    const bIsPortuguese = isPortugueseDomain(b);
    
    if (aIsPortuguese && !bIsPortuguese) return -1;
    if (!aIsPortuguese && bIsPortuguese) return 1;
    return a.localeCompare(b);
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <CardTitle>Key Sources Referenced</CardTitle>
        </div>
        <CardDescription>
          Sources from research reports in the last 60 days (Portuguese sources prioritized)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sortedSources.map((source, index) => {
            const isPortuguese = isPortugueseDomain(source);
            return (
              <div
                key={index}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                  isPortuguese 
                    ? 'border-primary/50 bg-primary/5 hover:border-primary' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <ExternalLink className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  {isUrl(source) ? (
                    <>
                      <a
                        href={source}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-primary hover:underline break-words"
                      >
                        {getDomain(source)}
                      </a>
                      {isPortuguese && (
                        <span className="ml-2 text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                          PT
                        </span>
                      )}
                    </>
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
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};