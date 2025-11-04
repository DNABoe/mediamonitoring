import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface BackgroundAnalysisProps {
  activeCountry: string;
  countryName: string;
  activeCompetitors: string[];
}

interface AnalysisData {
  id: string;
  country: string;
  competitors: string[];
  procurement_context: string;
  competitor_overview: string;
  gripen_overview: string;
  political_context: string;
  economic_factors: string;
  geopolitical_factors: string;
  historical_patterns: string;
  industry_cooperation: string;
  created_at: string;
}

export const BackgroundAnalysis = ({ 
  activeCountry, 
  countryName, 
  activeCompetitors 
}: BackgroundAnalysisProps) => {
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchAnalysis();
  }, [activeCountry, activeCompetitors]);

  const fetchAnalysis = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if analysis exists for this country and competitors
      const { data, error } = await supabase
        .from('background_analysis')
        .select('*')
        .eq('country', activeCountry)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setAnalysis(data as AnalysisData | null);
    } catch (error) {
      console.error('Error fetching analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateAnalysis = async () => {
    try {
      setGenerating(true);
      const { data, error } = await supabase.functions.invoke('generate-background-analysis', {
        body: {
          country: activeCountry,
          countryName,
          competitors: activeCompetitors,
        }
      });

      if (error) throw error;

      toast({
        title: "Analysis generated",
        description: "Comprehensive background analysis completed",
      });

      fetchAnalysis();
    } catch (error) {
      console.error('Error generating analysis:', error);
      toast({
        title: "Error",
        description: "Failed to generate background analysis",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Card>
    );
  }

  if (!analysis) {
    return (
      <Card className="p-6">
        <div className="text-center space-y-4">
          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground" />
          <h3 className="text-xl font-semibold">Background Analysis Not Available</h3>
          <p className="text-muted-foreground">
            Generate a comprehensive AI-powered background analysis covering procurement context, 
            competitor aircraft, political factors, and strategic considerations for {countryName}.
          </p>
          <Button onClick={generateAnalysis} disabled={generating}>
            {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {generating ? "Generating Analysis..." : "Generate Background Analysis"}
          </Button>
        </div>
      </Card>
    );
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatAnalysisText = (text: string) => {
    const sections = text.split('\n\n');
    
    return sections.map((section, idx) => {
      const lines = section.split('\n');
      
      // Check if this is a list section
      const isList = lines.some(line => line.trim().startsWith('-') || line.trim().startsWith('•'));
      
      if (isList) {
        return (
          <div key={idx} className="space-y-2 mb-4">
            {lines.map((line, lineIdx) => {
              const trimmed = line.trim();
              if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
                return (
                  <div key={lineIdx} className="flex gap-3">
                    <span className="text-primary font-bold mt-1">•</span>
                    <p className="flex-1 text-foreground/90 leading-relaxed">
                      {trimmed.substring(1).trim()}
                    </p>
                  </div>
                );
              }
              return null;
            })}
          </div>
        );
      }
      
      // Check if this looks like a section header (ends with : or is short and emphatic)
      if (section.endsWith(':') || (section.length < 100 && !section.includes('.'))) {
        return (
          <h4 key={idx} className="text-base font-semibold text-foreground mt-4 mb-2">
            {section}
          </h4>
        );
      }
      
      // Regular paragraph
      return (
        <p key={idx} className="text-foreground/90 leading-relaxed mb-4">
          {section}
        </p>
      );
    });
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="h-6 w-6 text-primary" />
            <div>
              <h2 className="text-2xl font-bold">Background Analysis</h2>
              <p className="text-sm text-muted-foreground">
                Comprehensive context for {countryName} fighter procurement
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              Generated {formatDate(analysis.created_at)}
            </Badge>
            <Button
              onClick={generateAnalysis}
              variant="outline"
              size="sm"
              disabled={generating}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${generating ? 'animate-spin' : ''}`} />
              Regenerate
            </Button>
          </div>
        </div>

        <Tabs defaultValue="procurement" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="procurement">Procurement</TabsTrigger>
            <TabsTrigger value="competitors">Competitors</TabsTrigger>
            <TabsTrigger value="political">Political</TabsTrigger>
            <TabsTrigger value="strategic">Strategic</TabsTrigger>
            <TabsTrigger value="industry">Industry</TabsTrigger>
          </TabsList>

          <TabsContent value="procurement" className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-primary border-b pb-2">Procurement Context</h3>
              <div className="text-sm">
                {formatAnalysisText(analysis.procurement_context)}
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-semibold text-primary border-b pb-2">Historical Patterns</h3>
              <div className="text-sm">
                {formatAnalysisText(analysis.historical_patterns)}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="competitors" className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-primary border-b pb-2">Saab Gripen</h3>
              <div className="text-sm">
                {formatAnalysisText(analysis.gripen_overview)}
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-semibold text-primary border-b pb-2">Competitor Aircraft</h3>
              <div className="flex flex-wrap gap-2 mb-4">
                {activeCompetitors.map(competitor => (
                  <Badge key={competitor} variant="outline">{competitor}</Badge>
                ))}
              </div>
              <div className="text-sm">
                {formatAnalysisText(analysis.competitor_overview)}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="political" className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-primary border-b pb-2">Political Context</h3>
              <div className="text-sm">
                {formatAnalysisText(analysis.political_context)}
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-semibold text-primary border-b pb-2">Economic Factors</h3>
              <div className="text-sm">
                {formatAnalysisText(analysis.economic_factors)}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="strategic" className="space-y-4">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-primary border-b pb-2">Geopolitical Factors</h3>
              <div className="text-sm">
                {formatAnalysisText(analysis.geopolitical_factors)}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="industry" className="space-y-4">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-primary border-b pb-2">Industry Cooperation Analysis</h3>
              <div className="text-sm">
                {formatAnalysisText(analysis.industry_cooperation)}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Card>
  );
};
