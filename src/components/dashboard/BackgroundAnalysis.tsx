import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen, RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { format } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
  const [previousAnalysis, setPreviousAnalysis] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  useEffect(() => {
    fetchAnalysis();
  }, [activeCountry, activeCompetitors]);

  const fetchAnalysis = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch the two most recent analyses for comparison
      const { data, error } = await supabase
        .from('background_analysis')
        .select('*')
        .eq('country', activeCountry)
        .order('created_at', { ascending: false })
        .limit(2);

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data && data.length > 0) {
        setAnalysis(data[0] as AnalysisData);
        if (data.length > 1) {
          setPreviousAnalysis(data[1] as AnalysisData);
        } else {
          setPreviousAnalysis(null);
        }
      } else {
        setAnalysis(null);
        setPreviousAnalysis(null);
      }
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

  const getChanges = () => {
    if (!previousAnalysis) return [];
    
    const changes: { text: string; type: 'increase' | 'decrease' }[] = [];
    
    // Compare procurement context
    if (analysis.procurement_context !== previousAnalysis.procurement_context) {
      changes.push({ text: "Procurement context updated with new developments", type: 'increase' });
    }
    
    // Compare political context
    if (analysis.political_context !== previousAnalysis.political_context) {
      changes.push({ text: "Political landscape analysis revised", type: 'increase' });
    }
    
    // Compare geopolitical factors
    if (analysis.geopolitical_factors !== previousAnalysis.geopolitical_factors) {
      changes.push({ text: "Geopolitical considerations updated", type: 'increase' });
    }
    
    // Compare economic factors
    if (analysis.economic_factors !== previousAnalysis.economic_factors) {
      changes.push({ text: "Economic analysis refreshed", type: 'increase' });
    }
    
    return changes;
  };

  const changes = getChanges();

  return (
    <Card className="p-3 sm:p-6">
      <div className="space-y-4">
        <div className={isMobile ? "space-y-2" : "flex items-center justify-between"}>
          <div className="flex items-center gap-2 sm:gap-3">
            <BookOpen className={isMobile ? "h-5 w-5 text-primary" : "h-6 w-6 text-primary"} />
            <div>
              <h2 className={isMobile ? "text-base font-bold" : "text-2xl font-bold"}>Background Analysis</h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {isMobile ? countryName : `Comprehensive context for ${countryName} fighter procurement`}
              </p>
            </div>
          </div>
          <div className={`flex items-center gap-2 ${isMobile ? 'w-full' : ''}`}>
            <Badge variant="secondary" className="text-xs">
              {isMobile ? format(new Date(analysis.created_at), 'MMM d') : `Generated ${formatDate(analysis.created_at)}`}
            </Badge>
            <Button
              onClick={generateAnalysis}
              variant="outline"
              size="sm"
              disabled={generating}
              className={isMobile ? 'flex-1' : ''}
            >
              <RefreshCw className={`h-4 w-4 ${isMobile ? '' : 'mr-2'} ${generating ? 'animate-spin' : ''}`} />
              {!isMobile && 'Regenerate'}
            </Button>
          </div>
        </div>

        {/* Changes since last analysis - collapsible and subtle */}
        {changes.length > 0 && (
          <Collapsible open={changesOpen} onOpenChange={setChangesOpen}>
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-2 border-t border-b">
                <span className="flex-1 text-left">
                  {changes.length} {changes.length === 1 ? 'change' : 'changes'} since last analysis
                </span>
                <TrendingUp className="h-3 w-3" />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="py-3 px-4 bg-muted/30 rounded-md mt-2 space-y-1.5">
                {changes.map((change, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs">
                    <span className="text-primary mt-0.5">•</span>
                    <span className="text-muted-foreground">{change.text}</span>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
        {!previousAnalysis && (
          <div className="text-xs text-muted-foreground py-2 border-t border-b text-center">
            First analysis generated. Changes will appear when you regenerate.
          </div>
        )}

        <Tabs defaultValue="procurement" className="w-full">
          <TabsList className={isMobile ? "grid w-full grid-cols-3" : "grid w-full grid-cols-5"}>
            <TabsTrigger value="procurement" className={isMobile ? "text-xs" : ""}>
              {isMobile ? "Proc." : "Procurement"}
            </TabsTrigger>
            <TabsTrigger value="competitors" className={isMobile ? "text-xs" : ""}>
              {isMobile ? "Comp." : "Competitors"}
            </TabsTrigger>
            <TabsTrigger value="political" className={isMobile ? "text-xs" : ""}>Political</TabsTrigger>
            {!isMobile && <TabsTrigger value="strategic">Strategic</TabsTrigger>}
            {!isMobile && <TabsTrigger value="industry">Industry</TabsTrigger>}
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
              <h3 className="text-lg font-semibold text-primary border-b pb-2">Competitor Overview</h3>
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
