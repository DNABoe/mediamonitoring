import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, subDays, eachDayOfInterval } from 'date-fns';

interface SocialSentimentTimelineProps {
  activeCountry: string;
  activeCompetitors: string[];
}

export const SocialSentimentTimeline = ({ activeCountry, activeCompetitors }: SocialSentimentTimelineProps) => {
  const [timelineData, setTimelineData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTimelineData();
  }, [activeCountry, activeCompetitors]);

  const loadTimelineData = async () => {
    setIsLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const thirtyDaysAgo = subDays(new Date(), 30);

      const { data: posts, error } = await supabase
        .from('social_media_posts')
        .select('*')
        .eq('user_id', user.id)
        .eq('tracking_country', activeCountry)
        .gte('published_at', thirtyDaysAgo.toISOString())
        .order('published_at', { ascending: true });

      if (error) throw error;

      // Filter by active competitors
      const filteredPosts = posts?.filter(post => 
        activeCompetitors.some(comp => post.fighter_tags?.includes(comp))
      ) || [];

      // Create daily buckets
      const days = eachDayOfInterval({
        start: thirtyDaysAgo,
        end: new Date()
      });

      const timeline = days.map(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const dayPosts = filteredPosts.filter(post => 
          format(new Date(post.published_at), 'yyyy-MM-dd') === dayStr
        );

        const result: any = {
          date: format(day, 'MMM dd'),
          fullDate: dayStr,
          totalPosts: dayPosts.length,
        };

        // Calculate per-fighter sentiment
        activeCompetitors.forEach(fighter => {
          const fighterPosts = dayPosts.filter(p => p.fighter_tags?.includes(fighter));
          const avgSentiment = fighterPosts.length > 0
            ? fighterPosts.reduce((sum, p) => sum + (p.sentiment || 0), 0) / fighterPosts.length
            : null;
          
          result[`${fighter}_sentiment`] = avgSentiment !== null ? avgSentiment * 100 : null;
          result[`${fighter}_posts`] = fighterPosts.length;
        });

        return result;
      });

      setTimelineData(timeline);
    } catch (error) {
      console.error('Error loading timeline data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Social Media Sentiment Timeline (30 Days)</h3>
      
      {isLoading ? (
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          Loading timeline data...
        </div>
      ) : timelineData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          No timeline data available
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={timelineData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="date" 
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis 
              label={{ value: 'Sentiment (%)', angle: -90, position: 'insideLeft' }}
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px'
              }}
            />
            <Legend />
            {activeCompetitors.map((fighter, index) => (
              <Line
                key={fighter}
                type="monotone"
                dataKey={`${fighter}_sentiment`}
                stroke={colors[index % colors.length]}
                name={fighter}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
};
