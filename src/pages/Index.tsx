import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserSettings } from "@/hooks/useUserSettings";
import { WinnerMetar } from "@/components/dashboard/WinnerMetar";
import { BaselineGenerator } from "@/components/dashboard/BaselineGenerator";
import { ResearchExecutiveSummary } from "@/components/dashboard/ResearchExecutiveSummary";
import { ResearchDimensions } from "@/components/dashboard/ResearchDimensions";
import { SentimentTimeline } from "@/components/dashboard/SentimentTimeline";
import { ResearchControls } from "@/components/dashboard/ResearchControls";
import { ResearchSources } from "@/components/dashboard/ResearchSources";
import { StrategicSuggestions } from "@/components/dashboard/StrategicSuggestions";
import { ResearchChanges } from "@/components/dashboard/ResearchChanges";
import { SettingsDialog } from "@/components/dashboard/SettingsDialog";
import { BlackHatAnalysis } from "@/components/dashboard/BlackHatAnalysis";
import { AgentStatusPanel } from "@/components/dashboard/AgentStatusPanel";
import { Settings, LogOut, Plane } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExportPDF } from "@/components/dashboard/ExportPDF";
import { MediaArticlesList } from "@/components/dashboard/MediaArticlesList";
import { BackgroundAnalysis } from "@/components/dashboard/BackgroundAnalysis";
import { SentimentOverTimeChart } from "@/components/dashboard/SentimentOverTimeChart";
import { SentimentDistributionChart } from "@/components/dashboard/SentimentDistributionChart";
import { PublicationTimelineChart } from "@/components/dashboard/PublicationTimelineChart";
import { MediaMonitoringAgent } from "@/components/dashboard/MediaMonitoringAgent";
import { SocialMediaFeed } from "@/components/dashboard/SocialMediaFeed";
import { useSentimentData } from "@/hooks/useSentimentData";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Index = () => {
  const {
    user,
    isAdmin,
    loading: authLoading,
    signOut
  } = useAuth();
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [baselineDate, setBaselineDate] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { settings: userSettings, loading: settingsLoading } = useUserSettings();
  const { 
    sentimentOverTime, 
    publicationTimeline, 
    sentimentDistribution, 
    loading: sentimentLoading 
  } = useSentimentData(userSettings.activeCountry, userSettings.activeCompetitors);

  useEffect(() => {
    if (!authLoading && !user) {
      window.location.href = "/auth";
    }
  }, [user, authLoading]);
  useEffect(() => {
    const fetchLastUpdate = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch latest research report to get last update time
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
    const fetchBaseline = async () => {
      // Only fetch start_date, not internal fields like created_by
      const {
        data
      } = await supabase.from('baselines').select('start_date').eq('status', 'completed').order('created_at', {
        ascending: false
      }).limit(1).maybeSingle();
      if (data?.start_date) {
        setBaselineDate(data.start_date);
      }
    };
    fetchLastUpdate();
    fetchBaseline();

    const reportsChannel = supabase.channel('reports-changes').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'research_reports'
    }, () => fetchLastUpdate()).subscribe();
    const baselinesChannel = supabase.channel('baselines-changes').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'baselines'
    }, () => fetchBaseline()).subscribe();
    return () => {
      supabase.removeChannel(reportsChannel);
      supabase.removeChannel(baselinesChannel);
    };
  }, []);
  if (authLoading || !user) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>;
  }
  return <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-start gap-4">
            <span className="text-6xl leading-none">{userSettings.countryFlag}</span>
            <div className="flex flex-col items-start gap-1">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-foreground text-left">
                  Fighter Program Media Analysis - {userSettings.countryName}
                </h1>
                {isAdmin && <BaselineGenerator currentDate={baselineDate} />}
              </div>
                <div className="flex items-center gap-2 flex-wrap text-left">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
                  Real-time intelligence dashboard • Competitors:
                </p>
                <span className="text-xs font-medium text-primary">
                  Gripen
                </span>
                <span className="text-xs text-muted-foreground">vs</span>
                {userSettings.activeCompetitors.map((competitor, index) => (
                  <span key={competitor}>
                    <span className="text-xs font-medium text-primary">
                      {competitor}
                    </span>
                    {index < userSettings.activeCompetitors.length - 1 && (
                      <span className="text-xs text-muted-foreground mx-1">•</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ExportPDF />
            {isAdmin && <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
                <Settings className="h-4 w-4" />
              </Button>}
            <Button variant="outline" size="sm" onClick={signOut} title="Sign Out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {isAdmin && <div className="mb-6">
            <ResearchControls />
          </div>}

        <div className="mb-6">
          <BackgroundAnalysis 
            activeCountry={userSettings.activeCountry}
            countryName={userSettings.countryName}
            activeCompetitors={userSettings.activeCompetitors}
          />
        </div>

        <div className="mb-6">
          <ResearchChanges />
        </div>

        <div className="mb-6">
          <ResearchExecutiveSummary activeCompetitors={userSettings.activeCompetitors} />
        </div>

        <div className="mb-6">
          <SentimentOverTimeChart 
            activeCompetitors={userSettings.activeCompetitors}
            data={sentimentOverTime}
          />
        </div>

        <div className="mb-6">
          <SentimentDistributionChart 
            activeCompetitors={userSettings.activeCompetitors}
            sentimentData={sentimentDistribution}
          />
        </div>

        <div className="mb-6">
          <PublicationTimelineChart 
            activeCompetitors={userSettings.activeCompetitors}
            data={publicationTimeline}
          />
        </div>

        <div className="mb-6">
          <SentimentTimeline activeCompetitors={userSettings.activeCompetitors} />
        </div>

        <div className="mb-6">
          <ResearchDimensions />
        </div>

        <div className="mb-6">
          <WinnerMetar activeCompetitors={userSettings.activeCompetitors} />
        </div>

        <div className="mb-6">
          <StrategicSuggestions activeCompetitors={userSettings.activeCompetitors} />
        </div>

        <div className="mb-6">
          <BlackHatAnalysis activeCompetitors={userSettings.activeCompetitors} activeCountry={userSettings.activeCountry} />
        </div>

        <div className="mb-6">
          <ResearchSources />
        </div>

        <div className="mb-6">
          <MediaMonitoringAgent />
        </div>

        <div className="mb-6">
          <Tabs defaultValue="articles" className="w-full">
            <TabsList>
              <TabsTrigger value="articles">Media Articles</TabsTrigger>
              <TabsTrigger value="social">Social Media</TabsTrigger>
            </TabsList>
            <TabsContent value="articles">
              <MediaArticlesList 
                activeCountry={userSettings.activeCountry}
                activeCompetitors={userSettings.activeCompetitors}
                prioritizedOutlets={userSettings.prioritizedOutlets}
              />
            </TabsContent>
            <TabsContent value="social">
              <SocialMediaFeed 
                activeCountry={userSettings.activeCountry}
                activeCompetitors={userSettings.activeCompetitors}
              />
            </TabsContent>
          </Tabs>
        </div>

        <div className="mb-6">
          <AgentStatusPanel
            activeCountry={userSettings.activeCountry}
            activeCompetitors={userSettings.activeCompetitors}
          />
        </div>
      </div>

      {isAdmin && <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} onSettingsSaved={() => window.location.reload()} />}
    </div>;
};
export default Index;