import { Card } from "@/components/ui/card";
import { TrendingUp, ChevronDown, ChevronUp, Brain, Loader2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { useUserSettings } from "@/hooks/useUserSettings";

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
  const [isGeneratingResearch, setIsGeneratingResearch] = useState(false);
  const { settings: userSettings } = useUserSettings();

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

    console.log('Fetched report:', report);
    console.log('Media tonality:', report?.media_tonality);

    if (report?.media_tonality) {
      const tonality = report.media_tonality as any;
      console.log('Tonality object:', tonality);
      console.log('Looking for dimension_scores:', tonality.dimension_scores);
      
      const scores = tonality.dimension_scores;
      
      if (scores) {
        console.log('Found dimension scores:', scores);
        setDimensionScores(scores);
        
        // Calculate initial weighted scores
        const weighted = calculateWeightedScores(weights);
        setCompetitorScores(weighted);
      } else {
        console.log('No dimension_scores found in tonality - trying alternative structure...');
        // The data might be directly in tonality with fighter names as keys
        console.log('Tonality keys:', Object.keys(tonality));
        
        // Check if tonality has fighter data directly
        if (tonality.Gripen || tonality['F-35']) {
          console.log('Found fighter data in tonality root');
          // Data is structured as { Gripen: {...}, F-35: {...}, etc }
          // We need to convert sentiment to dimension scores
          const convertedScores: Record<string, Record<string, number>> = {};
          
          Object.keys(tonality).forEach(fighter => {
            const fighterKey = fighter.toLowerCase().replace(/[^a-z0-9]/g, '_');
            const sentiment = tonality[fighter].sentiment || 0;
            
            // Convert sentiment (-1 to 1) to a 0-10 scale for media dimension
            const mediaScore = ((sentiment + 1) / 2) * 10;
            
            convertedScores[fighterKey] = {
              media: mediaScore,
              political: 5, // Default neutral scores for other dimensions
              industrial: 5,
              cost: 5,
              capabilities: 5
            };
          });
          
          console.log('Converted scores:', convertedScores);
          setDimensionScores(convertedScores);
          
          const weighted = calculateWeightedScores(weights);
          setCompetitorScores(weighted);
        }
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

    // Auto-fetch AI suggestions on component mount
    setTimeout(() => {
      if (!aiSuggestion) {
        fetchAiSuggestion();
      }
    }, 1000);

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

  const handleGenerateResearch = async () => {
    setIsGeneratingResearch(true);
    
    try {
      toast.success('Research started - AI is analyzing fighter comparison data...');

      const { error } = await supabase.functions.invoke('research-fighter-comparison', {
        body: {
          country: userSettings.activeCountry,
          competitors: userSettings.activeCompetitors
        }
      });

      if (error) throw error;

      toast.success('Research complete - scores updated');
    } catch (error: any) {
      console.error('Error generating research:', error);
      toast.error(error.message || 'Failed to generate research');
    } finally {
      setIsGeneratingResearch(false);
    }
  };

  // Prepare radar chart data
  const radarData = dimensionOrder.map(dimension => {
    const dataPoint: any = { dimension: dimension.charAt(0).toUpperCase() + dimension.slice(1) };
    
    // Add Gripen
    dataPoint['Gripen'] = dimensionScores?.gripen?.[dimension] || 0;
    
    // Add all competitors
    allCompetitors.forEach(comp => {
      const key = comp.toLowerCase().replace(/[^a-z0-9]/g, '_');
      dataPoint[comp] = dimensionScores?.[key]?.[dimension] || 0;
    });
    
    return dataPoint;
  });

  // Calculate chance to win for all competitors
  const allScores = [
    { name: 'Gripen', score: gripenScore, color: FIGHTER_COLORS['Gripen'] },
    ...allCompetitors.map(comp => {
      const key = comp.toLowerCase().replace(/[^a-z0-9]/g, '_');
      return {
        name: comp,
        score: competitorScores[key] || 0,
        color: FIGHTER_COLORS[comp] || '#6b7280'
      };
    })
  ];
  
  const sortedScores = [...allScores].sort((a, b) => b.score - a.score);
  const topCompetitor = sortedScores[0];

  // Show loading or empty state
  if (!hasScores) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold">Competitor Analysis - Weighted Scores</h3>
            <p className="text-sm text-muted-foreground mt-1">AI-powered multi-dimensional assessment</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <Brain className="h-16 w-16 text-muted-foreground/50" />
          <div className="text-center">
            <p className="text-lg font-medium mb-2">No analysis data available yet</p>
            <p className="text-sm text-muted-foreground mb-6">Generate a research analysis to see AI-powered competitor scores</p>
          </div>
          <Button 
            onClick={handleGenerateResearch}
            disabled={isGeneratingResearch}
            size="lg"
          >
            {isGeneratingResearch ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Brain className="mr-2 h-4 w-4" />
                Generate Research Analysis
              </>
            )}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold">Competitor Analysis - Weighted Scores</h3>
          <p className="text-sm text-muted-foreground mt-1">AI-powered multi-dimensional assessment</p>
        </div>
        <div className="flex items-center gap-3">
          {hasScores && topCompetitor && (
            <div className="flex items-center gap-2 px-3 py-1 bg-accent/20 rounded-full">
              <TrendingUp className="h-4 w-4 text-accent" />
              <span className="text-sm font-semibold">Leader: {topCompetitor.name}</span>
            </div>
          )}
          <Button
            onClick={handleGenerateResearch}
            disabled={isGeneratingResearch}
            size="sm"
            variant="outline"
          >
            {isGeneratingResearch ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Brain className="mr-2 h-4 w-4" />
                Generate Analysis
              </>
            )}
          </Button>
        </div>
      </div>

      {!hasScores && !isGeneratingResearch && (
        <div className="text-center py-12 text-muted-foreground">
          <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Click "Generate Analysis" to see AI-powered competitor scores</p>
          <p className="text-sm mt-2">Based on multi-dimensional assessment</p>
        </div>
      )}

      {isGeneratingResearch && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {hasScores && (
        <>
          {/* AI Analysis Weights Info */}
          {aiSuggestion && (
            <div className="mb-4 p-3 bg-accent/10 border border-accent/30 rounded-lg">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <div className="text-xs font-semibold text-foreground mb-1">AI-Suggested Weights Used:</div>
                  <div className="flex gap-2 flex-wrap">
                    {dimensionOrder.map((key) => (
                      <span key={key} className="text-xs px-2 py-1 bg-accent/20 rounded">
                        <span className="capitalize font-medium">{key}:</span> {aiSuggestion.weights[key]}%
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2 italic">{aiSuggestion.rationale}</p>
            </div>
          )}

          {/* Thermometer Displays - More Compact */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mb-6">
            {sortedScores.map((item, index) => {
              const percentage = (item.score / 10) * 100;
              const isLeader = index === 0;
              
              return (
                <div key={item.name} className={`p-3 rounded-lg border ${isLeader ? 'border-accent bg-accent/5' : 'border-border'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1">
                      {isLeader && <span className="text-lg">🥇</span>}
                      <div>
                        <div className="text-xs font-bold" style={{ color: item.color }}>{item.name}</div>
                        {isLeader && <div className="text-[10px] text-accent font-semibold">Leader</div>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold" style={{ color: item.color }}>{item.score.toFixed(1)}</div>
                      <div className="text-[10px] text-muted-foreground">/ 10</div>
                    </div>
                  </div>
                  
                  {/* Thermometer - Compact */}
                  <div className="relative w-full h-32 flex justify-center">
                    <div className="relative w-8">
                      {/* Thermometer bulb */}
                      <div 
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full border-2"
                        style={{ 
                          backgroundColor: item.color,
                          borderColor: item.color,
                          boxShadow: `0 0 8px ${item.color}66`
                        }}
                      />
                      
                      {/* Thermometer tube */}
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-5 h-28 bg-muted rounded-t-full border-2 border-border overflow-hidden">
                        {/* Fill */}
                        <div 
                          className="absolute bottom-0 left-0 right-0 transition-all duration-500 rounded-t-full"
                          style={{ 
                            height: `${percentage}%`,
                            background: `linear-gradient(to top, ${item.color}, ${item.color}cc)`,
                          }}
                        />
                        
                        {/* Scale markers */}
                        <div className="absolute inset-0 flex flex-col justify-between py-1">
                          {[10, 8, 6, 4, 2, 0].map((val) => (
                            <div key={val} className="h-px bg-border/50" />
                          ))}
                        </div>
                      </div>
                      
                      {/* Scale labels */}
                      <div className="absolute bottom-4 -right-6 h-28 flex flex-col justify-between text-[10px] text-muted-foreground">
                        {[10, 8, 6, 4, 2, 0].map((val) => (
                          <span key={val}>{val}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  {/* Performance indicator */}
                  <div className="mt-1 text-center">
                    <div className="text-[10px] font-medium" style={{ color: item.color }}>
                      {percentage >= 80 ? 'Excellent' : percentage >= 60 ? 'Strong' : percentage >= 40 ? 'Moderate' : 'Weak'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Weight Adjustment Section */}
          <div className="space-y-3 mb-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-muted-foreground">Dimension Weights</h4>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowSettings(!showSettings)}
                className="h-7 text-xs"
              >
                {showSettings ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                {showSettings ? 'Hide' : 'Adjust'}
              </Button>
            </div>
            
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

          {/* Detailed Scores Section - Collapsible */}
          <div className="mt-4">
            <Button
              variant="ghost"
              size="sm"
              className="w-full flex items-center justify-between text-xs"
              onClick={() => setShowScores(!showScores)}
            >
              <span className="text-muted-foreground">
                {showScores ? 'Hide' : 'View'} Detailed Dimension Scores
              </span>
              {showScores ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
            
            {showScores && (
              <div className="mt-3 p-4 bg-muted/20 border border-border rounded-lg">
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
                          <span className="font-semibold" style={{ color: FIGHTER_COLORS['Gripen'] }}>{dimensionScores?.gripen?.[key]?.toFixed(1) || 'N/A'}</span>
                        </div>
                        {allCompetitors.map(comp => {
                          const compKey = comp.toLowerCase().replace(/[^a-z0-9]/g, '_');
                          const color = FIGHTER_COLORS[comp] || '#6b7280';
                          return (
                            <div key={comp} className="flex justify-between">
                              <span style={{ color }}>{comp}:</span>
                              <span className="font-semibold" style={{ color }}>{dimensionScores?.[compKey]?.[key]?.toFixed(1) || 'N/A'}</span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </Card>
  );
};
