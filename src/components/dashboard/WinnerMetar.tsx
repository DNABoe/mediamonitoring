import { Card } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

interface WinnerMetarProps {
  gripenScore: number;
  f35Score: number;
}

export const WinnerMetar = ({ gripenScore, f35Score }: WinnerMetarProps) => {
  const total = gripenScore + f35Score;
  const gripenPercent = total > 0 ? (gripenScore / total) * 100 : 50;
  const f35Percent = total > 0 ? (f35Score / total) * 100 : 50;

  const leader = gripenScore > f35Score ? "Gripen" : "F-35";
  const delta = Math.abs(gripenScore - f35Score).toFixed(1);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold">Winner METAR</h3>
        <div className="flex items-center gap-2 px-3 py-1 bg-accent/20 rounded-full">
          <TrendingUp className="h-4 w-4 text-accent" />
          <span className="text-sm font-semibold">Δ {delta}</span>
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

      <div className="grid grid-cols-5 gap-3 text-xs">
        <div className="text-center">
          <div className="text-muted-foreground mb-1">Media</div>
          <div className="font-semibold">35%</div>
        </div>
        <div className="text-center">
          <div className="text-muted-foreground mb-1">Political</div>
          <div className="font-semibold">25%</div>
        </div>
        <div className="text-center">
          <div className="text-muted-foreground mb-1">Industrial</div>
          <div className="font-semibold">20%</div>
        </div>
        <div className="text-center">
          <div className="text-muted-foreground mb-1">Cost</div>
          <div className="font-semibold">10%</div>
        </div>
        <div className="text-center">
          <div className="text-muted-foreground mb-1">NATO</div>
          <div className="font-semibold">10%</div>
        </div>
      </div>
    </Card>
  );
};
