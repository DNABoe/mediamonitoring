import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, MessageCircle, Flame, Activity } from 'lucide-react';

interface SocialTrendsSummaryProps {
  activeCountry: string;
  activeCompetitors: string[];
}

export const SocialTrendsSummary = ({ activeCountry, activeCompetitors }: SocialTrendsSummaryProps) => {
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [activeCountry, activeCompetitors]);

  const loadStats = async () => {
    setIsLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const allCompetitors = ['Gripen', ...activeCompetitors];

      // Get all posts
      const { data: allPosts, error } = await supabase
        .from('social_media_posts')
        .select('*')
        .eq('user_id', user.id)
        .eq('tracking_country', activeCountry);

      if (error) throw error;

      const posts = allPosts?.filter(post => 
        allCompetitors.some(comp => post.fighter_tags?.includes(comp))
      ) || [];

      // Last 24 hours
      const last24h = new Date();
      last24h.setHours(last24h.getHours() - 24);
      const recentPosts = posts.filter(p => new Date(p.published_at) > last24h);

      // Last 7 days
      const last7d = new Date();
      last7d.setDate(last7d.getDate() - 7);
      const weekPosts = posts.filter(p => new Date(p.published_at) > last7d);

      // Fighter breakdown
      const fighterStats = allCompetitors.map(fighter => {
        const fighterPosts = posts.filter(p => p.fighter_tags?.includes(fighter));
        const fighterRecent = recentPosts.filter(p => p.fighter_tags?.includes(fighter));
        const avgSentiment = fighterPosts.length > 0
          ? fighterPosts.reduce((sum, p) => sum + (p.sentiment || 0), 0) / fighterPosts.length
          : 0;

        return {
          fighter,
          totalPosts: fighterPosts.length,
          recentPosts: fighterRecent.length,
          avgSentiment: avgSentiment * 100,
          trend: fighterRecent.length > 0 ? 'up' : 'stable'
        };
      }).sort((a, b) => b.totalPosts - a.totalPosts);

      // Platform breakdown
      const platformCounts = posts.reduce((acc, post) => {
        acc[post.platform] = (acc[post.platform] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Top trending (most active last 24h)
      const trendingFighter = fighterStats.reduce((prev, curr) => 
        curr.recentPosts > prev.recentPosts ? curr : prev
      , fighterStats[0]);

      // Sentiment analysis
      const positivePosts = posts.filter(p => (p.sentiment || 0) > 0.2).length;
      const negativePosts = posts.filter(p => (p.sentiment || 0) < -0.2).length;
      const neutralPosts = posts.length - positivePosts - negativePosts;

      setStats({
        totalPosts: posts.length,
        recentPosts: recentPosts.length,
        weekPosts: weekPosts.length,
        fighterStats,
        platformCounts,
        trendingFighter,
        sentimentBreakdown: {
          positive: positivePosts,
          negative: negativePosts,
          neutral: neutralPosts
        }
      });
    } catch (error) {
      console.error('Error loading social stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="p-6 animate-pulse">
            <div className="h-20 bg-muted rounded"></div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Posts</p>
              <p className="text-3xl font-bold">{stats.totalPosts}</p>
              <p className="text-xs text-muted-foreground mt-1">All time</p>
            </div>
            <MessageCircle className="h-8 w-8 text-primary opacity-50" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Last 24 Hours</p>
              <p className="text-3xl font-bold">{stats.recentPosts}</p>
              <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Active
              </p>
            </div>
            <Activity className="h-8 w-8 text-green-500 opacity-50" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Last 7 Days</p>
              <p className="text-3xl font-bold">{stats.weekPosts}</p>
              <p className="text-xs text-muted-foreground mt-1">Weekly total</p>
            </div>
            <TrendingUp className="h-8 w-8 text-blue-500 opacity-50" />
          </div>
        </Card>

        <Card className="p-6 border-2 border-orange-500/20 bg-orange-500/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">🔥 Trending</p>
              <p className="text-2xl font-bold">{stats.trendingFighter.fighter}</p>
              <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                <Flame className="h-3 w-3" />
                {stats.trendingFighter.recentPosts} posts today
              </p>
            </div>
            <Flame className="h-8 w-8 text-orange-500" />
          </div>
        </Card>
      </div>

      {/* Fighter Breakdown */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Fighter Discussion Volume</h3>
        <div className="space-y-4">
          {stats.fighterStats.map((fighter: any) => (
            <div key={fighter.fighter} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{fighter.fighter}</span>
                  <Badge 
                    variant={fighter.avgSentiment > 20 ? 'default' : fighter.avgSentiment < -20 ? 'destructive' : 'secondary'}
                    className="text-xs"
                  >
                    {fighter.avgSentiment > 0 ? '😊' : fighter.avgSentiment < 0 ? '😟' : '😐'}
                    {fighter.avgSentiment.toFixed(0)}%
                  </Badge>
                  {fighter.recentPosts > 0 && (
                    <Badge variant="outline" className="text-xs">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      {fighter.recentPosts} recent
                    </Badge>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">{fighter.totalPosts} posts</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-primary rounded-full h-2 transition-all"
                  style={{ width: `${(fighter.totalPosts / stats.totalPosts) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Platform & Sentiment Split */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Platform Distribution</h3>
          <div className="space-y-3">
            {Object.entries(stats.platformCounts).map(([platform, count]: [string, any]) => (
              <div key={platform} className="flex items-center justify-between">
                <span className="capitalize text-sm">{platform === 'x' ? 'X (Twitter)' : platform}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-muted rounded-full h-2">
                    <div 
                      className="bg-blue-500 rounded-full h-2"
                      style={{ width: `${(count / stats.totalPosts) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-8 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Sentiment Overview</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-sm">Positive</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-24 bg-muted rounded-full h-2">
                  <div 
                    className="bg-green-500 rounded-full h-2"
                    style={{ width: `${(stats.sentimentBreakdown.positive / stats.totalPosts) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium w-8 text-right">{stats.sentimentBreakdown.positive}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-500" />
                <span className="text-sm">Neutral</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-24 bg-muted rounded-full h-2">
                  <div 
                    className="bg-gray-500 rounded-full h-2"
                    style={{ width: `${(stats.sentimentBreakdown.neutral / stats.totalPosts) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium w-8 text-right">{stats.sentimentBreakdown.neutral}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-sm">Negative</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-24 bg-muted rounded-full h-2">
                  <div 
                    className="bg-red-500 rounded-full h-2"
                    style={{ width: `${(stats.sentimentBreakdown.negative / stats.totalPosts) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium w-8 text-right">{stats.sentimentBreakdown.negative}</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};