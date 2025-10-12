import { Card } from "@/components/ui/card";
import { Loader2, AlertCircle, Shield, AlertTriangle, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface ResearchReport {
  id: string;
  created_at: string;
  report_date: string;
  political_analysis: string;
  capability_analysis: string;
  cost_analysis: string;
  industrial_cooperation: string;
  competitors: string[];
}

interface BlackHatIssue {
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  impact: string;
  likelihood: string;
  mitigation?: string;
}

interface PlatformAnalysis {
  platform: string;
  issues: BlackHatIssue[];
}

interface BlackHatAnalysisProps {
  activeCompetitors: string[];
  activeCountry: string;
}

export const BlackHatAnalysis = ({ activeCompetitors, activeCountry }: BlackHatAnalysisProps) => {
  const [report, setReport] = useState<ResearchReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [analysis, setAnalysis] = useState<PlatformAnalysis[]>([]);
  const [selectedTab, setSelectedTab] = useState<string>('gripen');
  const { toast } = useToast();

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

  const generateAISuggestions = async () => {
    if (!report) return;
    
    try {
      setGenerating(true);
      
      const { data, error } = await supabase.functions.invoke('generate-blackhat-analysis', {
        body: {
          country: activeCountry,
          competitors: activeCompetitors,
          report: {
            political_analysis: report.political_analysis,
            capability_analysis: report.capability_analysis,
            cost_analysis: report.cost_analysis,
            industrial_cooperation: report.industrial_cooperation
          }
        }
      });

      if (error) throw error;

      if (data?.success && data?.analysis) {
        setAnalysis(data.analysis);
        toast({
          title: "AI Analysis Generated",
          description: `Comprehensive black hat analysis created for ${activeCompetitors.length + 1} platforms`,
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('Error generating AI suggestions:', error);
      toast({
        title: "Error",
        description: "Failed to generate AI analysis. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setGenerating(false);
    }
  };

  const extractBlackHatIssues = (report: ResearchReport) => {
    const allCompetitors = ['Gripen', ...activeCompetitors];
    const platformIssues: { [key: string]: BlackHatIssue[] } = {};
    
    // Initialize issues arrays for all platforms
    allCompetitors.forEach(comp => {
      platformIssues[comp] = [];
    });

    const searchText = (text: string, platform: string) => {
      const lowerText = text.toLowerCase();
      const lowerPlatform = platform.toLowerCase().replace('-', '');
      return lowerText.includes(lowerPlatform) || lowerText.includes(platform.toLowerCase());
    };

    // Extract vulnerabilities from political analysis
    if (report.political_analysis) {
      const text = report.political_analysis.toLowerCase();
      
      allCompetitors.forEach(platform => {
        if (searchText(text, platform) && (text.includes('opposition') || text.includes('criticism') || text.includes('concern'))) {
          platformIssues[platform].push({
            title: 'Political Opposition',
            description: 'Evidence of political resistance or concerns in Portuguese decision-making circles.',
            severity: 'high',
            category: 'Political',
            impact: 'Could delay or derail procurement process',
            likelihood: 'Medium',
            mitigation: 'Strengthen political engagement and address specific concerns raised by opposition'
          });
        }
        
        if (platform === 'F-35' && searchText(text, platform) && (text.includes('nato') || text.includes('dependency') || text.includes('us control'))) {
          platformIssues[platform].push({
            title: 'Strategic Dependency Risk',
            description: 'Concerns about over-reliance on US-controlled systems and technology.',
            severity: 'high',
            category: 'Strategic',
            impact: 'Reduced operational autonomy in conflicts not aligned with US interests',
            likelihood: 'High'
          });
        }
      });
    }

    // Extract capability weaknesses
    if (report.capability_analysis) {
      const text = report.capability_analysis.toLowerCase();
      
      allCompetitors.forEach(platform => {
        if (searchText(text, platform) && (text.includes('limitation') || text.includes('weakness') || text.includes('inferior'))) {
          platformIssues[platform].push({
            title: 'Capability Limitations',
            description: 'Technical or operational capabilities identified as inferior or limited compared to alternatives.',
            severity: 'medium',
            category: 'Technical',
            impact: 'Reduced effectiveness in specific mission scenarios',
            likelihood: 'Medium',
            mitigation: platform === 'F-35' ? 'Software upgrades and Block updates address many limitations' : 'Upgrade packages or complementary systems can address some gaps'
          });
        }
        
        if (platform !== 'F-35' && searchText(text, platform) && (text.includes('stealth') || text.includes('radar cross') || text.includes('detectability'))) {
          platformIssues[platform].push({
            title: 'Low Observable Technology Gap',
            description: 'Limited stealth capabilities compared to 5th generation competitors.',
            severity: 'medium',
            category: 'Technical',
            impact: 'Higher vulnerability in contested airspace',
            likelihood: 'High'
          });
        }
        
        if (platform === 'F-35' && searchText(text, platform) && (text.includes('maintenance') || text.includes('availability') || text.includes('uptime'))) {
          platformIssues[platform].push({
            title: 'Maintenance Complexity',
            description: 'High maintenance requirements and potential availability issues.',
            severity: 'high',
            category: 'Operational',
            impact: 'Lower fleet availability and higher operational costs',
            likelihood: 'High'
          });
        }
      });
    }

    // Extract cost concerns
    if (report.cost_analysis) {
      const text = report.cost_analysis.toLowerCase();
      
      allCompetitors.forEach(platform => {
        if (searchText(text, platform) && (text.includes('expensive') || text.includes('high cost') || text.includes('budget concern'))) {
          platformIssues[platform].push({
            title: 'Cost Concerns',
            description: 'Financial vulnerabilities or budget challenges identified in procurement process.',
            severity: platform === 'F-35' ? 'critical' : 'high',
            category: 'Financial',
            impact: platform === 'F-35' ? 'Significant budget strain affecting other defense priorities' : 'Budget overruns or reduced procurement numbers',
            likelihood: platform === 'F-35' ? 'High' : 'Medium',
            mitigation: platform === 'F-35' ? 'Explore multi-year procurement strategies and international cost-sharing' : 'Negotiate fixed-price contracts with performance guarantees'
          });
        }
        
        if (platform === 'F-35' && searchText(text, platform) && (text.includes('cost per flight hour') || text.includes('cpfh') || text.includes('operating cost'))) {
          platformIssues[platform].push({
            title: 'High Operating Costs',
            description: 'Significantly higher cost per flight hour compared to alternatives.',
            severity: 'critical',
            category: 'Financial',
            impact: 'Reduced training hours and operational readiness',
            likelihood: 'Very High'
          });
        }
      });
    }

    // Extract industrial cooperation risks
    if (report.industrial_cooperation) {
      const text = report.industrial_cooperation.toLowerCase();
      
      allCompetitors.forEach(platform => {
        if (searchText(text, platform) && (text.includes('risk') || text.includes('dependency') || text.includes('limited'))) {
          platformIssues[platform].push({
            title: 'Industrial Partnership Risks',
            description: 'Concerns about technology transfer, local production, or industrial cooperation agreements.',
            severity: 'medium',
            category: 'Industrial',
            impact: 'Limited domestic industrial benefits',
            likelihood: platform === 'F-35' ? 'High' : 'Medium',
            mitigation: platform === 'F-35' ? 'Seek regional maintenance hub status or specific workshare agreements' : 'Negotiate comprehensive offset packages and tech transfer agreements'
          });
        }
        
        if (platform === 'F-35' && searchText(text, platform) && (text.includes('alis') || text.includes('autonomic logistics') || text.includes('data sharing'))) {
          platformIssues[platform].push({
            title: 'ALIS Dependency & Data Sovereignty',
            description: 'Mandatory use of centralized logistics system with data security implications.',
            severity: 'high',
            category: 'Technical',
            impact: 'Limited operational autonomy and potential data exposure',
            likelihood: 'Very High'
          });
        }
      });
    }

    const analysisResults: PlatformAnalysis[] = allCompetitors.map(platform => ({
      platform,
      issues: platformIssues[platform]
    }));
    
    setAnalysis(analysisResults);
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

  const renderIssuesForPlatform = (platformAnalysis: PlatformAnalysis) => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold">{platformAnalysis.platform}</h3>
        <Badge variant="outline">
          {platformAnalysis.issues.length} {platformAnalysis.issues.length === 1 ? 'issue' : 'issues'}
        </Badge>
      </div>

      {platformAnalysis.issues.length === 0 ? (
        <div className="p-4 rounded-lg bg-background/50 border border-border text-center">
          <p className="text-sm text-muted-foreground">No significant vulnerabilities detected</p>
        </div>
      ) : (
        <div className="space-y-3">
          {platformAnalysis.issues.map((issue, idx) => (
            <div
              key={idx}
              className="p-4 rounded-lg bg-background/50 border border-border space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {getSeverityIcon(issue.severity)}
                  <h4 className="font-semibold text-sm">{issue.title}</h4>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-xs">
                    {issue.category}
                  </Badge>
                  <Badge variant={getSeverityColor(issue.severity) as any} className="text-xs">
                    {issue.severity.toUpperCase()}
                  </Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {issue.description}
              </p>
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Impact</p>
                  <p className="text-xs">{issue.impact}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Likelihood</p>
                  <p className="text-xs">{issue.likelihood}</p>
                </div>
              </div>
              {issue.mitigation && (
                <div className="pt-2 border-t border-border/50">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Mitigation Strategy</p>
                  <p className="text-xs text-foreground/80">{issue.mitigation}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <Card className="p-6 bg-gradient-to-br from-destructive/5 to-destructive/10">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-destructive" />
            <h2 className="text-2xl font-bold">Black Hat Analysis</h2>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Button
              onClick={generateAISuggestions}
              disabled={generating || !report}
              size="sm"
              variant="outline"
            >
              <Sparkles className={`h-4 w-4 mr-2 ${generating ? 'animate-spin' : ''}`} />
              {generating ? 'Generating...' : 'Generate AI Suggestions'}
            </Button>
            <span className="text-sm text-muted-foreground">Updated {timeAgo}</span>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Adversarial analysis identifying vulnerabilities, weaknesses, and attack vectors for each platform
        </p>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${activeCompetitors.length + 1}, minmax(0, 1fr))` }}>
            <TabsTrigger value="gripen">
              Gripen
            </TabsTrigger>
            {activeCompetitors.map((competitor) => (
              <TabsTrigger key={competitor} value={competitor.toLowerCase()}>
                {competitor}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="gripen" className="mt-6">
            {renderIssuesForPlatform(analysis.find(a => a.platform === 'Gripen') || { platform: 'Gripen', issues: [] })}
          </TabsContent>

          {activeCompetitors.map((competitor) => (
            <TabsContent key={competitor} value={competitor.toLowerCase()} className="mt-6">
              {renderIssuesForPlatform(analysis.find(a => a.platform === competitor) || { platform: competitor, issues: [] })}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </Card>
  );
};
