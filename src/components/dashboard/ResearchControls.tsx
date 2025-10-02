import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Brain, Loader2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const ResearchControls = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const handleGenerateResearch = async () => {
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
    <Card className="p-4 bg-gradient-to-r from-primary/10 to-primary/5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Intelligence Research
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
  );
};