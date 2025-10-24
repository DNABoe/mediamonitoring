import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { PieChart, Circle } from "lucide-react";
interface SentimentCounts {
  positive: number;
  neutral: number;
  negative: number;
}
interface SentimentDistributionData {
  fighter: string;
  positive: number;
  neutral: number;
  negative: number;
  total: number;
}
interface SentimentDistributionChartProps {
  activeCompetitors: string[];
  sentimentData: Record<string, SentimentCounts>;
}
const FIGHTER_COLORS = {
  'Gripen': 'hsl(217, 91%, 60%)',
  // Primary blue
  'F-35': 'hsl(0, 84%, 60%)',
  // Red
  'F-16': 'hsl(142, 71%, 45%)',
  // Green
  'Eurofighter': 'hsl(38, 92%, 50%)',
  // Amber
  'Rafale': 'hsl(258, 90%, 66%)',
  // Purple
  'F-18': 'hsl(330, 81%, 60%)' // Pink
};
export const SentimentDistributionChart = ({
  activeCompetitors,
  sentimentData
}: SentimentDistributionChartProps) => {
  const fighters = ['Gripen', ...activeCompetitors];
  const chartData: SentimentDistributionData[] = fighters.map(fighter => {
    const data = sentimentData[fighter] || {
      positive: 0,
      neutral: 0,
      negative: 0
    };
    const total = data.positive + data.neutral + data.negative;
    return {
      fighter,
      positive: total > 0 ? data.positive / total * 100 : 0,
      neutral: total > 0 ? data.neutral / total * 100 : 0,
      negative: total > 0 ? data.negative / total * 100 : 0,
      total
    };
  });
  const formatTooltip = (value: any, name: string) => {
    return [`${value.toFixed(1)}%`, name.charAt(0).toUpperCase() + name.slice(1)];
  };
  return <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <PieChart className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-2xl font-bold">Sentiment Distribution</h2>
            <p className="text-sm text-muted-foreground">
              Breakdown of positive, neutral, and negative coverage
            </p>
          </div>
        </div>

        {chartData.every(d => d.total === 0) ? <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            No sentiment data available yet. Start collecting articles to see distribution.
          </div> : <>

            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData} margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 5
          }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="fighter" className="text-xs" tick={props => {
              const {
                x,
                y,
                payload
              } = props;
              const fighterColor = FIGHTER_COLORS[payload.value as keyof typeof FIGHTER_COLORS] || 'hsl(var(--muted))';
              return <g transform={`translate(${x},${y})`}>
                        <circle cx={0} cy={-5} r={4} fill={fighterColor} />
                        <text x={0} y={10} textAnchor="middle" fill="hsl(var(--foreground))" fontSize={12}>
                          {payload.value}
                        </text>
                      </g>;
            }} />
                <YAxis tickFormatter={value => `${value}%`} domain={[0, 100]} className="text-xs" />
                <Tooltip formatter={formatTooltip} contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px'
            }} />
                <Legend />
                <Bar dataKey="positive" stackId="a" fill="hsl(142, 71%, 45%)" name="Positive" radius={[0, 0, 0, 0]} />
                <Bar dataKey="neutral" stackId="a" fill="hsl(215, 16%, 55%)" name="Neutral" radius={[0, 0, 0, 0]} />
                <Bar dataKey="negative" stackId="a" fill="hsl(0, 84%, 60%)" name="Negative" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            {/* Summary Stats */}
            <div 
              className="grid gap-4 mt-4" 
              style={{ gridTemplateColumns: `repeat(${chartData.length}, minmax(0, 1fr))` }}
            >
              {chartData.map(item => <div key={item.fighter} className="p-3 border rounded-lg">
                  <p className="font-semibold text-sm mb-2">{item.fighter}</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-green-600">Positive:</span>
                      <span className="font-medium">{item.positive.toFixed(0)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Neutral:</span>
                      <span className="font-medium">{item.neutral.toFixed(0)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-red-600">Negative:</span>
                      <span className="font-medium">{item.negative.toFixed(0)}%</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t">
                      <span>Total articles:</span>
                      <span className="font-medium">{item.total}</span>
                    </div>
                  </div>
                </div>)}
            </div>
          </>}
      </div>
    </Card>;
};