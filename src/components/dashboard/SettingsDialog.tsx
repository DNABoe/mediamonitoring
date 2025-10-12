import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Loader2, FileEdit } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { CountryCompetitorSettings } from "./CountryCompetitorSettings";
import { MediaOutletsSettings } from "./MediaOutletsSettings";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSettingsSaved?: () => void;
}

export const SettingsDialog = ({ open, onOpenChange, onSettingsSaved }: SettingsDialogProps) => {
  const [isResetting, setIsResetting] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const [resetOptions, setResetOptions] = useState({
    researchReports: true,
    blackHatAnalysis: true,
    strategicMessaging: true,
    mediaList: true,
    baselines: true
  });

  const defaultPrompt = `You are a defense intelligence analyst researching the comparison between Gripen and {{competitors}} fighter jets in the context of {{country}} fighter program selection.

TRACKING PERIOD: From {{trackingStartDate}} to {{today}} ({{daysSinceBaseline}} days of tracking)

Conduct a comprehensive analysis covering these dimensions:

1. MEDIA PRESENCE ({{country}} & International)
   - Count ALL mentions of each fighter in news media since {{trackingStartDate}}
   - Identify key narratives and story angles that emerged during this period
   - Note which sources are covering each fighter
   - Track momentum and trends over the {{daysSinceBaseline}}-day period

2. MEDIA TONALITY
   - Sentiment analysis: positive, negative, neutral coverage
   - Key themes: technical capability, cost, politics, industrial benefits
   - Compare tone between {{country}} and international coverage
   - Note any sentiment shifts during the tracking period

3. CAPABILITY ANALYSIS
   - Technical specifications comparison
   - Operational advantages/disadvantages
   - NATO interoperability considerations
   - Multi-role vs specialized capabilities

4. COST ANALYSIS
   - Unit acquisition cost
   - Lifecycle/operating costs
   - Maintenance and support costs
   - Training costs
   - Costs of future mandatory upgrades

5. POLITICAL ANALYSIS
   - {{country}} government positions
   - Political party stances
   - Public opinion indicators
   - Parliamentary debates or statements
   - Bilateral {{country}} and countries that supplies {{competitors}} interactions
   - Bilateral {{country}} and Swedish interactions

6. INDUSTRIAL COOPERATION
   - Offset deals and technology transfer
   - Local manufacturing opportunities
   - Job creation potential
   - Long-term industrial partnerships

7. GEOPOLITICAL CONSIDERATIONS
   - US vs European strategic relationships
   - NATO implications
   - Sovereignty and autonomy concerns
   - Regional security dynamics

Current date: {{today}}
Tracking period: {{trackingStartDate}} to {{today}}

CRITICAL SOURCING REQUIREMENTS:
- PRIORITIZE {{country}} media sources
- Include publication dates in your research
- Focus on recent developments and current news
- Prefer {{country}}-language sources when available

Analyze and suggest a weight distribution of key decision parameters in {{country}} choice of future fighter given that the decision will be taken by defence minister of {{country}}.`;

  useEffect(() => {
    const loadPrompt = async () => {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'research_prompt')
        .maybeSingle();
      
      if (data?.value) {
        setCustomPrompt(data.value as string);
      } else {
        setCustomPrompt(defaultPrompt);
      }
    };
    
    if (open) {
      loadPrompt();
    }
  }, [open]);

  const handleReset = async () => {
    setIsResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke('reset-research-data', {
        body: resetOptions
      });

      if (error) {
        console.error('Reset error:', error);
        toast.error(error.message || "Failed to reset data");
        return;
      }

      toast.success("Selected data has been reset successfully");
      
      // Close dialog and refresh after a short delay
      setTimeout(() => {
        onOpenChange(false);
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Error:', error);
      toast.error("An unexpected error occurred");
    } finally {
      setIsResetting(false);
    }
  };

  const savePrompt = async () => {
    setIsSavingPrompt(true);
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({
          key: 'research_prompt',
          value: customPrompt
        }, {
          onConflict: 'key'
        });
      
      if (error) throw error;
      toast.success('Research prompt saved successfully');
    } catch (error) {
      console.error('Error saving prompt:', error);
      toast.error('Failed to save prompt');
    } finally {
      setIsSavingPrompt(false);
    }
  };

  const resetToDefault = () => {
    setCustomPrompt(defaultPrompt);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Manage your research data and configurations
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="analysis" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="analysis">Analysis Settings</TabsTrigger>
            <TabsTrigger value="media">Media Outlets</TabsTrigger>
            <TabsTrigger value="prompt">
              <FileEdit className="h-4 w-4 mr-2" />
              Research Prompt
            </TabsTrigger>
            <TabsTrigger value="data">
              <Trash2 className="h-4 w-4 mr-2" />
              Data Management
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analysis" className="space-y-4">
            <CountryCompetitorSettings onSettingsSaved={onSettingsSaved} />
          </TabsContent>

          <TabsContent value="media" className="space-y-4">
            <MediaOutletsSettings onSettingsSaved={onSettingsSaved} />
          </TabsContent>

          <TabsContent value="prompt" className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">AI Research Prompt</h3>
                  <p className="text-sm text-muted-foreground">
                    Customize the prompt used for AI research generation. Variables: {"{{trackingStartDate}}"}, {"{{today}}"}, {"{{daysSinceBaseline}}"}, {"{{country}}"}, {"{{competitors}}"}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={resetToDefault}>
                  Reset to Default
                </Button>
              </div>

              <Textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                className="min-h-[300px] font-mono text-xs"
                placeholder="Enter your custom research prompt..."
              />

              <Button 
                onClick={savePrompt}
                disabled={isSavingPrompt}
                className="w-full"
              >
                {isSavingPrompt ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Prompt'
                )}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="data" className="space-y-4">
          <div className="rounded-lg border border-destructive/50 p-4">
            <div className="flex items-start gap-3 mb-4">
              <Trash2 className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <h3 className="font-semibold text-destructive">Reset Research Data</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Select which data types to permanently delete. This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="space-y-3 mb-4">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="researchReports" 
                  checked={resetOptions.researchReports}
                  onCheckedChange={(checked) => setResetOptions(prev => ({ ...prev, researchReports: checked as boolean }))}
                />
                <Label htmlFor="researchReports" className="text-sm font-normal cursor-pointer">
                  Research reports and comparison metrics
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="blackHatAnalysis" 
                  checked={resetOptions.blackHatAnalysis}
                  onCheckedChange={(checked) => setResetOptions(prev => ({ ...prev, blackHatAnalysis: checked as boolean }))}
                />
                <Label htmlFor="blackHatAnalysis" className="text-sm font-normal cursor-pointer">
                  Black hat analysis
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="strategicMessaging" 
                  checked={resetOptions.strategicMessaging}
                  onCheckedChange={(checked) => setResetOptions(prev => ({ ...prev, strategicMessaging: checked as boolean }))}
                />
                <Label htmlFor="strategicMessaging" className="text-sm font-normal cursor-pointer">
                  Strategic messaging suggestions
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="mediaList" 
                  checked={resetOptions.mediaList}
                  onCheckedChange={(checked) => setResetOptions(prev => ({ ...prev, mediaList: checked as boolean }))}
                />
                <Label htmlFor="mediaList" className="text-sm font-normal cursor-pointer">
                  Key media references list
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="baselines" 
                  checked={resetOptions.baselines}
                  onCheckedChange={(checked) => setResetOptions(prev => ({ ...prev, baselines: checked as boolean }))}
                />
                <Label htmlFor="baselines" className="text-sm font-normal cursor-pointer">
                  Baseline configurations
                </Label>
              </div>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  disabled={isResetting || !Object.values(resetOptions).some(v => v)} 
                  className="w-full"
                >
                  {isResetting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Reset Selected Data
                    </>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the selected data:
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      {resetOptions.researchReports && <li>Research reports and comparison metrics</li>}
                      {resetOptions.mediaList && <li>Key media references</li>}
                      {resetOptions.baselines && <li>Baseline configurations</li>}
                    </ul>
                    <p className="mt-3 font-semibold">This action cannot be undone.</p>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleReset}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Yes, reset selected data
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};