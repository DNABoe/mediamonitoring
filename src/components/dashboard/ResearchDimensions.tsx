import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, TrendingUp, DollarSign, Users, Globe, Zap, Building } from "lucide-react";

interface ResearchReport {
  capability_analysis: string;
  cost_analysis: string;
  political_analysis: string;
  industrial_cooperation: string;
  geopolitical_analysis: string;
  media_tonality: any;
  sources: any;
}

export const ResearchDimensions = () => {
  const [report, setReport] = useState<ResearchReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLatestReport();

    const channel = supabase
      .channel('research-dimensions-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'research_reports' },
        () => {
          console.log('Research reports changed, refetching...');
          fetchLatestReport();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchLatestReport = async () => {
    try {
      const { data, error } = await supabase
        .from('research_reports')
        .select('capability_analysis, cost_analysis, political_analysis, industrial_cooperation, geopolitical_analysis, media_tonality, sources')
        .order('report_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching research dimensions:', error);
        throw error;
      }
      
      console.log('Research report data:', data);
      setReport(data);
    } catch (error) {
      console.error('Error fetching research dimensions:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Card>
    );
  }

  if (!report) {
    return (
      <Card className="p-6">
        <div className="text-center text-muted-foreground py-12">
          No dimensional analysis available yet
        </div>
      </Card>
    );
  }

  const getSentimentBadge = (sentiment: number) => {
    if (sentiment > 0.3) return <Badge variant="default" className="bg-green-500">Positive</Badge>;
    if (sentiment < -0.3) return <Badge variant="destructive">Negative</Badge>;
    return <Badge variant="secondary">Neutral</Badge>;
  };

  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold mb-6">Analysis by Dimension</h2>

      <Tabs defaultValue="capability" className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
          <TabsTrigger value="capability">
            <Zap className="h-4 w-4 mr-2" />
            Capability
          </TabsTrigger>
          <TabsTrigger value="cost">
            <DollarSign className="h-4 w-4 mr-2" />
            Cost
          </TabsTrigger>
          <TabsTrigger value="political">
            <Users className="h-4 w-4 mr-2" />
            Political
          </TabsTrigger>
          <TabsTrigger value="industrial">
            <Building className="h-4 w-4 mr-2" />
            Industrial
          </TabsTrigger>
          <TabsTrigger value="geopolitical">
            <Globe className="h-4 w-4 mr-2" />
            Geopolitical
          </TabsTrigger>
          <TabsTrigger value="sentiment">
            <TrendingUp className="h-4 w-4 mr-2" />
            Sentiment
          </TabsTrigger>
        </TabsList>

        <TabsContent value="capability" className="mt-6">
          <div className="prose prose-sm max-w-none">
            <p className="whitespace-pre-line">{report.capability_analysis}</p>
          </div>
        </TabsContent>

        <TabsContent value="cost" className="mt-6">
          <div className="prose prose-sm max-w-none">
            <p className="whitespace-pre-line">{report.cost_analysis}</p>
          </div>
        </TabsContent>

        <TabsContent value="political" className="mt-6">
          <div className="prose prose-sm max-w-none">
            <p className="whitespace-pre-line">{report.political_analysis}</p>
          </div>
        </TabsContent>

        <TabsContent value="industrial" className="mt-6">
          <div className="prose prose-sm max-w-none">
            <p className="whitespace-pre-line">{report.industrial_cooperation}</p>
          </div>
        </TabsContent>

        <TabsContent value="geopolitical" className="mt-6">
          <div className="prose prose-sm max-w-none">
            <p className="whitespace-pre-line">{report.geopolitical_analysis}</p>
          </div>
        </TabsContent>

        <TabsContent value="sentiment" className="mt-6">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">Media Sentiment Analysis</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Gripen</span>
                    {getSentimentBadge(report.media_tonality?.gripen_sentiment || 0)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Score: {(report.media_tonality?.gripen_sentiment || 0).toFixed(2)}
                  </div>
                  {report.media_tonality?.gripen_themes && (
                    <div className="mt-3 space-y-1">
                      {report.media_tonality.gripen_themes.map((theme: string, i: number) => (
                        <div key={i} className="text-sm">• {theme}</div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">F-35</span>
                    {getSentimentBadge(report.media_tonality?.f35_sentiment || 0)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Score: {(report.media_tonality?.f35_sentiment || 0).toFixed(2)}
                  </div>
                  {report.media_tonality?.f35_themes && (
                    <div className="mt-3 space-y-1">
                      {report.media_tonality.f35_themes.map((theme: string, i: number) => (
                        <div key={i} className="text-sm">• {theme}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {report.media_tonality?.sentiment_summary && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm">{report.media_tonality.sentiment_summary}</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {report.sources && Array.isArray(report.sources) && report.sources.length > 0 && (
        <div className="mt-6 pt-6 border-t">
          <h3 className="text-sm font-semibold mb-3">Key Sources Referenced</h3>
          <div className="flex flex-wrap gap-2">
            {report.sources.map((source: string, i: number) => (
              <Badge key={i} variant="outline" className="text-xs">
                {source}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};