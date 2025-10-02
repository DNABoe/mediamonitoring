import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame } from "lucide-react";

export const PoliticsHeatMap = () => {
  const topics = [
    { name: "Defense Budget 2025", heat: 85, summary: "Parliamentary debate on increased defense spending" },
    { name: "Corruption Scandal", heat: 72, summary: "Investigation into government contracts" },
    { name: "NATO Commitments", heat: 68, summary: "Meeting 2% GDP defense spending target" },
    { name: "Energy Crisis", heat: 54, summary: "Rising costs affecting procurement timelines" },
    { name: "Labor Strikes", heat: 45, summary: "Public sector unions demanding raises" },
    { name: "Election Polls", heat: 42, summary: "Shifting political landscape ahead of 2025" },
  ];

  const getHeatColor = (heat: number) => {
    if (heat >= 70) return "destructive";
    if (heat >= 50) return "default";
    return "secondary";
  };

  const getFlameIntensity = (heat: number) => {
    if (heat >= 70) return "🔥🔥🔥";
    if (heat >= 50) return "🔥🔥";
    return "🔥";
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <Flame className="h-5 w-5 text-accent" />
          Portugal Politics Heat
        </h3>
        <div className="text-xs text-muted-foreground">
          Topics affecting fighter program decision
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {topics.map((topic) => (
          <div
            key={topic.name}
            className="p-4 rounded-lg bg-secondary/50 border border-border hover:border-accent transition-all"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1">
                <div className="font-semibold text-sm mb-1">{topic.name}</div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {topic.summary}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-lg">{getFlameIntensity(topic.heat)}</span>
                <Badge variant={getHeatColor(topic.heat)} className="text-xs">
                  {topic.heat}
                </Badge>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
