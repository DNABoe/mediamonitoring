import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ExternalLink, Twitter, MessageCircle, ThumbsUp, Share2, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface SocialMediaFeedProps {
  activeCountry: string;
  activeCompetitors: string[];
}

export const SocialMediaFeed = ({ activeCountry, activeCompetitors }: SocialMediaFeedProps) => {
  const [posts, setPosts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCollecting, setIsCollecting] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['x', 'reddit', 'facebook', 'linkedin']);
  const [sentimentFilter, setSentimentFilter] = useState<'all' | 'positive' | 'neutral' | 'negative'>('all');

  useEffect(() => {
    fetchPosts();
  }, [activeCountry, activeCompetitors]);

  const fetchPosts = async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('social_media_posts')
      .select('*')
      .eq('user_id', user.id)
      .eq('tracking_country', activeCountry)
      .order('published_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      // Filter by active competitors + Gripen
      const allCompetitors = ['Gripen', ...activeCompetitors];
      const filtered = data.filter(post => 
        allCompetitors.some(comp => post.fighter_tags?.includes(comp))
      );
      setPosts(filtered);
    }
    setIsLoading(false);
  };

  const collectSocialMedia = async () => {
    setIsCollecting(true);
    toast.info('Collecting social media posts...', {
      description: 'This may take a minute. You will be notified when complete.'
    });

    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 6); // Last 6 months

      const { data, error } = await supabase.functions.invoke('collect-social-media', {
        body: {
          country: activeCountry,
          competitors: ['Gripen', ...activeCompetitors],
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        }
      });

      if (error) throw error;

      toast.success('Social media collection complete!', {
        description: `Collected ${data.postsCollected} posts`
      });

      // Refresh the posts
      await fetchPosts();
    } catch (error) {
      console.error('Error collecting social media:', error);
      toast.error('Failed to collect social media posts', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsCollecting(false);
    }
  };

  const filteredPosts = posts.filter(post => {
    // Platform filter
    if (!selectedPlatforms.includes(post.platform)) return false;

    // Sentiment filter
    if (sentimentFilter !== 'all') {
      const sentiment = post.sentiment || 0;
      if (sentimentFilter === 'positive' && sentiment <= 0) return false;
      if (sentimentFilter === 'negative' && sentiment >= 0) return false;
      if (sentimentFilter === 'neutral' && Math.abs(sentiment) > 0.1) return false;
    }

    return true;
  });

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'x':
      case 'twitter':
        return <Twitter className="h-4 w-4" />;
      case 'reddit':
        return <MessageCircle className="h-4 w-4" />;
      case 'facebook':
        return <Share2 className="h-4 w-4" />;
      case 'linkedin':
        return <Share2 className="h-4 w-4" />;
      default:
        return <MessageCircle className="h-4 w-4" />;
    }
  };

  const getPlatformColor = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'x':
      case 'twitter':
        return 'bg-gray-900 text-white';
      case 'reddit':
        return 'bg-orange-100 text-orange-800';
      case 'facebook':
        return 'bg-blue-600 text-white';
      case 'linkedin':
        return 'bg-blue-700 text-white';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getSentimentColor = (sentiment: number) => {
    if (sentiment > 0.3) return 'text-green-600';
    if (sentiment < -0.3) return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <div className="space-y-4">
      {/* Collection Button */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold">Social Media Collection</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Collect recent social media posts about {activeCountry} fighter procurement
            </p>
          </div>
          <Button 
            onClick={collectSocialMedia} 
            disabled={isCollecting}
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isCollecting ? 'animate-spin' : ''}`} />
            {isCollecting ? 'Collecting...' : 'Collect Posts'}
          </Button>
        </div>
      </Card>

      {/* Filters */}
      <Card className="p-4">
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold mb-2">Platforms</h4>
            <div className="flex flex-wrap gap-4">
              {['x', 'reddit', 'facebook', 'linkedin'].map(platform => (
                <div key={platform} className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedPlatforms.includes(platform)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedPlatforms([...selectedPlatforms, platform]);
                      } else {
                        setSelectedPlatforms(selectedPlatforms.filter(p => p !== platform));
                      }
                    }}
                  />
                  <label className="text-sm capitalize">{platform === 'x' ? 'X (Twitter)' : platform}</label>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-2">Sentiment</h4>
            <div className="flex gap-2">
              {(['all', 'positive', 'neutral', 'negative'] as const).map(filter => (
                <Button
                  key={filter}
                  size="sm"
                  variant={sentimentFilter === filter ? 'default' : 'outline'}
                  onClick={() => setSentimentFilter(filter)}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Posts Count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredPosts.length} of {posts.length} social media posts
      </div>

      {/* Posts Grid */}
      <div className="grid gap-4">
        {filteredPosts.map(post => (
          <Card key={post.id} className="p-4 hover:shadow-md transition-shadow">
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                <Badge className={getPlatformColor(post.platform)}>
                  {getPlatformIcon(post.platform)}
                  <span className="ml-1 capitalize">{post.platform === 'x' ? 'X' : post.platform}</span>
                </Badge>
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(post.published_at), 'PPp')}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(post.post_url, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>

              {/* Author */}
              {post.author_username && (
                <div className="text-sm font-medium">
                  @{post.author_username}
                </div>
              )}

              {/* Content */}
              <p className="text-sm">{post.content}</p>

              {/* Footer */}
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex gap-3">
                  {post.fighter_tags?.map((tag: string) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <div className={`text-sm font-semibold ${getSentimentColor(post.sentiment || 0)}`}>
                  {post.sentiment > 0 ? '😊' : post.sentiment < 0 ? '😟' : '😐'}
                  {' '}
                  {((post.sentiment || 0) * 100).toFixed(0)}%
                </div>
              </div>

              {/* Engagement Metrics */}
              {post.engagement_metrics && Object.keys(post.engagement_metrics).length > 0 && (
                <div className="flex gap-4 text-xs text-muted-foreground">
                  {post.engagement_metrics.likes && (
                    <span className="flex items-center gap-1">
                      <ThumbsUp className="h-3 w-3" />
                      {post.engagement_metrics.likes}
                    </span>
                  )}
                  {post.engagement_metrics.comments && (
                    <span className="flex items-center gap-1">
                      <MessageCircle className="h-3 w-3" />
                      {post.engagement_metrics.comments}
                    </span>
                  )}
                  {post.engagement_metrics.shares && (
                    <span className="flex items-center gap-1">
                      <Share2 className="h-3 w-3" />
                      {post.engagement_metrics.shares}
                    </span>
                  )}
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {filteredPosts.length === 0 && !isLoading && (
        <div className="text-center py-12 text-muted-foreground">
          <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No social media posts found</p>
        </div>
      )}
    </div>
  );
};