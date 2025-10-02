import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Brain, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";

export const ResearchControls = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [hasBaseline, setHasBaseline] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkBaseline();
  }, []);

  const checkBaseline = async () => {
    const { data } = await supabase
      .from('baselines')
      .select('id')
      .eq('status', 'completed')
      .limit(1)
      .maybeSingle();
    
    setHasBaseline(!!data);
  };

  const handleGenerateResearch = async () => {
    // Check if baseline exists
    if (!hasBaseline) {
      setShowDatePicker(true);
      return;
    }

    await generateResearch();
  };

  const handleDateConfirm = async () => {
    if (!selectedDate) return;

    setIsGenerating(true);
    setShowDatePicker(false);

    try {
      toast({
        title: "Setting Tracking Date",
        description: "Setting up tracking start date...",
      });

      // First create the baseline
      const { error: baselineError } = await supabase.functions.invoke('generate-baseline', {
        body: { 
          start_date: format(selectedDate, 'yyyy-MM-dd')
        }
      });

      if (baselineError) throw baselineError;

      // Update baseline state
      setHasBaseline(true);

      toast({
        title: "Tracking Date Set",
        description: `Now generating research from ${format(selectedDate, 'PPP')}...`,
      });

      // Then generate research
      const { error: researchError } = await supabase.functions.invoke('research-fighter-comparison');

      if (researchError) throw researchError;

      toast({
        title: "Research Complete",
        description: "Intelligence report has been generated successfully.",
      });

      // Reload page to update tracking date display
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (error: any) {
      console.error('Error setting baseline:', error);
      toast({
        title: "Failed",
        description: error.message || "Could not complete operation",
        variant: "destructive",
      });
      setIsGenerating(false);
    }
  };

  const generateResearch = async () => {
    setIsGenerating(true);
    
    try {
      toast({
        title: "Research Started",
        description: "AI is analyzing fighter comparison data across multiple dimensions...",
      });

      const { data, error } = await supabase.functions.invoke('research-fighter-comparison');

      if (error) throw error;

      toast({
        title: "Research Complete",
        description: "Intelligence report has been generated successfully.",
      });
    } catch (error: any) {
      console.error('Error generating research:', error);
      toast({
        title: "Research Failed",
        description: error.message || "Failed to generate intelligence report",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <Card className="p-4 bg-gradient-to-r from-primary/10 to-primary/5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Intelligence Research
            </h3>
            <p className="text-sm text-muted-foreground">
              Generate comprehensive fighter comparison analysis
            </p>
          </div>
          <Button 
            onClick={handleGenerateResearch}
            disabled={isGenerating}
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Researching...
              </>
            ) : (
              <>
                <Brain className="mr-2 h-4 w-4" />
                Generate Research
              </>
            )}
          </Button>
        </div>
      </Card>

      <Dialog open={showDatePicker} onOpenChange={setShowDatePicker}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Tracking Start Date</DialogTitle>
            <DialogDescription>
              Choose the date from which you want to start tracking media coverage and sentiment.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) => date > new Date()}
              initialFocus
            />
            <Button 
              onClick={handleDateConfirm}
              disabled={!selectedDate}
              className="w-full"
            >
              Set Date & Generate Research
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};