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

export const SentimentTimeline = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
  }, []);

  const fetchMetrics = async () => {
    try {
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
        .gte('metric_date', startDate)
        .order('metric_date', { ascending: true });

      if (error) throw error;

      // Transform data for chart - group by month
      const monthMap = new Map();
      
      metrics?.forEach((metric: MetricData) => {
        const date = new Date(metric.metric_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
        
        if (!monthMap.has(monthKey)) {
          monthMap.set(monthKey, { 
            date: monthKey,
            gripenMentions: 0,
            f35Mentions: 0,
            gripenSentimentSum: 0,
            f35SentimentSum: 0,
            gripenCount: 0,
            f35Count: 0
          });
        }
        
        const entry = monthMap.get(monthKey);
        if (metric.fighter === 'Gripen') {
          entry.gripenMentions += metric.mentions_count;
          entry.gripenSentimentSum += metric.sentiment_score;
          entry.gripenCount += 1;
        } else {
          entry.f35Mentions += metric.mentions_count;
          entry.f35SentimentSum += metric.sentiment_score;
          entry.f35Count += 1;
        }
      });

      // Calculate average sentiment for each month
      const chartData = Array.from(monthMap.values()).map(entry => ({
        date: entry.date,
        gripenMentions: entry.gripenMentions,
        f35Mentions: entry.f35Mentions,
        gripenSentiment: entry.gripenCount > 0 ? entry.gripenSentimentSum / entry.gripenCount : 0,
        f35Sentiment: entry.f35Count > 0 ? entry.f35SentimentSum / entry.f35Count : 0
      })).sort((a, b) => a.date.localeCompare(b.date));
      setData(chartData);
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

  if (data.length === 0) {
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
      <p className="text-sm text-muted-foreground mb-6">Portuguese media sources only</p>
      
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="date" 
            tickFormatter={(value) => format(new Date(value), 'MMM yyyy')}
          />
          <YAxis domain={[-1, 1]} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="gripenSentiment" 
            stroke="#10b981" 
            name="Gripen Sentiment"
            strokeWidth={2}
          />
          <Line 
            type="monotone" 
            dataKey="f35Sentiment" 
            stroke="#3b82f6" 
            name="F-35 Sentiment"
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-6 pt-6 border-t">
        <h3 className="text-lg font-semibold mb-1">Media Mentions Over Time</h3>
        <p className="text-sm text-muted-foreground mb-4">Portuguese media sources only</p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tickFormatter={(value) => format(new Date(value), 'MMM yyyy')}
            />
            <YAxis />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="gripenMentions" 
              stroke="#10b981" 
              name="Gripen Mentions"
              strokeWidth={2}
            />
            <Line 
              type="monotone" 
              dataKey="f35Mentions" 
              stroke="#3b82f6" 
              name="F-35 Mentions"
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};