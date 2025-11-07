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
import { SocialMediaFeed } from "@/components/dashboard/SocialMediaFeed";
import { SocialMediaAnalysis } from "@/components/dashboard/SocialMediaAnalysis";
import { SocialSentimentTimeline } from "@/components/dashboard/SocialSentimentTimeline";
import { SocialTrendsSummary } from "@/components/dashboard/SocialTrendsSummary";
import { SocialPlatformComparison } from "@/components/dashboard/SocialPlatformComparison";
import { useSentimentData } from "@/hooks/useSentimentData";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";

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
  const [startTrackingDate, setStartTrackingDate] = useState<Date | undefined>(undefined);
  const { settings: userSettings, loading: settingsLoading } = useUserSettings();
  const { 
    sentimentOverTime, 
    publicationTimeline, 
    sentimentDistribution, 
    loading: sentimentLoading 
  } = useSentimentData(userSettings.activeCountry, userSettings.activeCompetitors, startTrackingDate);
  const isMobile = useIsMobile();

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
    
    const fetchStartTrackingDate = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (!userSettings.activeCountry) {
        console.log('No active country set yet, skipping start tracking date fetch');
        return;
      }

      console.log('Fetching start tracking date for country:', userSettings.activeCountry);

      // Get the baseline's start_date as the start tracking date (same as shown in top row)
      const { data: baseline } = await supabase
        .from('baselines')
        .select('start_date')
        .eq('created_by', user.id)
        .eq('tracking_country', userSettings.activeCountry)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (baseline?.start_date) {
        console.log('Setting start tracking date to:', baseline.start_date);
        setStartTrackingDate(new Date(baseline.start_date));
      } else {
        console.log('No baseline found for this country');
      }
    };
    
    fetchLastUpdate();
    fetchBaseline();
    fetchStartTrackingDate();

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
  }, [userSettings.activeCountry]);
  if (authLoading || !user) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>;
  }
  return <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-3">
          <div className="flex items-center justify-between gap-2">
            {/* Mobile Layout */}
            {isMobile ? (
              <>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-3xl leading-none flex-shrink-0">{userSettings.countryFlag}</span>
                  <div className="flex flex-col items-start gap-0.5 min-w-0 flex-1">
                    <h1 className="text-sm font-bold text-foreground text-left truncate w-full">
                      {userSettings.countryName} Analysis
                    </h1>
                    <div className="flex items-center gap-1 flex-wrap text-left">
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <div className="h-1.5 w-1.5 bg-primary rounded-full animate-pulse" />
                        Live
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {isAdmin && <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)} className="h-7 w-7 p-0">
                      <Settings className="h-3.5 w-3.5" />
                    </Button>}
                  <Button variant="outline" size="sm" onClick={signOut} title="Sign Out" className="h-7 w-7 p-0">
                    <LogOut className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </>
            ) : (
              /* Desktop Layout */
              <>
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
              </>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-2 sm:px-4 py-3 sm:py-6">
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

        {/* Media Monitoring - Prioritized at top */}
        <div className="mb-4 sm:mb-6">
          <Tabs defaultValue="articles" className="w-full">
            <TabsList className={isMobile ? "grid w-full grid-cols-2" : "grid w-full grid-cols-4"}>
              <TabsTrigger value="articles" className={isMobile ? "text-xs" : ""}>
                {isMobile ? "Articles" : "Media Articles"}
              </TabsTrigger>
              <TabsTrigger value="social" className={isMobile ? "text-xs" : ""}>
                {isMobile ? "Social" : "Social Feed"}
              </TabsTrigger>
              <TabsTrigger value="analysis" className={isMobile ? "text-xs" : ""}>
                {isMobile ? "Analysis" : "Social Analysis"}
              </TabsTrigger>
              <TabsTrigger value="trends" className={isMobile ? "text-xs" : ""}>
                {isMobile ? "Trends" : "Social Trends"}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="articles">
              <MediaArticlesList 
                activeCountry={userSettings.activeCountry}
                activeCompetitors={userSettings.activeCompetitors}
                prioritizedOutlets={userSettings.prioritizedOutlets}
                startTrackingDate={startTrackingDate}
              />
            </TabsContent>
            <TabsContent value="social">
              <SocialMediaFeed 
                activeCountry={userSettings.activeCountry}
                activeCompetitors={userSettings.activeCompetitors}
              />
            </TabsContent>
            <TabsContent value="analysis">
              <SocialMediaAnalysis 
                activeCountry={userSettings.activeCountry}
                activeCompetitors={userSettings.activeCompetitors}
              />
            </TabsContent>
            <TabsContent value="trends">
              <div className="space-y-6">
                <SocialTrendsSummary 
                  activeCountry={userSettings.activeCountry}
                  activeCompetitors={userSettings.activeCompetitors}
                />
                <SocialSentimentTimeline 
                  activeCountry={userSettings.activeCountry}
                  activeCompetitors={userSettings.activeCompetitors}
                  startTrackingDate={startTrackingDate}
                />
                <SocialPlatformComparison 
                  activeCountry={userSettings.activeCountry}
                  activeCompetitors={userSettings.activeCompetitors}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="mb-4 sm:mb-6">
          <SentimentOverTimeChart
            activeCompetitors={userSettings.activeCompetitors}
            data={sentimentOverTime}
          />
        </div>

        <div className="mb-4 sm:mb-6">
          <SentimentDistributionChart
            activeCompetitors={userSettings.activeCompetitors}
            sentimentData={sentimentDistribution}
          />
        </div>

        <div className="mb-4 sm:mb-6">
          <PublicationTimelineChart
            activeCompetitors={userSettings.activeCompetitors}
            data={publicationTimeline}
          />
        </div>

        <div className="mb-4 sm:mb-6">
          <SentimentTimeline activeCompetitors={userSettings.activeCompetitors} />
        </div>

        <div className="mb-4 sm:mb-6">
          <WinnerMetar activeCompetitors={userSettings.activeCompetitors} />
        </div>

        <div className="mb-4 sm:mb-6">
          <StrategicSuggestions activeCompetitors={userSettings.activeCompetitors} />
        </div>

        <div className="mb-4 sm:mb-6">
          <BlackHatAnalysis activeCompetitors={userSettings.activeCompetitors} activeCountry={userSettings.activeCountry} />
        </div>

        <div className="mb-4 sm:mb-6">
          <ResearchSources />
        </div>

        <div className="mb-4 sm:mb-6">
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