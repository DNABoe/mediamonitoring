import { TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface HotnessMeterProps {
  fighter: string;
  score: number;
  trend: "up" | "down";
}

export const HotnessMeter = ({ fighter, score, trend }: HotnessMeterProps) => {
  const normalizedScore = Math.min(Math.max(score, 0), 100);
  
  const getColorClass = () => {
    if (normalizedScore >= 70) return "text-success";
    if (normalizedScore >= 40) return "text-warning";
    return "text-muted-foreground";
  };

  const getGlowClass = () => {
    if (normalizedScore >= 70) return "shadow-glow-success";
    if (normalizedScore >= 40) return "shadow-glow-accent";
    return "";
  };

  return (
    <Card className={`p-6 border-2 transition-all duration-300 ${getGlowClass()}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-2xl font-bold">{fighter}</h3>
        <div className="flex items-center gap-2">
          {trend === "up" ? (
            <TrendingUp className="h-5 w-5 text-success" />
          ) : (
            <TrendingDown className="h-5 w-5 text-destructive" />
          )}
          <span className="text-sm text-muted-foreground">24h</span>
        </div>
      </div>

      <div className="relative">
        <div className="flex items-end justify-center mb-4">
          <span className={`text-6xl font-black ${getColorClass()}`}>
            {normalizedScore.toFixed(0)}
          </span>
          <span className="text-2xl text-muted-foreground mb-2">/100</span>
        </div>

        <Progress value={normalizedScore} className="h-3 mb-2" />

        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Cold</span>
          <span>Hotness Score</span>
          <span>🔥 Hot</span>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-border">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Volume</div>
            <div className="font-semibold">{Math.round(normalizedScore * 0.4)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Sentiment</div>
            <div className="font-semibold">{Math.round(normalizedScore * 0.25)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Engagement</div>
            <div className="font-semibold">{Math.round(normalizedScore * 0.15)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Momentum</div>
            <div className="font-semibold">{Math.round(normalizedScore * 0.1)}</div>
          </div>
        </div>
      </div>
    </Card>
  );
};
