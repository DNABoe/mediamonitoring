import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Calendar } from "lucide-react";
import { format } from "date-fns";

interface PublicationData {
  date: string;
  [key: string]: number | string; // Dynamic keys for each fighter
}

interface PublicationTimelineChartProps {
  activeCompetitors: string[];
  data: PublicationData[];
}

const COLORS = {
  'Gripen': '#3b82f6',
  'F-35': '#ef4444',
  'F-16': '#10b981',
  'Eurofighter': '#f59e0b',
  'Rafale': '#8b5cf6',
  'F-18': '#ec4899',
};

export const PublicationTimelineChart = ({ 
  activeCompetitors, 
  data 
}: PublicationTimelineChartProps) => {
  const fighters = ['Gripen', ...activeCompetitors];

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Calendar className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-2xl font-bold">Publication Timeline</h2>
            <p className="text-sm text-muted-foreground">
              Article publication density over time
            </p>
          </div>
        </div>

        {data.length === 0 ? (
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            No publication data available yet. Start collecting articles to see timeline.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => format(new Date(value), 'MMM d')}
                stroke="hsl(var(--foreground))"
                tick={{ fill: 'hsl(var(--foreground))' }}
                className="text-xs"
              />
              <YAxis
                label={{ value: 'Articles', angle: -90, position: 'insideLeft', fill: 'hsl(var(--foreground))' }}
                stroke="hsl(var(--foreground))"
                tick={{ fill: 'hsl(var(--foreground))' }}
                className="text-xs"
              />
              <Tooltip
                labelFormatter={(label) => format(new Date(label), 'MMM d, yyyy')}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                }}
              />
              <Legend />
              {fighters.map((fighter) => (
                <Bar
                  key={fighter}
                  dataKey={fighter}
                  fill={COLORS[fighter as keyof typeof COLORS] || '#64748b'}
                  name={fighter}
                  stackId="a"
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
};
