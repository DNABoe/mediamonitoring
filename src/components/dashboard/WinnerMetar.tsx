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
      toast.success('Weights saved!');
    }
  };

  const total = gripenScore + f35Score;
  const gripenPercent = total > 0 ? (gripenScore / total) * 100 : 50;
  const f35Percent = total > 0 ? (f35Score / total) * 100 : 50;

  const leader = gripenScore > f35Score ? "Gripen" : "F-35";
  const delta = Math.abs(gripenScore - f35Score).toFixed(1);

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
