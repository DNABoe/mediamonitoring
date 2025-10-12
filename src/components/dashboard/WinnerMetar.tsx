import { Card } from "@/components/ui/card";
import { TrendingUp, ChevronDown, ChevronUp } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface WinnerMetarProps {
  activeCompetitors: string[];
}

export const WinnerMetar = ({ activeCompetitors }: WinnerMetarProps) => {
  const FIGHTER_COLORS: Record<string, string> = {
    'Gripen': '#10b981',
    'F-35': '#3b82f6',
    'Rafale': '#f59e0b',
    'F-16V': '#8b5cf6',
    'Eurofighter': '#ef4444',
    'F/A-50': '#ec4899'
  };
  const [showSettings, setShowSettings] = useState(false);
  const [showScores, setShowScores] = useState(false);
  const [weights, setWeights] = useState({
    media: 35,
    political: 25,
    industrial: 20,
    cost: 10,
    capabilities: 10,
  });
  const [dimensionScores, setDimensionScores] = useState<Record<string, Record<string, number>> | null>(null);
  const [competitorScores, setCompetitorScores] = useState<Record<string, number>>({});
  const [aiSuggestion, setAiSuggestion] = useState<{
    rationale: string;
    weights: typeof weights;
  } | null>(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);

  const calculateWeightedScores = (currentWeights: typeof weights) => {
    if (!dimensionScores) return {};

    const calculateTotal = (scores: Record<string, number>) => {
      return (
        (scores.media || 0) * (currentWeights.media / 100) +
        (scores.political || 0) * (currentWeights.political / 100) +
        (scores.industrial || 0) * (currentWeights.industrial / 100) +
        (scores.cost || 0) * (currentWeights.cost / 100) +
        (scores.capabilities || 0) * (currentWeights.capabilities / 100)
      );
    };

    const results: Record<string, number> = {};
    Object.keys(dimensionScores).forEach(fighter => {
      results[fighter] = calculateTotal(dimensionScores[fighter]);
    });

    return results;
  };

  const fetchDimensionScores = async () => {
    const { data: report } = await supabase
      .from('research_reports')
      .select('media_tonality')
      .order('report_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (report?.media_tonality) {
      const tonality = report.media_tonality as any;
      const scores = tonality.dimension_scores;
      
      if (scores) {
        setDimensionScores(scores);
        
        // Calculate initial weighted scores
        const weighted = calculateWeightedScores(weights);
        setCompetitorScores(weighted);
      }
    }
  };

  useEffect(() => {
    const loadWeights = async () => {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'winner_weights')
        .maybeSingle();
      
      if (data?.value) {
        setWeights(data.value as typeof weights);
      }
    };
    
    loadWeights();
    fetchDimensionScores();

    const settingsChannel = supabase
      .channel('settings-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'settings', filter: 'key=eq.winner_weights' },
        (payload) => {
          if (payload.new && 'value' in payload.new) {
            setWeights(payload.new.value as typeof weights);
            toast.success('Weights updated - scores recalculated');
          }
        }
      )
      .subscribe();

    const reportsChannel = supabase
      .channel('research-reports-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'research_reports' },
        () => {
          fetchDimensionScores();
          toast.success('New research data loaded');
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(settingsChannel);
      supabase.removeChannel(reportsChannel);
    };
  }, []);

  const saveWeights = async (newWeights: typeof weights) => {
    const { error } = await supabase
      .from('settings')
      .upsert({
        key: 'winner_weights',
        value: newWeights
      }, {
        onConflict: 'key'
      });
    
    if (error) {
      console.error('Failed to save weights:', error);
    }
  };

  // Recalculate scores when weights change
  useEffect(() => {
    if (dimensionScores) {
      const weighted = calculateWeightedScores(weights);
      setCompetitorScores(weighted);
    }
  }, [weights, dimensionScores]);

  const gripenScore = competitorScores['gripen'] || 0;
  const allCompetitors = activeCompetitors.filter(c => competitorScores[c.toLowerCase().replace(/[^a-z0-9]/g, '_')] !== undefined);
  
  // Calculate comparison with strongest competitor
  const competitorScoreValues = allCompetitors.map(comp => {
    const key = comp.toLowerCase().replace(/[^a-z0-9]/g, '_');
    return { name: comp, score: competitorScores[key] || 0 };
  });
  
  const strongestCompetitor = competitorScoreValues.reduce((max, current) => 
    current.score > max.score ? current : max
  , { name: allCompetitors[0] || 'F-35', score: 0 });

  const total = gripenScore + strongestCompetitor.score;
  const gripenPercent = total > 0 ? (gripenScore / total) * 100 : 50;
  const competitorPercent = total > 0 ? (strongestCompetitor.score / total) * 100 : 50;

  const leader = gripenScore > strongestCompetitor.score ? "Gripen" : strongestCompetitor.name;
  const delta = Math.abs(gripenScore - strongestCompetitor.score).toFixed(1);

  const totalWeight = Object.values(weights).reduce((sum, val) => sum + val, 0);

  const handleWeightChange = (key: keyof typeof weights, value: number[]) => {
    const newValue = value[0];
    const currentTotal = totalWeight - weights[key];
    
    // Always allow the change, but cap at what's available
    const maxAllowed = 100 - currentTotal;
    const finalValue = Math.min(newValue, maxAllowed);
    
    const newWeights = { ...weights, [key]: finalValue };
    setWeights(newWeights);
    // Auto-save on change
    saveWeights(newWeights);
  };

  const dimensionOrder: (keyof typeof weights)[] = ['media', 'political', 'industrial', 'cost', 'capabilities'];

  const hasScores = dimensionScores && Object.keys(dimensionScores).length > 0;

  const fetchAiSuggestion = async () => {
    setLoadingSuggestion(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-dimension-weights');
      
      if (error) throw error;
      
      if (data) {
        setAiSuggestion(data);
        toast.success('AI weight suggestions generated');
      }
    } catch (error) {
      console.error('Error fetching AI suggestion:', error);
      toast.error('Failed to generate AI suggestions');
    } finally {
      setLoadingSuggestion(false);
    }
  };

  const applyAiSuggestion = () => {
    if (aiSuggestion?.weights) {
      setWeights(aiSuggestion.weights);
      saveWeights(aiSuggestion.weights);
      toast.success('AI suggested weights applied');
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold">Weighted Score Comparison</h3>
        <div className="flex items-center gap-2 px-3 py-1 bg-accent/20 rounded-full">
          <TrendingUp className="h-4 w-4 text-accent" />
          <span className="text-sm font-semibold">Leader: {leader}</span>
        </div>
      </div>

      {/* Score bars for all competitors */}
      <div className="space-y-3 mb-6">
        <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold" style={{ color: FIGHTER_COLORS['Gripen'] }}>Gripen</span>
                        <span className="text-sm font-bold">{gripenScore.toFixed(1)}</span>
                      </div>
                      <div className="relative h-8 rounded-full overflow-hidden bg-muted">
                        <div 
                          className="absolute top-0 left-0 h-full transition-all duration-500"
                          style={{ 
                            width: `${Math.min(100, (gripenScore / 10) * 100)}%`,
                            background: `linear-gradient(to right, ${FIGHTER_COLORS['Gripen']}, ${FIGHTER_COLORS['Gripen']}cc)`
                          }}
                        />
                      </div>
                    </div>

                    {allCompetitors.map(comp => {
                      const key = comp.toLowerCase().replace(/[^a-z0-9]/g, '_');
                      const score = competitorScores[key] || 0;
                      const color = FIGHTER_COLORS[comp] || '#6b7280';
                      return (
                        <div key={comp} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-semibold" style={{ color }}>{comp}</span>
                            <span className="text-sm font-bold">{score.toFixed(1)}</span>
                          </div>
                          <div className="relative h-8 rounded-full overflow-hidden bg-muted">
                            <div 
                              className="absolute top-0 left-0 h-full transition-all duration-500"
                              style={{ 
                                width: `${Math.min(100, (score / 10) * 100)}%`,
                                background: `linear-gradient(to right, ${color}, ${color}cc)`
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
      </div>

      <div className="text-center text-sm text-muted-foreground mb-6 pb-6 border-b">
        Scores based on weighted analysis (0-10 scale)
      </div>

      <div className="space-y-3">
        <Button
          variant="outline"
          size="sm"
          className="w-full flex items-center justify-between"
          onClick={() => setShowSettings(!showSettings)}
        >
          <span className="text-sm font-medium">
            {showSettings ? 'Hide' : 'Adjust'} Dimension Weights
          </span>
          {showSettings ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
        
        {showSettings && (
          <div className="space-y-4 p-4 bg-card border border-border rounded-lg shadow-sm">
            <div className="text-sm text-muted-foreground mb-2 flex items-center justify-between">
              <span>Total: {totalWeight}%</span>
              {totalWeight !== 100 && (
                <span className="text-xs text-warning">Must equal 100%</span>
              )}
            </div>
            {dimensionOrder.map((key) => (
              <div key={key} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="capitalize font-medium">{key}</span>
                  <span className="font-semibold text-primary">{weights[key]}%</span>
                </div>
                <Slider
                  value={[weights[key]]}
                  onValueChange={(val) => handleWeightChange(key, val)}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {hasScores && (
        <div className="mt-3">
          <Button
            variant="ghost"
            size="sm"
            className="w-full flex items-center justify-between text-xs"
            onClick={() => setShowScores(!showScores)}
          >
            <span className="text-muted-foreground">
              {showScores ? 'Hide' : 'View'} AI Analysis Scores
            </span>
            {showScores ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
          
          {showScores && (
            <div className="mt-3 space-y-3">
              <div className="p-4 bg-muted/20 border border-border rounded-lg">
                <div className="text-xs font-semibold text-muted-foreground mb-3">
                  Raw AI Analysis Scores (0-10 scale)
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="font-medium text-muted-foreground">Dimension</div>
                  <div className="font-medium text-center">Scores</div>
                  
                  {dimensionOrder.map((key) => (
                    <>
                      <div key={`${key}-label`} className="capitalize text-foreground">
                        {key}
                      </div>
                      <div key={`${key}-scores`} className="text-xs space-y-1">
                        <div className="flex justify-between">
                          <span style={{ color: FIGHTER_COLORS['Gripen'] }}>Gripen:</span>
                          <span className="font-semibold">{dimensionScores.gripen?.[key]?.toFixed(1) || 'N/A'}</span>
                        </div>
                        {allCompetitors.map(comp => {
                          const compKey = comp.toLowerCase().replace(/[^a-z0-9]/g, '_');
                          const color = FIGHTER_COLORS[comp] || '#6b7280';
                          return (
                            <div key={comp} className="flex justify-between">
                              <span style={{ color }}>{comp}:</span>
                              <span className="font-semibold">{dimensionScores[compKey]?.[key]?.toFixed(1) || 'N/A'}</span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-accent/10 border border-accent/30 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold text-foreground">
                    AI Weight Suggestions
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={fetchAiSuggestion}
                    disabled={loadingSuggestion}
                    className="h-7 text-xs"
                  >
                    {loadingSuggestion ? 'Analyzing...' : 'Generate'}
                  </Button>
                </div>
                
                {aiSuggestion && (
                  <div className="space-y-3 mt-3">
                    <p className="text-xs text-muted-foreground italic">
                      {aiSuggestion.rationale}
                    </p>
                    
                    <div className="grid grid-cols-5 gap-2 text-xs">
                      {dimensionOrder.map((key) => (
                        <div key={key} className="text-center">
                          <div className="capitalize text-muted-foreground mb-1">{key}</div>
                          <div className="font-bold text-accent">{aiSuggestion.weights[key]}%</div>
                        </div>
                      ))}
                    </div>
                    
                    <Button
                      size="sm"
                      onClick={applyAiSuggestion}
                      className="w-full h-7 text-xs"
                    >
                      Apply These Weights
                    </Button>
                  </div>
                )}
                
                {!aiSuggestion && !loadingSuggestion && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Click Generate to get AI-powered weight recommendations based on the research analysis.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};
