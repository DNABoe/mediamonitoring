import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Twitter, MessageCircle, Share2 } from 'lucide-react';

interface SocialPlatformComparisonProps {
  activeCountry: string;
  activeCompetitors: string[];
}

export const SocialPlatformComparison = ({ activeCountry, activeCompetitors }: SocialPlatformComparisonProps) => {
  const [platformData, setPlatformData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPlatformData();
  }, [activeCountry, activeCompetitors]);

  const loadPlatformData = async () => {
    setIsLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: posts, error } = await supabase
        .from('social_media_posts')
        .select('*')
        .eq('user_id', user.id)
        .eq('tracking_country', activeCountry);

      if (error) throw error;

      // Filter by active competitors + Gripen (case-insensitive)
      const allCompetitors = ['Gripen', ...activeCompetitors];
      const filteredPosts = posts?.filter(post => 
        allCompetitors.some(comp => 
          post.fighter_tags?.some((tag: string) => 
            tag.toLowerCase().includes(comp.toLowerCase()) || 
            comp.toLowerCase().includes(tag.toLowerCase())
          )
        )
      ) || [];

      // Group by platform
      const platforms = ['x', 'twitter', 'reddit', 'facebook', 'linkedin'];
      const comparison = platforms.map(platform => {
        const platformPosts = filteredPosts.filter(p => p.platform === platform);
        
        const avgSentiment = platformPosts.length > 0
          ? platformPosts.reduce((sum, p) => sum + (p.sentiment || 0), 0) / platformPosts.length
          : 0;

        const positivePosts = platformPosts.filter(p => (p.sentiment || 0) > 0.2).length;
        const negativePosts = platformPosts.filter(p => (p.sentiment || 0) < -0.2).length;
        const neutralPosts = platformPosts.length - positivePosts - negativePosts;

        return {
          platform: platform.charAt(0).toUpperCase() + platform.slice(1),
          totalPosts: platformPosts.length,
          avgSentiment: avgSentiment * 100,
          positive: positivePosts,
          neutral: neutralPosts,
          negative: negativePosts
        };
      }).filter(p => p.totalPosts > 0);

      setPlatformData(comparison);
    } catch (error) {
      console.error('Error loading platform comparison:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'twitter':
        return <Twitter className="h-4 w-4" />;
      case 'reddit':
        return <MessageCircle className="h-4 w-4" />;
      case 'linkedin':
        return <Share2 className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Platform Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {platformData.map(platform => (
          <Card key={platform.platform} className="p-4">
            <div className="flex items-center gap-2 mb-3">
              {getPlatformIcon(platform.platform)}
              <h4 className="font-semibold">{platform.platform}</h4>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Posts:</span>
                <span className="font-medium">{platform.totalPosts}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Avg Sentiment:</span>
                <Badge variant={platform.avgSentiment > 20 ? 'default' : platform.avgSentiment < -20 ? 'destructive' : 'secondary'}>
                  {platform.avgSentiment.toFixed(0)}%
                </Badge>
              </div>
              <div className="flex gap-2 text-xs mt-3">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span>{platform.positive}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-gray-500" />
                  <span>{platform.neutral}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span>{platform.negative}</span>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Sentiment Comparison Chart */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Sentiment Distribution by Platform</h3>
        
        {isLoading ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            Loading platform data...
          </div>
        ) : platformData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            No platform data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={platformData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="platform" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
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
              <Bar dataKey="positive" fill="#10b981" name="Positive" />
              <Bar dataKey="neutral" fill="#6b7280" name="Neutral" />
              <Bar dataKey="negative" fill="#ef4444" name="Negative" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
};
