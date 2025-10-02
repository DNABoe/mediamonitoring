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

      // Transform data for chart
      const dateMap = new Map();
      
      metrics?.forEach((metric: MetricData) => {
        const date = metric.metric_date;
        if (!dateMap.has(date)) {
          dateMap.set(date, { date });
        }
        const entry = dateMap.get(date);
        if (metric.fighter === 'Gripen') {
          entry.gripenSentiment = metric.sentiment_score;
          entry.gripenMentions = metric.mentions_count;
        } else {
          entry.f35Sentiment = metric.sentiment_score;
          entry.f35Mentions = metric.mentions_count;
        }
      });

      const chartData = Array.from(dateMap.values());
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
      <h2 className="text-2xl font-bold mb-6">Media Sentiment Trends</h2>
      
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="date" 
            tickFormatter={(value) => format(new Date(value), 'MMM d')}
          />
          <YAxis domain={[-1, 1]} />
          <Tooltip 
            labelFormatter={(value) => format(new Date(value), 'MMM d, yyyy')}
            formatter={(value: number) => value.toFixed(2)}
          />
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
        <h3 className="text-lg font-semibold mb-4">Media Mentions Over Time</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tickFormatter={(value) => format(new Date(value), 'MMM d')}
            />
            <YAxis />
            <Tooltip 
              labelFormatter={(value) => format(new Date(value), 'MMM d, yyyy')}
            />
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