import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe, Loader2 } from "lucide-react";
import { toast } from "sonner";

const COUNTRIES = [
  { code: 'PT', name: 'Portugal', flag: '🇵🇹' },
  { code: 'PL', name: 'Poland', flag: '🇵🇱' },
  { code: 'RO', name: 'Romania', flag: '🇷🇴' },
  { code: 'GR', name: 'Greece', flag: '🇬🇷' },
  { code: 'CZ', name: 'Czech Republic', flag: '🇨🇿' },
  { code: 'SK', name: 'Slovakia', flag: '🇸🇰' },
  { code: 'BG', name: 'Bulgaria', flag: '🇧🇬' },
  { code: 'HR', name: 'Croatia', flag: '🇭🇷' },
];

const COMPETITORS = ['F-35', 'Rafale', 'F-16V', 'Eurofighter', 'F/A-50'];

interface CountryCompetitorSettingsProps {
  onSettingsSaved?: () => void;
}

export const CountryCompetitorSettings = ({ onSettingsSaved }: CountryCompetitorSettingsProps) => {
  const [activeCountry, setActiveCountry] = useState<string>('PT');
  const [activeCompetitors, setActiveCompetitors] = useState<string[]>(['F-35']);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_settings')
        .select('active_country, active_competitors')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setActiveCountry(data.active_country);
        setActiveCompetitors(data.active_competitors || ['F-35']);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (activeCompetitors.length === 0) {
      toast.error('Please select at least one competitor');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          active_country: activeCountry,
          active_competitors: activeCompetitors,
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      toast.success('Analysis settings saved successfully');
      
      // Notify parent component that settings were saved
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

  const toggleCompetitor = (competitor: string) => {
    setActiveCompetitors(prev => 
      prev.includes(competitor)
        ? prev.filter(c => c !== competitor)
        : [...prev, competitor]
    );
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>;
  }

  const selectedCountry = COUNTRIES.find(c => c.code === activeCountry);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Active Country</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Select the country for media analysis and political context
        </p>
        
        <Select value={activeCountry} onValueChange={setActiveCountry}>
          <SelectTrigger className="w-full">
            <SelectValue>
              {selectedCountry && (
                <span className="flex items-center gap-2">
                  <span className="text-2xl">{selectedCountry.flag}</span>
                  <span>{selectedCountry.name}</span>
                </span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {COUNTRIES.map((country) => (
              <SelectItem key={country.code} value={country.code}>
                <span className="flex items-center gap-2">
                  <span className="text-2xl">{country.flag}</span>
                  <span>{country.name}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold">Active Competitors</h3>
        <p className="text-sm text-muted-foreground">
          Select competitors to compare against Gripen (select at least one)
        </p>
        
        <div className="space-y-2 border rounded-lg p-4">
          {COMPETITORS.map((competitor) => (
            <div key={competitor} className="flex items-center space-x-2">
              <Checkbox
                id={competitor}
                checked={activeCompetitors.includes(competitor)}
                onCheckedChange={() => toggleCompetitor(competitor)}
              />
              <Label
                htmlFor={competitor}
                className="text-sm font-normal cursor-pointer"
              >
                {competitor}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <Button onClick={saveSettings} disabled={saving || activeCompetitors.length === 0} className="w-full">
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Saving...
          </>
        ) : (
          'Save Analysis Settings'
        )}
      </Button>

      {activeCompetitors.length === 0 && (
        <p className="text-sm text-destructive">
          Please select at least one competitor
        </p>
      )}
    </div>
  );
};