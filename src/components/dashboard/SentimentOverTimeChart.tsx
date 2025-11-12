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
        <h3 className="text-lg font-semibold">Sentiment Over Time</h3>
        <TrendingUp className="h-5 w-5 text-muted-foreground" />
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="date" 
            tickFormatter={(value) => format(new Date(value), 'MMM dd')}
          />
          <YAxis tickFormatter={formatYAxis} domain={[-1, 1]} />
          <Tooltip 
            labelFormatter={(value) => format(new Date(value), 'MMM dd, yyyy')}
            formatter={formatTooltip}
          />
          <Legend />
          {fighters.map((fighter) => (
            <Line
              key={fighter}
              type="monotone"
              dataKey={fighter}
              stroke={COLORS[fighter as keyof typeof COLORS] || '#6366f1'}
              strokeWidth={2}
              dot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
};