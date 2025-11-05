import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ExternalLink, TrendingUp, TrendingDown, Minus, ChevronDown } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { formatDistanceToNow } from "date-fns";
interface SentimentData {
  sentiment_score: number;
  mentions: number;
  tonality?: string;
}
interface Article {
  title_en: string;
  url: string;
  published_at: string;
  source_country: string;
  fighter_tags: string[];
  sentiment: number;
}
interface SocialPost {
  platform: string;
  content: string;
  author_name: string;
  published_at: string;
  sentiment: number;
  post_url: string;
}
interface SentimentDashboardProps {
  mediaSentiment?: {
    [fighter: string]: SentimentData;
  };
  articles: Article[];
  activeCountry: string;
  socialPosts?: SocialPost[];
  socialSentiment?: {
    [fighter: string]: SentimentData;
  };
}
export const SentimentDashboard = ({
  mediaSentiment,
  articles,
  activeCountry,
  socialPosts = [],
  socialSentiment
}: SentimentDashboardProps) => {
  const [sentimentOpen, setSentimentOpen] = useState(false);
  const [socialOpen, setSocialOpen] = useState(false);
  const [articlesOpen, setArticlesOpen] = useState(false);

  // Prepare data for media sentiment chart
  const mediaChartData = mediaSentiment ? Object.entries(mediaSentiment).map(([fighter, data]) => ({
    name: fighter,
    value: Math.abs(data.sentiment_score * 100),
    sentiment: data.sentiment_score,
    mentions: data.mentions,
    fill: data.sentiment_score > 0.2 ? '#10b981' : data.sentiment_score < -0.2 ? '#ef4444' : '#6b7280'
  })) : [];
  const getSentimentIcon = (sentiment: number) => {
    if (sentiment > 0.2) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (sentiment < -0.2) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-gray-500" />;
  };
  const getSentimentBadge = (sentiment: number) => {
    if (sentiment > 0.2) return <Badge className="bg-green-500">Positive</Badge>;
    if (sentiment < -0.2) return <Badge variant="destructive">Negative</Badge>;
    return <Badge variant="secondary">Neutral</Badge>;
  };
  return <div className="space-y-4">
      {/* Sentiment Breakdown - Collapsible */}
      {mediaSentiment && (
        <Collapsible open={sentimentOpen} onOpenChange={setSentimentOpen}>
          <Card className="p-4">
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <h3 className="text-base font-semibold">Sentiment Breakdown</h3>
              <ChevronDown className={`h-4 w-4 transition-transform ${sentimentOpen ? 'rotate-180' : ''}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(mediaSentiment).map(([fighter, data]) => (
                  <div key={fighter} className="p-4 border rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{fighter}</span>
                      {getSentimentIcon(data.sentiment_score)}
                    </div>
                    <div className="flex items-center gap-2">
                      {getSentimentBadge(data.sentiment_score)}
                      <span className="text-sm text-muted-foreground">
                        {data.mentions} mentions
                      </span>
                    </div>
                    {data.tonality && <p className="text-xs text-muted-foreground mt-2">{data.tonality}</p>}
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Latest Social Media Posts - Collapsible */}
      {socialPosts && socialPosts.length > 0 && (
        <Collapsible open={socialOpen} onOpenChange={setSocialOpen}>
          <Card className="p-4">
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <h3 className="text-base font-semibold">Latest Social Media Posts</h3>
              <ChevronDown className={`h-4 w-4 transition-transform ${socialOpen ? 'rotate-180' : ''}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              <div className="space-y-3">
                {socialPosts.slice(0, 10).map((post, idx) => (
                  <a
                    key={idx}
                    href={post.post_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-3 p-3 border rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs capitalize">
                          {post.platform}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {post.author_name}
                        </span>
                        {getSentimentBadge(post.sentiment)}
                      </div>
                      <p className="text-sm mb-2 line-clamp-2">{post.content}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(post.published_at), { addSuffix: true })}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Latest Articles List - Collapsible */}
      <Collapsible open={articlesOpen} onOpenChange={setArticlesOpen}>
        <Card className="p-4">
          <CollapsibleTrigger className="flex items-center justify-between w-full">
            <h3 className="text-base font-semibold">Latest Relevant Articles</h3>
            <ChevronDown className={`h-4 w-4 transition-transform ${articlesOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            {articles.length > 0 ? (
              <div className="space-y-3">
                {articles.map((article, idx) => (
                  <a
                    key={idx}
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-3 p-3 border rounded-lg hover:bg-accent transition-colors"
                  >
                    <ExternalLink className="h-5 w-5 mt-0.5 flex-shrink-0 text-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm mb-2">{article.title_en}</p>
                      <div className="flex gap-2 flex-wrap items-center">
                        {article.source_country && (
                          <Badge
                            variant={article.source_country === activeCountry ? "default" : "outline"}
                            className="text-xs"
                          >
                            {article.source_country === activeCountry ? "Local" : article.source_country}
                          </Badge>
                        )}
                        {article.fighter_tags?.map((tag: string) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {article.sentiment !== null && (
                          <div className="flex items-center gap-1">
                            {getSentimentIcon(article.sentiment)}
                            <span className="text-xs text-muted-foreground">
                              {(article.sentiment * 100).toFixed(0)}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No articles collected yet. Start the agent to begin collecting data.
              </div>
            )}
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>;
};