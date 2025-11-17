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
  { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
  { code: 'AT', name: 'Austria', flag: '🇦🇹' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
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
  { code: 'FI', name: 'Finland', flag: '🇫🇮' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'GR', name: 'Greece', flag: '🇬🇷' },
  { code: 'HU', name: 'Hungary', flag: '🇭🇺' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'ID', name: 'Indonesia', flag: '🇮🇩' },
  { code: 'IL', name: 'Israel', flag: '🇮🇱' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'MY', name: 'Malaysia', flag: '🇲🇾' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿' },
  { code: 'NO', name: 'Norway', flag: '🇳🇴' },
  { code: 'PK', name: 'Pakistan', flag: '🇵🇰' },
  { code: 'PE', name: 'Peru', flag: '🇵🇪' },
  { code: 'PH', name: 'Philippines', flag: '🇵🇭' },
  { code: 'PL', name: 'Poland', flag: '🇵🇱' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹' },
  { code: 'RO', name: 'Romania', flag: '🇷🇴' },
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
  { code: 'SK', name: 'Slovakia', flag: '🇸🇰' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭' },
  { code: 'TW', name: 'Taiwan', flag: '🇹🇼' },
  { code: 'TH', name: 'Thailand', flag: '🇹🇭' },
  { code: 'TR', name: 'Turkey', flag: '🇹🇷' },
  { code: 'UA', name: 'Ukraine', flag: '🇺🇦' },
  { code: 'AE', name: 'UAE', flag: '🇦🇪' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'VN', name: 'Vietnam', flag: '🇻🇳' },
];

export const useUserSettings = () => {
  const [settings, setSettings] = useState<UserSettings>({
    activeCountry: '',
    activeCompetitors: [],
    countryFlag: '🌍',
    countryName: '',
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

      const country = data?.active_country ? COUNTRIES.find(c => c.code === data.active_country) : null;
      
      const outlets = data?.prioritized_outlets as unknown;
      const prioritizedOutlets = Array.isArray(outlets) ? outlets as Array<{ name: string; active: boolean }> : [];
      
      setSettings({
        activeCountry: data?.active_country || '',
        activeCompetitors: data?.active_competitors || [],
        countryFlag: country?.flag || '🌍',
        countryName: country?.name || '',
        prioritizedOutlets,
      });

      // Only initialize agent if country is configured
      if (data?.active_country) {
        const activeCountry = data.active_country;
        const { data: agentData } = await supabase
          .from('agent_status')
          .select('id')
          .eq('user_id', user.id)
          .eq('active_country', activeCountry)
          .maybeSingle();

        if (!agentData) {
          console.log('No agent found, initializing for', activeCountry);
          
          // Discover outlets if none exist
          if (!prioritizedOutlets || prioritizedOutlets.length === 0) {
            console.log('Discovering media outlets...');
            const countryObj = COUNTRIES.find(c => c.code === activeCountry);
            const { data: discoverData } = await supabase.functions.invoke(
              'agent-discover-outlets',
              {
                body: {
                  country: activeCountry,
                  countryName: countryObj?.name || activeCountry,
                }
              }
            );

            if (discoverData?.outlets) {
              console.log(`Discovered ${discoverData.outlets.length} outlets`);
              await supabase
                .from('user_settings')
                .update({
                  prioritized_outlets: discoverData.outlets,
                  updated_at: new Date().toISOString(),
                })
                .eq('user_id', user.id);
            }
          }

          // Create and start agent
          const { error: agentError } = await supabase
            .from('agent_status')
            .insert({
              user_id: user.id,
              active_country: activeCountry,
              active_competitors: data?.active_competitors || [],
              status: 'running',
              update_frequency: 'hourly',
              next_run_at: new Date(Date.now() + 1 * 60 * 1000).toISOString(), // Run in 1 minute
              outlets_discovered: prioritizedOutlets?.length || 0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });

          if (!agentError) {
            console.log('✅ Agent initialized and will start collecting news in 1 minute');
          } else {
            console.error('Error creating agent:', agentError);
          }
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  return { settings, loading, refreshSettings: loadSettings };
};