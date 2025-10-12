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
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
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
        `Tracking date set to ${format(date, 'PPP')}! ${data.summary.items_count} items collected.`
      );
      
      setOpen(false);
      setStartDate(undefined);
      
      // No need to reload - real-time subscription will update the baseline date
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