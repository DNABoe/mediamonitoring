import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Newspaper, Loader2, Sparkles, Plus, X, Pause, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface PrioritizedOutlet {
  name: string;
  active: boolean;
}

const COUNTRIES = [
  { code: 'AF', name: 'Afghanistan', flag: '🇦🇫' },
  { code: 'AL', name: 'Albania', flag: '🇦🇱' },
  { code: 'DZ', name: 'Algeria', flag: '🇩🇿' },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
  { code: 'AM', name: 'Armenia', flag: '🇦🇲' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'AT', name: 'Austria', flag: '🇦🇹' },
  { code: 'AZ', name: 'Azerbaijan', flag: '🇦🇿' },
  { code: 'BH', name: 'Bahrain', flag: '🇧🇭' },
  { code: 'BD', name: 'Bangladesh', flag: '🇧🇩' },
  { code: 'BY', name: 'Belarus', flag: '🇧🇾' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'BG', name: 'Bulgaria', flag: '🇧🇬' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱' },
  { code: 'CN', name: 'China', flag: '🇨🇳' },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴' },
  { code: 'HR', name: 'Croatia', flag: '🇭🇷' },
  { code: 'CZ', name: 'Czech Republic', flag: '🇨🇿' },
  { code: 'DK', name: 'Denmark', flag: '🇩🇰' },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬' },
  { code: 'EE', name: 'Estonia', flag: '🇪🇪' },
  { code: 'FI', name: 'Finland', flag: '🇫🇮' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'GE', name: 'Georgia', flag: '🇬🇪' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'GR', name: 'Greece', flag: '🇬🇷' },
  { code: 'HU', name: 'Hungary', flag: '🇭🇺' },
  { code: 'IS', name: 'Iceland', flag: '🇮🇸' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'ID', name: 'Indonesia', flag: '🇮🇩' },
  { code: 'IR', name: 'Iran', flag: '🇮🇷' },
  { code: 'IQ', name: 'Iraq', flag: '🇮🇶' },
  { code: 'IE', name: 'Ireland', flag: '🇮🇪' },
  { code: 'IL', name: 'Israel', flag: '🇮🇱' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'JO', name: 'Jordan', flag: '🇯🇴' },
  { code: 'KZ', name: 'Kazakhstan', flag: '🇰🇿' },
  { code: 'KW', name: 'Kuwait', flag: '🇰🇼' },
  { code: 'LV', name: 'Latvia', flag: '🇱🇻' },
  { code: 'LB', name: 'Lebanon', flag: '🇱🇧' },
  { code: 'LT', name: 'Lithuania', flag: '🇱🇹' },
  { code: 'LU', name: 'Luxembourg', flag: '🇱🇺' },
  { code: 'MY', name: 'Malaysia', flag: '🇲🇾' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
  { code: 'MD', name: 'Moldova', flag: '🇲🇩' },
  { code: 'MN', name: 'Mongolia', flag: '🇲🇳' },
  { code: 'ME', name: 'Montenegro', flag: '🇲🇪' },
  { code: 'MA', name: 'Morocco', flag: '🇲🇦' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿' },
  { code: 'NO', name: 'Norway', flag: '🇳🇴' },
  { code: 'OM', name: 'Oman', flag: '🇴🇲' },
  { code: 'PK', name: 'Pakistan', flag: '🇵🇰' },
  { code: 'PH', name: 'Philippines', flag: '🇵🇭' },
  { code: 'PL', name: 'Poland', flag: '🇵🇱' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹' },
  { code: 'QA', name: 'Qatar', flag: '🇶🇦' },
  { code: 'RO', name: 'Romania', flag: '🇷🇴' },
  { code: 'RU', name: 'Russia', flag: '🇷🇺' },
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: 'RS', name: 'Serbia', flag: '🇷🇸' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
  { code: 'SK', name: 'Slovakia', flag: '🇸🇰' },
  { code: 'SI', name: 'Slovenia', flag: '🇸🇮' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭' },
  { code: 'TW', name: 'Taiwan', flag: '🇹🇼' },
  { code: 'TH', name: 'Thailand', flag: '🇹🇭' },
  { code: 'TR', name: 'Turkey', flag: '🇹🇷' },
  { code: 'UA', name: 'Ukraine', flag: '🇺🇦' },
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'VN', name: 'Vietnam', flag: '🇻🇳' },
];

interface MediaOutletsSettingsProps {
  onSettingsSaved?: () => void;
}

export const MediaOutletsSettings = ({ onSettingsSaved }: MediaOutletsSettingsProps) => {
  const [activeCountry, setActiveCountry] = useState<string>('PT');
  const [prioritizedOutlets, setPrioritizedOutlets] = useState<PrioritizedOutlet[]>([]);
  const [newOutlet, setNewOutlet] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingOutlets, setGeneratingOutlets] = useState(false);
  const [generatedOutlets, setGeneratedOutlets] = useState<string[]>([]);
  const [showGeneratedDialog, setShowGeneratedDialog] = useState(false);
  const [selectedGenerated, setSelectedGenerated] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_settings')
        .select('active_country, prioritized_outlets')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setActiveCountry(data.active_country);
        const outlets = data.prioritized_outlets as unknown;
        setPrioritizedOutlets(Array.isArray(outlets) ? outlets as PrioritizedOutlet[] : []);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          prioritized_outlets: prioritizedOutlets as any,
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      toast.success('Media outlets saved successfully');
      
      if (onSettingsSaved) {
        onSettingsSaved();
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const addOutlet = () => {
    const trimmedOutlet = newOutlet.trim();
    if (!trimmedOutlet) {
      toast.error('Please enter a media outlet name or URL');
      return;
    }
    if (trimmedOutlet.length > 200) {
      toast.error('Media outlet name/URL must be less than 200 characters');
      return;
    }
    if (prioritizedOutlets.some(o => o.name === trimmedOutlet)) {
      toast.error('This outlet is already in the list');
      return;
    }
    setPrioritizedOutlets(prev => [...prev, { name: trimmedOutlet, active: true }]);
    setNewOutlet('');
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    
    const outlets = pastedText
      .split(/[\n,;]+/)
      .map(outlet => outlet.trim())
      .filter(outlet => outlet.length > 0 && outlet.length <= 200);
    
    if (outlets.length === 0) {
      toast.error('No valid outlets found in pasted text');
      return;
    }
    
    const newOutlets = outlets.filter(
      outlet => !prioritizedOutlets.some(o => o.name === outlet)
    );
    
    if (newOutlets.length === 0) {
      toast.error('All pasted outlets are already in the list');
      return;
    }
    
    const addedOutlets = newOutlets.map(name => ({ name, active: true }));
    setPrioritizedOutlets(prev => [...prev, ...addedOutlets]);
    setNewOutlet('');
    
    toast.success(`Added ${newOutlets.length} outlet${newOutlets.length > 1 ? 's' : ''}`);
  };

  const removeOutlet = (outletName: string) => {
    setPrioritizedOutlets(prev => prev.filter(o => o.name !== outletName));
  };

  const toggleOutletActive = (outletName: string) => {
    setPrioritizedOutlets(prev => 
      prev.map(o => o.name === outletName ? { ...o, active: !o.active } : o)
    );
  };

  const generateMediaOutlets = async () => {
    setGeneratingOutlets(true);
    try {
      const selectedCountry = COUNTRIES.find(c => c.code === activeCountry);
      if (!selectedCountry) {
        toast.error('Please select a country first');
        return;
      }

      const { data, error } = await supabase.functions.invoke('generate-media-outlets', {
        body: { 
          country: activeCountry,
          countryName: selectedCountry.name
        }
      });

      if (error) throw error;

      if (data?.success && data.outlets) {
        setGeneratedOutlets(data.outlets);
        setSelectedGenerated(new Set(data.outlets));
        setShowGeneratedDialog(true);
        toast.success(`Generated ${data.outlets.length} media outlets`);
      } else {
        toast.error('Failed to generate media outlets');
      }
    } catch (error) {
      console.error('Error generating outlets:', error);
      toast.error('Failed to generate media outlets');
    } finally {
      setGeneratingOutlets(false);
    }
  };

  const toggleGeneratedOutlet = (outlet: string) => {
    setSelectedGenerated(prev => {
      const newSet = new Set(prev);
      if (newSet.has(outlet)) {
        newSet.delete(outlet);
      } else {
        newSet.add(outlet);
      }
      return newSet;
    });
  };

  const addSelectedOutlets = () => {
    const newOutlets = Array.from(selectedGenerated)
      .filter(outlet => !prioritizedOutlets.some(o => o.name === outlet))
      .map(name => ({ name, active: true }));
    
    setPrioritizedOutlets(prev => [...prev, ...newOutlets]);
    setShowGeneratedDialog(false);
    setGeneratedOutlets([]);
    setSelectedGenerated(new Set());
    
    toast.success(`Added ${newOutlets.length} outlet${newOutlets.length !== 1 ? 's' : ''}`);
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Newspaper className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Prioritized Media Outlets</h3>
          </div>
          <div className="flex gap-2">
            {prioritizedOutlets.length > 0 && (
              <Button
                onClick={() => {
                  setPrioritizedOutlets([]);
                  toast.success('All media outlets cleared');
                }}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Clear List
              </Button>
            )}
            <Button
              onClick={generateMediaOutlets}
              disabled={generatingOutlets || !activeCountry}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              {generatingOutlets ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate List
                </>
              )}
            </Button>
          </div>
        </div>
        
        <p className="text-sm text-muted-foreground">
          Add specific media outlets that should be prioritized in the analysis. Enter the outlet name or domain, or paste a list of URLs (one per line, or separated by commas)
        </p>
        
        <div className="flex gap-2">
          <Input
            value={newOutlet}
            onChange={(e) => setNewOutlet(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addOutlet()}
            onPaste={handlePaste}
            placeholder="e.g., publico.pt or paste multiple URLs"
            className="flex-1"
            maxLength={200}
          />
          <Button onClick={addOutlet} variant="outline" size="icon">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {prioritizedOutlets.length > 0 && (
          <ScrollArea className="h-[300px] border rounded-lg p-3">
            <div className="space-y-2 pr-4">
              {prioritizedOutlets.map((outlet) => {
                const isUrl = outlet.name.includes('.') && !outlet.name.includes(' ');
                const url = isUrl && !outlet.name.startsWith('http') 
                  ? `https://${outlet.name}` 
                  : outlet.name;
                
                return (
                  <div key={outlet.name} className="flex items-center justify-between gap-2 p-2 rounded bg-secondary/50">
                    {isUrl ? (
                      <a 
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          "text-sm flex-1 hover:underline",
                          !outlet.active && "text-muted-foreground line-through"
                        )}
                      >
                        {outlet.name}
                      </a>
                    ) : (
                      <span className={cn(
                        "text-sm flex-1",
                        !outlet.active && "text-muted-foreground line-through"
                      )}>
                        {outlet.name}
                      </span>
                    )}
                  <div className="flex items-center gap-1">
                    <Button
                      onClick={() => toggleOutletActive(outlet.name)}
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title={outlet.active ? "Pause" : "Activate"}
                    >
                      {outlet.active ? (
                        <Pause className="h-3 w-3" />
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      onClick={() => removeOutlet(outlet.name)}
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>

      <Button onClick={saveSettings} disabled={saving} className="w-full">
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Saving...
          </>
        ) : (
          'Save Media Outlets'
        )}
      </Button>

      <Dialog open={showGeneratedDialog} onOpenChange={setShowGeneratedDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Generated Media Outlets for {COUNTRIES.find(c => c.code === activeCountry)?.name}</DialogTitle>
            <DialogDescription>
              Select the outlets you want to add to your prioritized list
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-2">
              {generatedOutlets.map((outlet) => (
                <div key={outlet} className="flex items-center space-x-2 p-2 rounded hover:bg-secondary/50">
                  <Checkbox
                    id={outlet}
                    checked={selectedGenerated.has(outlet)}
                    onCheckedChange={() => toggleGeneratedOutlet(outlet)}
                  />
                  <Label
                    htmlFor={outlet}
                    className="text-sm font-normal cursor-pointer flex-1"
                  >
                    {outlet}
                  </Label>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="flex justify-between items-center pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              {selectedGenerated.size} of {generatedOutlets.length} selected
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowGeneratedDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={addSelectedOutlets}
                disabled={selectedGenerated.size === 0}
              >
                Add Selected ({selectedGenerated.size})
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};