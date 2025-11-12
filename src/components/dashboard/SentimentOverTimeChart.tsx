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
  'Gripen': '#3b82f6',
  // blue
  'F-35': '#ef4444',
  // red
  'F-16': '#10b981',
  // green
  'Eurofighter': '#f59e0b',
  // amber
  'Rafale': '#8b5cf6',
  // purple
  'F-18': '#ec4899' // pink
};
export const SentimentOverTimeChart = ({
  activeCompetitors,
  data
}: SentimentOverTimeChartProps) => {
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
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Sentiment Over Time
        </h3>
      </div>
      {data.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          No historical sentiment data available yet
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => format(new Date(value), "MMM d")}
              style={{ fontSize: "12px" }}
            />
            <YAxis
              domain={[-1, 1]}
              tickFormatter={formatYAxis}
              style={{ fontSize: "12px" }}
            />
            <Tooltip
              formatter={formatTooltip}
              labelFormatter={(label) => format(new Date(label), "PPP")}
            />
            <Legend />
            {fighters.map((fighter) => (
              <Line
                key={fighter}
                type="monotone"
                dataKey={fighter}
                stroke={COLORS[fighter as keyof typeof COLORS] || '#6b7280'}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                name={fighter}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
};