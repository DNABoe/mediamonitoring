import { Card } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { TrendingUp } from "lucide-react";

interface SentimentDataPoint {
  date: string;
  [key: string]: number | string; // Dynamic keys for each fighter
}

interface SentimentOverTimeChartProps {
  activeCompetitors: string[];
  data: SentimentDataPoint[];
}

const COLORS = {
  'Gripen': '#3b82f6', // blue
  'F-35': '#ef4444',   // red
  'F-16': '#10b981',   // green
  'Eurofighter': '#f59e0b', // amber
  'Rafale': '#8b5cf6', // purple
  'F-18': '#ec4899',   // pink
};

export const SentimentOverTimeChart = ({ activeCompetitors, data }: SentimentOverTimeChartProps) => {
  const fighters = ['Gripen', ...activeCompetitors];

  const formatYAxis = (value: number) => {
    return `${(value * 100).toFixed(0)}%`;
  };

  const formatTooltip = (value: any) => {
    if (typeof value === 'number') {
      return `${(value * 100).toFixed(1)}%`;
    }
    return value;
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-2xl font-bold">Sentiment Timeline</h2>
            <p className="text-sm text-muted-foreground">
              Media sentiment trends over time (-100% to +100%)
            </p>
          </div>
        </div>

        {data.length === 0 ? (
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            No sentiment data available yet. Start collecting articles to see trends.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => format(new Date(value), 'MMM d')}
                stroke="hsl(var(--foreground))"
                tick={{ fill: 'hsl(var(--foreground))' }}
                className="text-xs"
              />
              <YAxis
                tickFormatter={formatYAxis}
                domain={[-1, 1]}
                ticks={[-1, -0.5, 0, 0.5, 1]}
                stroke="hsl(var(--foreground))"
                tick={{ fill: 'hsl(var(--foreground))' }}
                className="text-xs"
              />
              <Tooltip
                formatter={formatTooltip}
                labelFormatter={(label) => format(new Date(label), 'MMM d, yyyy')}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                }}
              />
              <Legend />
              {fighters.map((fighter) => (
                <Line
                  key={fighter}
                  type="monotone"
                  dataKey={fighter}
                  stroke={COLORS[fighter as keyof typeof COLORS] || '#64748b'}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  name={fighter}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
};
