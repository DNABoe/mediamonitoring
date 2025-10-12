import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";

export const ArticleCollectionTrigger = () => {
  const [isCollecting, setIsCollecting] = useState(false);

  const handleCollectArticles = async () => {
    setIsCollecting(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("You must be logged in");
        return;
      }

      toast.info("Starting article collection...");

      // Get the latest baseline
      const { data: baseline, error: baselineError } = await supabase
        .from('baselines')
        .select('start_date, end_date')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (baselineError || !baseline) {
        toast.error("No baseline found. Please set a tracking date first.");
        return;
      }

      // Get user settings
      const { data: userSettings } = await supabase
        .from('user_settings')
        .select('active_country, active_competitors')
        .eq('user_id', user.id)
        .maybeSingle();

      const country = userSettings?.active_country || 'PT';
      const competitors = userSettings?.active_competitors || ['F-35'];

      console.log('Collecting articles with params:', {
        country,
        competitors,
        startDate: baseline.start_date,
        endDate: baseline.end_date
      });

      // Trigger article collection
      const { data, error } = await supabase.functions.invoke('collect-articles-for-tracking', {
        body: {
          country,
          competitors,
          startDate: baseline.start_date,
          endDate: baseline.end_date
        }
      });

      if (error) {
        console.error('Collection error:', error);
        toast.error(`Collection failed: ${error.message}`);
        return;
      }

      console.log('Collection result:', data);
      
      const articlesFound = data?.articlesFound || 0;
      const articlesStored = data?.articlesStored || 0;
      
      toast.success(
        `Collection complete! Found ${articlesFound} articles, stored ${articlesStored}`
      );
      
    } catch (error) {
      console.error('Error:', error);
      toast.error("An unexpected error occurred during collection");
    } finally {
      setIsCollecting(false);
    }
  };

  return (
    <Button
      onClick={handleCollectArticles}
      disabled={isCollecting}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      {isCollecting ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Collecting articles...
        </>
      ) : (
        <>
          <RefreshCw className="h-4 w-4" />
          Collect Articles
        </>
      )}
    </Button>
  );
};
