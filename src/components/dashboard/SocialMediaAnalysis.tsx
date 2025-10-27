import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  TrendingUp, 
  MessageSquare, 
  AlertCircle, 
  Users, 
  Target,
  BarChart3,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface SocialMediaAnalysisProps {
  activeCountry: string;
  activeCompetitors: string[];
}

export const SocialMediaAnalysis = ({ activeCountry, activeCompetitors }: SocialMediaAnalysisProps) => {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState({
    totalPosts: 0,
    avgSentiment: 0,
    platformBreakdown: {} as Record<string, number>,
    fighterMentions: {} as Record<string, number>
  });

  useEffect(() => {
    loadAnalysis();
  }, [activeCountry, activeCompetitors]);

  const loadAnalysis = async () => {
    setIsLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch social media posts
      const { data: posts, error } = await supabase
        .from('social_media_posts')
        .select('*')
        .eq('user_id', user.id)
        .eq('tracking_country', activeCountry)
        .order('published_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      // Filter by active competitors + Gripen
      const allCompetitors = ['Gripen', ...activeCompetitors];
      const filteredPosts = posts?.filter(post => 
        allCompetitors.some(comp => post.fighter_tags?.includes(comp))
      ) || [];

      // Calculate statistics
      const platformBreakdown: Record<string, number> = {};
      const fighterMentions: Record<string, number> = {};
      let totalSentiment = 0;

      filteredPosts.forEach(post => {
        platformBreakdown[post.platform] = (platformBreakdown[post.platform] || 0) + 1;
        totalSentiment += post.sentiment || 0;
        
        post.fighter_tags?.forEach((tag: string) => {
          fighterMentions[tag] = (fighterMentions[tag] || 0) + 1;
        });
      });

      setStats({
        totalPosts: filteredPosts.length,
        avgSentiment: filteredPosts.length > 0 ? totalSentiment / filteredPosts.length : 0,
        platformBreakdown,
        fighterMentions
      });

      if (filteredPosts.length === 0) {
        setAnalysis(null);
        setIsLoading(false);
        return;
      }

      // Generate AI analysis
      const { data: analysisData, error: analysisError } = await supabase.functions.invoke('analyze-social-discussion', {
        body: {
          country: activeCountry,
          competitors: ['Gripen', ...activeCompetitors],
          posts: filteredPosts.slice(0, 100) // Send top 100 posts
        }
      });

      if (analysisError) throw analysisError;

      setAnalysis(analysisData.analysis);
    } catch (error) {
      console.error('Error loading social media analysis:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getSentimentLabel = (sentiment: number) => {
    if (sentiment > 0.2) return { label: 'Positive', color: 'bg-green-500' };
    if (sentiment < -0.2) return { label: 'Negative', color: 'bg-red-500' };
    return { label: 'Neutral', color: 'bg-gray-500' };
  };

  const sentimentInfo = getSentimentLabel(stats.avgSentiment);

  return (
    <div className="space-y-6">
      {/* Statistics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-8 w-8 text-primary" />
            <div>
              <div className="text-2xl font-bold">{stats.totalPosts}</div>
              <div className="text-sm text-muted-foreground">Total Posts</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-primary" />
            <div>
              <div className="text-2xl font-bold flex items-center gap-2">
                {(stats.avgSentiment * 100).toFixed(0)}%
                <Badge className={sentimentInfo.color}>{sentimentInfo.label}</Badge>
              </div>
              <div className="text-sm text-muted-foreground">Avg Sentiment</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <div className="text-2xl font-bold">{Object.keys(stats.platformBreakdown).length}</div>
              <div className="text-sm text-muted-foreground">Platforms</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Target className="h-8 w-8 text-primary" />
            <div>
              <div className="text-2xl font-bold">{Object.keys(stats.fighterMentions).length}</div>
              <div className="text-sm text-muted-foreground">Fighters Mentioned</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Platform Breakdown */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Platform Distribution
        </h3>
        <div className="space-y-3">
          {Object.entries(stats.platformBreakdown).map(([platform, count]) => (
            <div key={platform} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="capitalize">{platform}</Badge>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-48 bg-secondary rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${(count / stats.totalPosts) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium w-12 text-right">{count}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Fighter Mentions */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Target className="h-5 w-5" />
          Fighter Mentions in Social Discussion
        </h3>
        <div className="space-y-3">
          {Object.entries(stats.fighterMentions)
            .sort((a, b) => b[1] - a[1])
            .map(([fighter, count]) => (
              <div key={fighter} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge>{fighter}</Badge>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-48 bg-secondary rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${(count / stats.totalPosts) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-12 text-right">{count}</span>
                </div>
              </div>
            ))}
        </div>
      </Card>

      {/* AI Analysis */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI-Powered Social Discussion Analysis
          </h3>
          <Button 
            onClick={loadAnalysis} 
            disabled={isLoading}
            size="sm"
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Analysis
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : analysis ? (
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown>{analysis}</ReactMarkdown>
          </div>
        ) : stats.totalPosts === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No social media posts available for analysis</p>
            <p className="text-sm mt-2">Collect social media data first to generate insights</p>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Click "Refresh Analysis" to generate AI insights</p>
          </div>
        )}
      </Card>
    </div>
  );
};
