import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const ScraperControls = () => {
  const [isScraping, setIsScraping] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleScrape = async () => {
    setIsScraping(true);
    
    try {
      toast.info("Starting RSS feed scraping...");

      const { data, error } = await supabase.functions.invoke('scrape-sources');

      if (error) {
        console.error('Error scraping:', error);
        toast.error(error.message || "Failed to scrape sources");
        return;
      }

      console.log('Scraping completed:', data);
      
      toast.success(
        `Scraped ${data.totalItemsScraped} new articles from ${data.sourcesProcessed} sources!`
      );
      
    } catch (error) {
      console.error('Error:', error);
      toast.error("An unexpected error occurred");
    } finally {
      setIsScraping(false);
    }
  };

  const handleProcess = async () => {
    setIsProcessing(true);
    
    try {
      toast.info("Processing articles with AI...");

      const { data, error } = await supabase.functions.invoke('process-items');

      if (error) {
        console.error('Error processing:', error);
        toast.error(error.message || "Failed to process items");
        return;
      }

      console.log('Processing completed:', data);
      
      toast.success(
        `Processed ${data.processedCount} articles with AI analysis!`
      );
      
    } catch (error) {
      console.error('Error:', error);
      toast.error("An unexpected error occurred");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleScrape}
        disabled={isScraping}
        className="gap-2"
      >
        <RefreshCw className={`h-4 w-4 ${isScraping ? 'animate-spin' : ''}`} />
        {isScraping ? 'Scraping...' : 'Scrape Sources'}
      </Button>
      
      <Button
        variant="outline"
        size="sm"
        onClick={handleProcess}
        disabled={isProcessing}
        className="gap-2"
      >
        <Sparkles className={`h-4 w-4 ${isProcessing ? 'animate-pulse' : ''}`} />
        {isProcessing ? 'Processing...' : 'Process with AI'}
      </Button>
    </div>
  );
};