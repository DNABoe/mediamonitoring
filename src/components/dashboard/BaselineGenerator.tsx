import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Database } from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const BaselineGenerator = () => {
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date>();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!startDate) {
      toast.error("Please select a start date");
      return;
    }

    setIsGenerating(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("You must be logged in");
        return;
      }

      toast.info("Generating baseline...");

      const { data, error } = await supabase.functions.invoke('generate-baseline', {
        body: { 
          start_date: format(startDate, 'yyyy-MM-dd')
        }
      });

      if (error) {
        console.error('Error generating baseline:', error);
        toast.error(error.message || "Failed to generate baseline");
        return;
      }

      console.log('Baseline generated:', data);
      
      toast.success(
        `Baseline generated successfully! ${data.summary.items_count} items and ${data.summary.alerts_count} alerts collected.`
      );
      
      setOpen(false);
      setStartDate(undefined);
    } catch (error) {
      console.error('Error:', error);
      toast.error("An unexpected error occurred");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Database className="h-4 w-4" />
          Generate Baseline
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Generate Baseline Collection</DialogTitle>
          <DialogDescription>
            Select a start date to collect all historical data and create a baseline.
            Real-time updates will be added to this baseline.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Start Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  {startDate ? format(startDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  disabled={(date) => date > new Date()}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {startDate && (
            <div className="rounded-md bg-muted p-3 text-sm">
              <p className="font-medium">Collection Period:</p>
              <p className="text-muted-foreground">
                From {format(startDate, "PPP")} to {format(new Date(), "PPP")}
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isGenerating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={!startDate || isGenerating}
          >
            {isGenerating ? "Generating..." : "Generate Baseline"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};