import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Brain, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserSettings } from "@/hooks/useUserSettings";
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
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const { toast } = useToast();
  const { settings: userSettings } = useUserSettings();

  useEffect(() => {
    checkBaseline();
    fetchLastUpdate();

    const reportsChannel = supabase
      .channel('reports-changes-controls')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'research_reports'
      }, () => fetchLastUpdate())
      .subscribe();

    return () => {
      supabase.removeChannel(reportsChannel);
    };
  }, []);

  const checkBaseline = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get user's active country
    const { data: userSettings } = await supabase
      .from('user_settings')
      .select('active_country')
      .eq('user_id', user.id)
      .maybeSingle();

    const trackingCountry = userSettings?.active_country || 'PT';

    // Only check existence for this user and country
    const { data } = await supabase
      .from('baselines')
      .select('id')
      .eq('created_by', user.id)
      .eq('tracking_country', trackingCountry)
      .eq('status', 'completed')
      .limit(1)
      .maybeSingle();
    
    setHasBaseline(!!data);
  };

  const fetchLastUpdate = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: report } = await supabase
      .from('research_reports')
      .select('created_at')
      .eq('user_id', user.id)
      .order('report_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (report?.created_at) {
      setLastUpdate(new Date(report.created_at));
    }
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
      const { error: researchError } = await supabase.functions.invoke('research-fighter-comparison', {
        body: {
          country: userSettings.activeCountry,
          competitors: userSettings.activeCompetitors
        }
      });

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

      const { data, error } = await supabase.functions.invoke('research-fighter-comparison', {
        body: {
          country: userSettings.activeCountry,
          competitors: userSettings.activeCompetitors
        }
      });

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
          <div className="flex flex-col items-end gap-1">
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
            <span className="text-xs text-muted-foreground">
              {lastUpdate ? (
                <>
                  Last updated: {lastUpdate.toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                  })} {lastUpdate.toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                  })}
                </>
              ) : (
                'No Research'
              )}
            </span>
          </div>
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
              onSelect={(date) => {
                console.log('Date selected:', date);
                setSelectedDate(date);
              }}
              disabled={(date) => date > new Date()}
              initialFocus
            />
            <Button 
              onClick={() => {
                console.log('Button clicked, selectedDate:', selectedDate);
                handleDateConfirm();
              }}
              disabled={!selectedDate || isGenerating}
              className="w-full pointer-events-auto z-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Set Date & Generate Research"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};