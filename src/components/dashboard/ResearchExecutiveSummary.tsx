import { Card } from "@/components/ui/card";
import { Loader2, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

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

  useEffect(() => {
    fetchLatestReport();

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

    return () => {
      supabase.removeChannel(channel);
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
              const mentionKey = `total_${competitor.toLowerCase().replace('-', '')}_mentions`;
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
      </div>
    </Card>
  );
};