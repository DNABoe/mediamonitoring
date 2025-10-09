import { Card } from "@/components/ui/card";
import { Loader2, AlertCircle, Shield, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface ResearchReport {
  id: string;
  created_at: string;
  report_date: string;
  political_analysis: string;
  capability_analysis: string;
  cost_analysis: string;
  industrial_cooperation: string;
}

interface BlackHatIssue {
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

interface PlatformAnalysis {
  platform: string;
  issues: BlackHatIssue[];
}

export const BlackHatAnalysis = () => {
  const [report, setReport] = useState<ResearchReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<PlatformAnalysis[]>([]);

  useEffect(() => {
    fetchLatestReport();

    const channel = supabase
      .channel('research-reports-blackhat')
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
      if (data) {
        setReport(data);
        extractBlackHatIssues(data);
      }
    } catch (error) {
      console.error('Error fetching research report:', error);
    } finally {
      setLoading(false);
    }
  };

  const extractBlackHatIssues = (report: ResearchReport) => {
    const gripenIssues: BlackHatIssue[] = [];
    const f35Issues: BlackHatIssue[] = [];

    // Extract vulnerabilities from political analysis
    if (report.political_analysis) {
      const text = report.political_analysis.toLowerCase();
      
      if (text.includes('gripen') && (text.includes('opposition') || text.includes('criticism') || text.includes('concern'))) {
        gripenIssues.push({
          title: 'Political Opposition',
          description: 'Evidence of political resistance or concerns in Portuguese decision-making circles.',
          severity: 'high'
        });
      }
      
      if (text.includes('f-35') && (text.includes('opposition') || text.includes('criticism') || text.includes('concern'))) {
        f35Issues.push({
          title: 'Political Opposition',
          description: 'Evidence of political resistance or concerns in Portuguese decision-making circles.',
          severity: 'high'
        });
      }
    }

    // Extract capability weaknesses
    if (report.capability_analysis) {
      const text = report.capability_analysis.toLowerCase();
      
      if (text.includes('gripen') && (text.includes('limitation') || text.includes('weakness') || text.includes('inferior'))) {
        gripenIssues.push({
          title: 'Capability Limitations',
          description: 'Technical or operational capabilities identified as inferior or limited compared to alternatives.',
          severity: 'medium'
        });
      }
      
      if (text.includes('f-35') && (text.includes('limitation') || text.includes('weakness') || text.includes('inferior'))) {
        f35Issues.push({
          title: 'Capability Limitations',
          description: 'Technical or operational capabilities identified as inferior or limited compared to alternatives.',
          severity: 'medium'
        });
      }
    }

    // Extract cost concerns
    if (report.cost_analysis) {
      const text = report.cost_analysis.toLowerCase();
      
      if (text.includes('gripen') && (text.includes('expensive') || text.includes('high cost') || text.includes('budget concern'))) {
        gripenIssues.push({
          title: 'Cost Concerns',
          description: 'Financial vulnerabilities or budget challenges identified in procurement process.',
          severity: 'high'
        });
      }
      
      if (text.includes('f-35') && (text.includes('expensive') || text.includes('high cost') || text.includes('budget concern'))) {
        f35Issues.push({
          title: 'Cost Concerns',
          description: 'Financial vulnerabilities or budget challenges identified in procurement process.',
          severity: 'critical'
        });
      }
    }

    // Extract industrial cooperation risks
    if (report.industrial_cooperation) {
      const text = report.industrial_cooperation.toLowerCase();
      
      if (text.includes('gripen') && (text.includes('risk') || text.includes('dependency') || text.includes('limited'))) {
        gripenIssues.push({
          title: 'Industrial Partnership Risks',
          description: 'Concerns about technology transfer, local production, or industrial cooperation agreements.',
          severity: 'medium'
        });
      }
      
      if (text.includes('f-35') && (text.includes('risk') || text.includes('dependency') || text.includes('limited'))) {
        f35Issues.push({
          title: 'Industrial Partnership Risks',
          description: 'Concerns about technology transfer, local production, or industrial cooperation agreements.',
          severity: 'medium'
        });
      }
    }

    setAnalysis([
      { platform: 'Gripen', issues: gripenIssues },
      { platform: 'F-35', issues: f35Issues }
    ]);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <Card className="p-6 bg-gradient-to-br from-destructive/5 to-destructive/10">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-destructive" />
        </div>
      </Card>
    );
  }

  if (!report) {
    return (
      <Card className="p-6 bg-gradient-to-br from-destructive/5 to-destructive/10">
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <Shield className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">No Analysis Available</h3>
          <p className="text-muted-foreground">
            Generate a research report to see black hat vulnerability analysis
          </p>
        </div>
      </Card>
    );
  }

  const timeAgo = formatDistanceToNow(new Date(report.created_at), { addSuffix: true });

  return (
    <Card className="p-6 bg-gradient-to-br from-destructive/5 to-destructive/10">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-destructive" />
            <h2 className="text-2xl font-bold">Black Hat Analysis</h2>
          </div>
          <span className="text-sm text-muted-foreground">Updated {timeAgo}</span>
        </div>

        <p className="text-sm text-muted-foreground">
          Adversarial analysis identifying vulnerabilities, weaknesses, and attack vectors for each platform
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          {analysis.map((platformAnalysis) => (
            <div key={platformAnalysis.platform} className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                {platformAnalysis.platform}
                <Badge variant="outline" className="ml-2">
                  {platformAnalysis.issues.length} {platformAnalysis.issues.length === 1 ? 'issue' : 'issues'}
                </Badge>
              </h3>

              {platformAnalysis.issues.length === 0 ? (
                <div className="p-4 rounded-lg bg-background/50 border border-border text-center">
                  <p className="text-sm text-muted-foreground">No significant vulnerabilities detected</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {platformAnalysis.issues.map((issue, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-lg bg-background/50 border border-border space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {getSeverityIcon(issue.severity)}
                          <h4 className="font-semibold text-sm">{issue.title}</h4>
                        </div>
                        <Badge variant={getSeverityColor(issue.severity) as any} className="text-xs">
                          {issue.severity.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {issue.description}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};
