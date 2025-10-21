import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Article {
  published_at: string;
  sentiment: number;
  fighter_tags: string[];
}

interface SentimentDataPoint {
  date: string;
  [key: string]: number | string;
}

interface PublicationDataPoint {
  date: string;
  [key: string]: number | string;
}

interface SentimentCounts {
  positive: number;
  neutral: number;
  negative: number;
}

export const useSentimentData = (activeCountry: string, activeCompetitors: string[]) => {
  const [sentimentOverTime, setSentimentOverTime] = useState<SentimentDataPoint[]>([]);
  const [publicationTimeline, setPublicationTimeline] = useState<PublicationDataPoint[]>([]);
  const [sentimentDistribution, setSentimentDistribution] = useState<Record<string, SentimentCounts>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSentimentData();
  }, [activeCountry, activeCompetitors]);

  const fetchSentimentData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch articles from the last 6 months
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const { data: articles, error } = await supabase
        .from('items')
        .select('published_at, sentiment, fighter_tags')
        .eq('user_id', user.id)
        .eq('tracking_country', activeCountry)
        .gte('published_at', sixMonthsAgo.toISOString())
        .order('published_at', { ascending: true });

      if (error) throw error;

      if (!articles || articles.length === 0) {
        setSentimentOverTime([]);
        setPublicationTimeline([]);
        setSentimentDistribution({});
        return;
      }

      const fighters = ['Gripen', ...activeCompetitors];

      // Process sentiment over time (weekly aggregation)
      const sentimentByWeek = new Map<string, Record<string, number[]>>();
      const publicationByWeek = new Map<string, Record<string, number>>();
      const sentimentCounts: Record<string, SentimentCounts> = {};

      // Initialize sentiment counts
      fighters.forEach(fighter => {
        sentimentCounts[fighter] = { positive: 0, neutral: 0, negative: 0 };
      });

      articles.forEach((article: Article) => {
        const date = new Date(article.published_at);
        // Get Monday of the week
        const monday = new Date(date);
        monday.setDate(date.getDate() - date.getDay() + 1);
        const weekKey = monday.toISOString().split('T')[0];

        if (!sentimentByWeek.has(weekKey)) {
          sentimentByWeek.set(weekKey, {});
          publicationByWeek.set(weekKey, {});
        }

        const weekSentiment = sentimentByWeek.get(weekKey)!;
        const weekPublication = publicationByWeek.get(weekKey)!;

        article.fighter_tags?.forEach((tag: string) => {
          const fighter = fighters.find(f => tag.toLowerCase().includes(f.toLowerCase()));
          if (fighter) {
            // Sentiment over time
            if (!weekSentiment[fighter]) {
              weekSentiment[fighter] = [];
            }
            weekSentiment[fighter].push(article.sentiment || 0);

            // Publication timeline
            weekPublication[fighter] = (weekPublication[fighter] || 0) + 1;

            // Sentiment distribution
            const sentiment = article.sentiment || 0;
            if (sentiment > 0.2) {
              sentimentCounts[fighter].positive++;
            } else if (sentiment < -0.2) {
              sentimentCounts[fighter].negative++;
            } else {
              sentimentCounts[fighter].neutral++;
            }
          }
        });
      });

      // Convert to array format for charts
      const sentimentTimelineData: SentimentDataPoint[] = [];
      const publicationTimelineData: PublicationDataPoint[] = [];

      const sortedWeeks = Array.from(sentimentByWeek.keys()).sort();

      sortedWeeks.forEach(weekKey => {
        const weekSentiment = sentimentByWeek.get(weekKey)!;
        const weekPublication = publicationByWeek.get(weekKey)!;

        const sentimentPoint: SentimentDataPoint = { date: weekKey };
        const publicationPoint: PublicationDataPoint = { date: weekKey };

        fighters.forEach(fighter => {
          // Average sentiment for the week
          const sentiments = weekSentiment[fighter] || [];
          sentimentPoint[fighter] = sentiments.length > 0
            ? sentiments.reduce((a, b) => a + b, 0) / sentiments.length
            : 0;

          // Publication count for the week
          publicationPoint[fighter] = weekPublication[fighter] || 0;
        });

        sentimentTimelineData.push(sentimentPoint);
        publicationTimelineData.push(publicationPoint);
      });

      setSentimentOverTime(sentimentTimelineData);
      setPublicationTimeline(publicationTimelineData);
      setSentimentDistribution(sentimentCounts);
    } catch (error) {
      console.error('Error fetching sentiment data:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    sentimentOverTime,
    publicationTimeline,
    sentimentDistribution,
    loading,
    refresh: fetchSentimentData,
  };
};
