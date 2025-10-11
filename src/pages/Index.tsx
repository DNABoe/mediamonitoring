import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserSettings } from "@/hooks/useUserSettings";
import { WinnerMetar } from "@/components/dashboard/WinnerMetar";
import { BaselineGenerator } from "@/components/dashboard/BaselineGenerator";
import { SourceArticles } from "@/components/dashboard/SourceArticles";
import { ResearchExecutiveSummary } from "@/components/dashboard/ResearchExecutiveSummary";
import { ResearchDimensions } from "@/components/dashboard/ResearchDimensions";
import { SentimentTimeline } from "@/components/dashboard/SentimentTimeline";
import { ResearchControls } from "@/components/dashboard/ResearchControls";
import { ResearchSources } from "@/components/dashboard/ResearchSources";
import { StrategicSuggestions } from "@/components/dashboard/StrategicSuggestions";
import { ResearchChanges } from "@/components/dashboard/ResearchChanges";
import { SettingsDialog } from "@/components/dashboard/SettingsDialog";
import { BlackHatAnalysis } from "@/components/dashboard/BlackHatAnalysis";
import { Settings, LogOut, Plane } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExportPDF } from "@/components/dashboard/ExportPDF";

const Index = () => {
  const {
    user,
    isAdmin,
    loading: authLoading,
    signOut
  } = useAuth();
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [winnerScore, setWinnerScore] = useState({
    gripen: 0,
    f35: 0
  });
  const [baselineDate, setBaselineDate] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedCompetitor, setSelectedCompetitor] = useState<string>('');
  const { settings: userSettings, loading: settingsLoading } = useUserSettings();
  
  // Initialize selected competitor from user settings (first one)
  useEffect(() => {
    if (userSettings.activeCompetitors.length > 0) {
      setSelectedCompetitor(userSettings.activeCompetitors[0]);
    }
  }, [userSettings.activeCompetitors]);

  useEffect(() => {
    if (!authLoading && !user) {
      window.location.href = "/auth";
    }
  }, [user, authLoading]);
  useEffect(() => {
    const fetchScores = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch latest research report scores for this user
      const {
        data: report
      } = await supabase.from('research_reports').select('media_tonality, created_at').eq('user_id', user.id).order('report_date', {
        ascending: false
      }).limit(1).maybeSingle();
      if (report?.media_tonality) {
        const tonality = report.media_tonality as any;
        setWinnerScore({
          gripen: tonality.gripen_score || 0,
          f35: tonality.f35_score || 0
        });
        // Set last update to when the report was actually created
        if (report.created_at) {
          setLastUpdate(new Date(report.created_at));
        }
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
    fetchScores();
    fetchBaseline();

    // Refresh scores every 30 seconds (but don't update timestamp)
    const interval = setInterval(() => {
      fetchScores();
    }, 30000);
    const reportsChannel = supabase.channel('reports-changes').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'research_reports'
    }, () => fetchScores()).subscribe();
    const baselinesChannel = supabase.channel('baselines-changes').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'baselines'
    }, () => fetchBaseline()).subscribe();
    return () => {
      clearInterval(interval);
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
          <div className="flex items-center gap-3">
            <div className="relative">
              <Plane className="h-8 w-8 text-primary -rotate-45 scale-x-[-1]" />
              <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-primary rounded-full animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                <span className="text-2xl">{userSettings.countryFlag}</span>
                Fighter Program Media Analysis - {userSettings.countryName}
              </h1>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs text-muted-foreground">
                  Real-time intelligence dashboard • Competitors:
                </p>
                <button
                  className="px-2 py-0.5 text-xs font-medium rounded-md bg-primary/20 text-primary border border-primary/30 cursor-default"
                >
                  Gripen
                </button>
                <span className="text-xs text-muted-foreground">vs</span>
                {userSettings.activeCompetitors.map((competitor) => (
                  <button
                    key={competitor}
                    onClick={() => setSelectedCompetitor(competitor)}
                    className={`px-2 py-0.5 text-xs font-medium rounded-md transition-all ${
                      selectedCompetitor === competitor
                        ? 'bg-primary/20 text-primary border border-primary/30'
                        : 'bg-muted text-muted-foreground border border-border hover:bg-muted/80'
                    }`}
                  >
                    {competitor}
                  </button>
                ))}
                <span className="text-xs text-muted-foreground">
                  • Last updated: {lastUpdate.toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                  })} {lastUpdate.toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                  })}
                </span>
                {isAdmin && <span className="ml-2">
                    <BaselineGenerator currentDate={baselineDate} />
                  </span>}
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
          <ResearchChanges />
        </div>

        <div className="mb-6">
          <ResearchExecutiveSummary activeCompetitors={userSettings.activeCompetitors} />
        </div>

        <div className="mb-6">
          <SentimentTimeline selectedCompetitor={selectedCompetitor} />
        </div>

        <div className="mb-6">
          <ResearchDimensions />
        </div>

        <div className="mb-6">
          <WinnerMetar gripenScore={winnerScore.gripen} f35Score={winnerScore.f35} />
        </div>

        <div className="mb-6">
          <StrategicSuggestions />
        </div>

        <div className="mb-6">
          <BlackHatAnalysis />
        </div>

        <div className="mb-6">
          <ResearchSources />
        </div>

        <div className="mb-6">
          <SourceArticles />
        </div>
      </div>

      {isAdmin && <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} onSettingsSaved={() => window.location.reload()} />}
    </div>;
};
export default Index;