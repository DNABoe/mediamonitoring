import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface UserSettings {
  activeCountry: string;
  activeCompetitors: string[];
  countryFlag: string;
  countryName: string;
  prioritizedOutlets: Array<{ name: string; active: boolean }>;
}

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

export const useUserSettings = () => {
  const [settings, setSettings] = useState<UserSettings>({
    activeCountry: 'PT',
    activeCompetitors: ['F-35'],
    countryFlag: '🇵🇹',
    countryName: 'Portugal',
    prioritizedOutlets: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();

    const channel = supabase
      .channel('user-settings-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_settings',
      }, () => loadSettings())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_settings')
        .select('active_country, active_competitors, prioritized_outlets')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading settings:', error);
      }

      const country = COUNTRIES.find(c => c.code === (data?.active_country || 'PT'));
      
      const outlets = data?.prioritized_outlets as unknown;
      const prioritizedOutlets = Array.isArray(outlets) ? outlets as Array<{ name: string; active: boolean }> : [];
      
      setSettings({
        activeCountry: data?.active_country || 'PT',
        activeCompetitors: data?.active_competitors || ['F-35'],
        countryFlag: country?.flag || '🇵🇹',
        countryName: country?.name || 'Portugal',
        prioritizedOutlets,
      });
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  return { settings, loading, refreshSettings: loadSettings };
};