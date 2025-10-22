import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface UseRealtimeArticlesProps {
  activeCountry: string;
  activeCompetitors: string[];
  autoRefreshEnabled?: boolean;
}

export const useRealtimeArticles = ({ 
  activeCountry, 
  activeCompetitors,
  autoRefreshEnabled = true 
}: UseRealtimeArticlesProps) => {
  const [newArticlesCount, setNewArticlesCount] = useState(0);
  const [lastCheckTime, setLastCheckTime] = useState<Date>(new Date());

  useEffect(() => {
    if (!autoRefreshEnabled) return;

    // Set up realtime subscription for new articles
    const channel = supabase
      .channel('articles-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'items',
          filter: `tracking_country=eq.${activeCountry}`
        },
        (payload) => {
          console.log('New article detected:', payload);
          
          // Check if article matches active competitors
          const article = payload.new as any;
          const matchesCompetitors = activeCompetitors.some(comp => 
            article.fighter_tags?.includes(comp)
          );

          if (matchesCompetitors) {
            setNewArticlesCount(prev => prev + 1);
            toast({
              title: "New Article Discovered",
              description: article.title_en || article.title_pt || "New article available",
            });
          }
        }
      )
      .subscribe();

    // Polling fallback every 5 minutes
    const pollingInterval = setInterval(() => {
      setLastCheckTime(new Date());
    }, 5 * 60 * 1000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollingInterval);
    };
  }, [activeCountry, activeCompetitors, autoRefreshEnabled]);

  const resetNewCount = () => setNewArticlesCount(0);

  return {
    newArticlesCount,
    lastCheckTime,
    resetNewCount
  };
};