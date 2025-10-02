import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ReportComparison {
  hasChanges: boolean;
  changes: {
    type: 'increase' | 'decrease' | 'neutral';
    dimension: string;
    description: string;
    magnitude?: number;
  }[];
  newInsights: string[];
}

export const ResearchChanges = () => {
  const [comparison, setComparison] = useState<ReportComparison | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAndCompare = async () => {
      // Fetch the two most recent reports
      const { data: reports } = await supabase
        .from('research_reports')
        .select('*')
        .order('report_date', { ascending: false })
        .limit(2);

      if (!reports || reports.length < 2) {
        setComparison({
          hasChanges: false,
          changes: [],
          newInsights: ["This is your first research report. Generate another report to see changes."]
        });
        setLoading(false);
        return;
      }

      const [latest, previous] = reports;
      const changes: ReportComparison['changes'] = [];
      const newInsights: string[] = [];

      // Compare media tonality scores
      const latestTonality = latest.media_tonality as any;
      const prevTonality = previous.media_tonality as any;

      if (latestTonality?.gripen_score && prevTonality?.gripen_score) {
        const gripDiff = latestTonality.gripen_score - prevTonality.gripen_score;
        if (Math.abs(gripDiff) > 2) {
          changes.push({
            type: gripDiff > 0 ? 'increase' : 'decrease',
            dimension: 'Gripen Overall Score',
            description: `${gripDiff > 0 ? 'Increased' : 'Decreased'} by ${Math.abs(gripDiff).toFixed(1)} points`,
            magnitude: Math.abs(gripDiff)
          });
        }
      }

      if (latestTonality?.f35_score && prevTonality?.f35_score) {
        const f35Diff = latestTonality.f35_score - prevTonality.f35_score;
        if (Math.abs(f35Diff) > 2) {
          changes.push({
            type: f35Diff > 0 ? 'increase' : 'decrease',
            dimension: 'F-35 Overall Score',
            description: `${f35Diff > 0 ? 'Increased' : 'Decreased'} by ${Math.abs(f35Diff).toFixed(1)} points`,
            magnitude: Math.abs(f35Diff)
          });
        }
      }

      // Compare dimension scores
      if (latestTonality?.dimension_scores && prevTonality?.dimension_scores) {
        const latestDim = latestTonality.dimension_scores;
        const prevDim = prevTonality.dimension_scores;

        // Check Gripen dimensions
        if (latestDim.gripen && prevDim.gripen) {
          for (const [key, value] of Object.entries(latestDim.gripen) as [string, number][]) {
            const prevValue = prevDim.gripen[key] as number;
            const diff = value - prevValue;
            if (Math.abs(diff) > 1.5) {
              changes.push({
                type: diff > 0 ? 'increase' : 'decrease',
                dimension: `Gripen ${key.charAt(0).toUpperCase() + key.slice(1)}`,
                description: `${diff > 0 ? 'Improved' : 'Declined'} by ${Math.abs(diff).toFixed(1)} points`,
                magnitude: Math.abs(diff)
              });
            }
          }
        }

        // Check F-35 dimensions
        if (latestDim.f35 && prevDim.f35) {
          for (const [key, value] of Object.entries(latestDim.f35) as [string, number][]) {
            const prevValue = prevDim.f35[key] as number;
            const diff = value - prevValue;
            if (Math.abs(diff) > 1.5) {
              changes.push({
                type: diff > 0 ? 'increase' : 'decrease',
                dimension: `F-35 ${key.charAt(0).toUpperCase() + key.slice(1)}`,
                description: `${diff > 0 ? 'Improved' : 'Declined'} by ${Math.abs(diff).toFixed(1)} points`,
                magnitude: Math.abs(diff)
              });
            }
          }
        }
      }

      // Compare sentiment scores
      const gripSentDiff = (latestTonality?.gripen_sentiment || 0) - (prevTonality?.gripen_sentiment || 0);
      if (Math.abs(gripSentDiff) > 0.2) {
        newInsights.push(
          `Media sentiment for Gripen ${gripSentDiff > 0 ? 'improved' : 'worsened'} significantly`
        );
      }

      const f35SentDiff = (latestTonality?.f35_sentiment || 0) - (prevTonality?.f35_sentiment || 0);
      if (Math.abs(f35SentDiff) > 0.2) {
        newInsights.push(
          `Media sentiment for F-35 ${f35SentDiff > 0 ? 'improved' : 'worsened'} significantly`
        );
      }

      // Compare mentions
      const latestPresence = latest.media_presence as any;
      const prevPresence = previous.media_presence as any;

      if (latestPresence && prevPresence) {
        const gripMentionDiff = (latestPresence.gripen_mentions || 0) - (prevPresence.gripen_mentions || 0);
        const f35MentionDiff = (latestPresence.f35_mentions || 0) - (prevPresence.f35_mentions || 0);

        if (Math.abs(gripMentionDiff) > 5) {
          newInsights.push(
            `Gripen media mentions ${gripMentionDiff > 0 ? 'increased' : 'decreased'} by ${Math.abs(gripMentionDiff)}`
          );
        }

        if (Math.abs(f35MentionDiff) > 5) {
          newInsights.push(
            `F-35 media mentions ${f35MentionDiff > 0 ? 'increased' : 'decreased'} by ${Math.abs(f35MentionDiff)}`
          );
        }
      }

      // Check for new narratives
      if (latestPresence?.key_narratives && prevPresence?.key_narratives) {
        const newNarratives = latestPresence.key_narratives.filter(
          (n: string) => !prevPresence.key_narratives.includes(n)
        );
        if (newNarratives.length > 0) {
          newInsights.push(`New narrative emerged: ${newNarratives[0]}`);
        }
      }

      setComparison({
        hasChanges: changes.length > 0 || newInsights.length > 0,
        changes: changes.sort((a, b) => (b.magnitude || 0) - (a.magnitude || 0)),
        newInsights
      });
      setLoading(false);
    };

    fetchAndCompare();

    const channel = supabase
      .channel('research-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'research_reports' },
        () => fetchAndCompare()
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
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!comparison?.hasChanges) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Minus className="h-5 w-5 text-muted-foreground" />
            Key Changes Since Last Report
          </CardTitle>
          <CardDescription>
            Tracking significant shifts in the analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {comparison?.newInsights[0] || "No major changes detected. The landscape remains relatively stable."}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const getTrendIcon = (type: 'increase' | 'decrease' | 'neutral') => {
    switch (type) {
      case 'increase':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'decrease':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Key Changes Since Last Report
        </CardTitle>
        <CardDescription>
          Significant shifts detected in the analysis
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {comparison.changes.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Score Changes</h4>
              {comparison.changes.map((change, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border"
                >
                  {getTrendIcon(change.type)}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {change.dimension}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {change.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {comparison.newInsights.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">New Insights</h4>
              {comparison.newInsights.map((insight, index) => (
                <Alert key={index}>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    {insight}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};