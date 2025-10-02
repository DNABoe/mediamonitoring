import { Card } from "@/components/ui/card";
import { TrendingUp, ChevronDown, ChevronUp } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface WinnerMetarProps {
  gripenScore: number;
  f35Score: number;
}

export const WinnerMetar = ({ gripenScore, f35Score }: WinnerMetarProps) => {
  const [showSettings, setShowSettings] = useState(false);
  const [weights, setWeights] = useState({
    media: 35,
    political: 25,
    industrial: 20,
    cost: 10,
    capabilities: 10,
  });
  const [dimensionScores, setDimensionScores] = useState<{
    gripen: Record<string, number>;
    f35: Record<string, number>;
  } | null>(null);

  const calculateWeightedScores = (currentWeights: typeof weights) => {
    if (!dimensionScores) return { gripen: 0, f35: 0 };

    const calculateTotal = (scores: Record<string, number>) => {
      return (
        (scores.media || 0) * (currentWeights.media / 100) +
        (scores.political || 0) * (currentWeights.political / 100) +
        (scores.industrial || 0) * (currentWeights.industrial / 100) +
        (scores.cost || 0) * (currentWeights.cost / 100) +
        (scores.capabilities || 0) * (currentWeights.capabilities / 100)
      );
    };

    return {
      gripen: calculateTotal(dimensionScores.gripen),
      f35: calculateTotal(dimensionScores.f35),
    };
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
        setDimensionScores({
          gripen: scores.gripen || {},
          f35: scores.f35 || {},
        });
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

  const calculatedScores = calculateWeightedScores(weights);
  const displayGripen = calculatedScores.gripen || gripenScore;
  const displayF35 = calculatedScores.f35 || f35Score;
  const total = displayGripen + displayF35;
  const gripenPercent = total > 0 ? (displayGripen / total) * 100 : 50;
  const f35Percent = total > 0 ? (displayF35 / total) * 100 : 50;

  const leader = displayGripen > displayF35 ? "Gripen" : "F-35";
  const delta = Math.abs(displayGripen - displayF35).toFixed(1);

  const totalWeight = Object.values(weights).reduce((sum, val) => sum + val, 0);

  const handleWeightChange = (key: keyof typeof weights, value: number[]) => {
    const newValue = value[0];
    const currentTotal = totalWeight - weights[key];
    
    // Only allow change if it won't exceed 100
    if (currentTotal + newValue <= 100) {
      const newWeights = { ...weights, [key]: newValue };
      setWeights(newWeights);
      // Auto-save on change
      saveWeights(newWeights);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold">Winner</h3>
        <div className="flex items-center gap-2 px-3 py-1 bg-accent/20 rounded-full">
          <TrendingUp className="h-4 w-4 text-accent" />
          <span className="text-sm font-semibold">Δ {delta}</span>
        </div>
      </div>

      <div className="relative h-16 rounded-full overflow-hidden bg-gradient-to-r from-success via-warning to-destructive mb-4">
        <div
          className="absolute top-0 h-full w-1 bg-foreground shadow-lg transition-all duration-500"
          style={{ left: `${f35Percent}%` }}
        >
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-card px-3 py-1 rounded shadow-lg border border-border">
            <div className="text-xs font-bold whitespace-nowrap">
              {leader} Likely
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between text-sm mb-6">
        <div className="text-left">
          <div className="font-bold text-success">Gripen</div>
          <div className="text-muted-foreground">{gripenPercent.toFixed(1)}%</div>
        </div>
        <div className="text-center text-muted-foreground">
          Likelihood to Win
        </div>
        <div className="text-right">
          <div className="font-bold text-destructive">F-35</div>
          <div className="text-muted-foreground">{f35Percent.toFixed(1)}%</div>
        </div>
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
            {Object.entries(weights).map(([key, value]) => (
              <div key={key} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="capitalize font-medium">{key}</span>
                  <span className="font-semibold text-primary">{value}%</span>
                </div>
                <Slider
                  value={[value]}
                  onValueChange={(val) => handleWeightChange(key as keyof typeof weights, val)}
                  max={100}
                  step={1}
                  className="w-full"
                  disabled={totalWeight !== 100 && value === 0}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};
