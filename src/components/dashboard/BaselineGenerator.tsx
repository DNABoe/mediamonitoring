import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface BaselineGeneratorProps {
  currentDate: string | null;
}

export const BaselineGenerator = ({ currentDate }: BaselineGeneratorProps) => {
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>(
    currentDate ? new Date(currentDate) : undefined
  );
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async (date: Date) => {
    setIsGenerating(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("You must be logged in");
        return;
      }

      toast.info("Setting tracking start date...");

      const { data, error } = await supabase.functions.invoke('generate-baseline', {
        body: { 
          start_date: format(date, 'yyyy-MM-dd')
        }
      });

      if (error) {
        console.error('Error generating baseline:', error);
        toast.error(error.message || "Failed to set tracking date");
        return;
      }

      console.log('Baseline generated:', data);
      
      toast.success(
        `Tracking date set to ${format(date, 'PPP')}!`
      );
      
      // Trigger article collection
      toast.info("Starting article collection...");
      
      const { data: baseline } = await supabase
        .from('baselines')
        .select('start_date, end_date')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (baseline) {
        const { data: userSettings } = await supabase
          .from('user_settings')
          .select('active_country, active_competitors')
          .eq('user_id', user.id)
          .maybeSingle();

        const country = userSettings?.active_country || 'PT';
        const competitors = userSettings?.active_competitors || ['F-35'];

        console.log('Starting article collection with:', {
          country,
          competitors,
          startDate: baseline.start_date,
          endDate: baseline.end_date
        });

        // Await the collection to show results
        const { data: collectionData, error: collectionError } = await supabase.functions.invoke('collect-articles-for-tracking', {
          body: {
            country,
            competitors,
            startDate: baseline.start_date,
            endDate: baseline.end_date
          }
        });

        if (collectionError) {
          console.error('Collection error:', collectionError);
          toast.error(`Article collection failed: ${collectionError.message}`);
        } else {
          console.log('Collection result:', collectionData);
          const articlesFound = collectionData?.articlesFound || 0;
          const articlesStored = collectionData?.articlesStored || 0;
          toast.success(`Found ${articlesFound} articles, stored ${articlesStored}`);
        }
      }

      setOpen(false);
      setStartDate(undefined);
    } catch (error) {
      console.error('Error:', error);
      toast.error("An unexpected error occurred");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setStartDate(date);
      handleGenerate(date);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="px-2 py-0.5 bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors cursor-pointer text-xs">
          Tracking from: {currentDate ? new Date(currentDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not set'}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3">
          <p className="text-sm font-medium mb-2">Set tracking start date</p>
          <Calendar
            mode="single"
            selected={startDate}
            onSelect={handleDateSelect}
            disabled={(date) => date > new Date() || isGenerating}
            defaultMonth={startDate || new Date()}
            initialFocus
            className={cn("pointer-events-auto")}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
};