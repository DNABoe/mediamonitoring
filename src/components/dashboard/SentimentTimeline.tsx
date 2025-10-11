import { Card } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

interface MetricData {
  metric_date: string;
  fighter: string;
  sentiment_score: number;
  mentions_count: number;
}

interface SentimentTimelineProps {
  activeCompetitors: string[];
}

export const SentimentTimeline = ({ activeCompetitors }: SentimentTimelineProps) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const FIGHTER_COLORS: Record<string, string> = {
    'Gripen': '#10b981',
    'F-35': '#3b82f6',
    'Rafale': '#f59e0b',
    'F-16V': '#8b5cf6',
    'Eurofighter': '#ef4444',
    'F/A-50': '#ec4899'
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-semibold mb-2">{format(new Date(label), 'MMMM yyyy')}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {typeof entry.value === 'number' && entry.value < 100 ? entry.value.toFixed(2) : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  useEffect(() => {
    fetchMetrics();

    const channel = supabase
      .channel('comparison-metrics')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'comparison_metrics'
      }, () => {
        fetchMetrics();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeCompetitors]);

  const fetchMetrics = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch baseline start date to determine tracking period
      const { data: baselineData } = await supabase
        .from('baselines')
        .select('start_date')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const startDate = baselineData?.start_date || new Date().toISOString().split('T')[0];

      const { data: metrics, error } = await supabase
        .from('comparison_metrics')
        .select('*')
        .eq('user_id', user.id)
        .gte('metric_date', startDate)
        .order('metric_date', { ascending: true });

      if (error) throw error;

      // Show Gripen and all active competitors
      const fightersToShow = ['Gripen', ...activeCompetitors];
      const filteredMetrics = metrics?.filter(m => fightersToShow.includes(m.fighter)) || [];

      // Transform data for chart - group by month
      const monthMap = new Map();
      const fighterFields: Record<string, any> = {};
      
      // Initialize fighter fields dynamically
      fightersToShow.forEach(fighter => {
        const key = fighter.toLowerCase().replace(/[^a-z0-9]/g, '');
        fighterFields[key] = {
          mentionsKey: `${key}Mentions`,
          sentimentKey: `${key}Sentiment`,
          sumKey: `${key}SentimentSum`,
          countKey: `${key}Count`
        };
      });

      // Create all months from start date to today
      const start = new Date(startDate);
      const today = new Date();
      const currentMonth = new Date(start.getFullYear(), start.getMonth(), 1);
      
      while (currentMonth <= today) {
        const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-01`;
        const monthEntry: any = { date: monthKey };
        Object.values(fighterFields).forEach((fields: any) => {
          monthEntry[fields.mentionsKey] = 0;
          monthEntry[fields.sumKey] = 0;
          monthEntry[fields.countKey] = 0;
        });
        monthMap.set(monthKey, monthEntry);
        currentMonth.setMonth(currentMonth.getMonth() + 1);
      }

      // Fill in actual data
      filteredMetrics.forEach((metric: MetricData) => {
        const date = new Date(metric.metric_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
        
        if (monthMap.has(monthKey)) {
          const entry = monthMap.get(monthKey);
          const fighterKey = metric.fighter.toLowerCase().replace(/[^a-z0-9]/g, '');
          const fields = fighterFields[fighterKey];
          
          if (fields) {
            entry[fields.mentionsKey] += metric.mentions_count;
            entry[fields.sumKey] += metric.sentiment_score;
            entry[fields.countKey] += 1;
          }
        }
      });

      // Calculate average sentiment for each month
      const chartData = Array.from(monthMap.values()).map(entry => {
        const result: any = { date: entry.date };
        Object.entries(fighterFields).forEach(([key, fields]: [string, any]) => {
          result[fields.mentionsKey] = entry[fields.mentionsKey] || 0;
          result[fields.sentimentKey] = entry[fields.countKey] > 0 
            ? entry[fields.sumKey] / entry[fields.countKey] 
            : 0;
        });
        return result;
      }).sort((a, b) => a.date.localeCompare(b.date));
      
      setData({ chartData, fightersToShow, fighterFields });
    } catch (error) {
      console.error('Error fetching metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Card>
    );
  }

  if (!data || data.chartData.length === 0) {
    return (
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4">Sentiment Timeline</h2>
        <div className="text-center text-muted-foreground py-12">
          No historical data available yet. Generate research to start tracking trends.
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold mb-1">Media Sentiment Trends</h2>
      <p className="text-sm text-muted-foreground mb-6">Tracking period sentiment analysis</p>
      
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data.chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="date" 
            tickFormatter={(value) => format(new Date(value), 'MMM yyyy')}
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
          />
          <YAxis 
            domain={[-1, 1]} 
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="line"
            formatter={(value) => <span className="text-foreground font-medium">{value}</span>}
          />
          {data.fightersToShow.map((fighter: string) => {
            const key = fighter.toLowerCase().replace(/[^a-z0-9]/g, '');
            const fields = data.fighterFields[key];
            return (
              <Line
                key={fighter}
                type="monotone"
                dataKey={fields.sentimentKey}
                stroke={FIGHTER_COLORS[fighter] || '#6b7280'}
                name={`${fighter} Sentiment`}
                strokeWidth={2}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-6 pt-6 border-t">
        <h3 className="text-lg font-semibold mb-1">Media Mentions Over Time</h3>
        <p className="text-sm text-muted-foreground mb-4">Article count trends</p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data.chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tickFormatter={(value) => format(new Date(value), 'MMM yyyy')}
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="line"
              formatter={(value) => <span className="text-foreground font-medium">{value}</span>}
            />
            {data.fightersToShow.map((fighter: string) => {
              const key = fighter.toLowerCase().replace(/[^a-z0-9]/g, '');
              const fields = data.fighterFields[key];
              return (
                <Line
                  key={fighter}
                  type="monotone"
                  dataKey={fields.mentionsKey}
                  stroke={FIGHTER_COLORS[fighter] || '#6b7280'}
                  name={`${fighter} Mentions`}
                  strokeWidth={2}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};