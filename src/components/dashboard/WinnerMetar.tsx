import { Card } from "@/components/ui/card";
import { TrendingUp, Settings } from "lucide-react";
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
  const [calculatedScores, setCalculatedScores] = useState({ gripen: 0, f35: 0 });

  const calculateWeightedScores = async (currentWeights: typeof weights) => {
    const { data: scores } = await supabase
      .from('scores')
      .select('fighter, components')
      .order('created_at', { ascending: false })
      .limit(10);

    if (scores && scores.length > 0) {
      const gripenScores = scores.filter(s => s.fighter === 'Gripen');
      const f35Scores = scores.filter(s => s.fighter === 'F-35');
      
      const calculateWeighted = (fighterScores: typeof scores) => {
        if (fighterScores.length === 0) return 0;
        const latest = fighterScores[0];
        const components = latest.components as Record<string, number> || {};
        
        return (
          (components.media || 0) * currentWeights.media / 100 +
          (components.political || 0) * currentWeights.political / 100 +
          (components.industrial || 0) * currentWeights.industrial / 100 +
          (components.cost || 0) * currentWeights.cost / 100 +
          (components.capabilities || 0) * currentWeights.capabilities / 100
        );
      };
      
      setCalculatedScores({
        gripen: calculateWeighted(gripenScores),
        f35: calculateWeighted(f35Scores),
      });
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
        const loadedWeights = data.value as typeof weights;
        setWeights(loadedWeights);
        calculateWeightedScores(loadedWeights);
      } else {
        calculateWeightedScores(weights);
      }
    };
    loadWeights();

    const channel = supabase
      .channel('settings-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'settings', filter: 'key=eq.winner_weights' },
        (payload) => {
          if (payload.new && 'value' in payload.new) {
            const newWeights = payload.new.value as typeof weights;
            setWeights(newWeights);
            calculateWeightedScores(newWeights);
            toast.success('Weights updated - scores recalculated');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const saveWeights = async () => {
    const { error } = await supabase
      .from('settings')
      .upsert({
        key: 'winner_weights',
        value: weights
      }, {
        onConflict: 'key'
      });
    
    if (error) {
      toast.error('Failed to save weights');
    } else {
      calculateWeightedScores(weights);
      toast.success('Weights saved and scores recalculated!');
    }
  };

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
      setWeights({ ...weights, [key]: newValue });
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold">Winner</h3>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1 bg-accent/20 rounded-full">
            <TrendingUp className="h-4 w-4 text-accent" />
            <span className="text-sm font-semibold">Δ {delta}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="relative h-16 rounded-full overflow-hidden bg-gradient-to-r from-success via-warning to-destructive mb-4">
        <div
          className="absolute top-0 h-full w-1 bg-foreground shadow-lg transition-all duration-500"
          style={{ left: `${gripenPercent}%` }}
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

      {showSettings ? (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground mb-2">
            Adjust weights (Total: {totalWeight}%)
          </div>
          {Object.entries(weights).map(([key, value]) => (
            <div key={key} className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="capitalize">{key}</span>
                <span className="font-semibold">{value}%</span>
              </div>
              <Slider
                value={[value]}
                onValueChange={(val) => handleWeightChange(key as keyof typeof weights, val)}
                max={100}
                step={1}
                className="w-full"
              />
            </div>
          ))}
          {totalWeight !== 100 && (
            <div className="text-xs text-warning">
              Warning: Total must equal 100% (currently {totalWeight}%)
            </div>
          )}
          <Button 
            onClick={saveWeights}
            size="sm"
            className="w-full"
            disabled={totalWeight !== 100}
          >
            Save Weights
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-3 text-xs">
          <div className="text-center">
            <div className="text-muted-foreground mb-1">Media</div>
            <div className="font-semibold">{weights.media}%</div>
          </div>
          <div className="text-center">
            <div className="text-muted-foreground mb-1">Political</div>
            <div className="font-semibold">{weights.political}%</div>
          </div>
          <div className="text-center">
            <div className="text-muted-foreground mb-1">Industrial</div>
            <div className="font-semibold">{weights.industrial}%</div>
          </div>
          <div className="text-center">
            <div className="text-muted-foreground mb-1">Cost</div>
            <div className="font-semibold">{weights.cost}%</div>
          </div>
          <div className="text-center">
            <div className="text-muted-foreground mb-1">Capabilities</div>
            <div className="font-semibold">{weights.capabilities}%</div>
          </div>
        </div>
      )}
    </Card>
  );
};
