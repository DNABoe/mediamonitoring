import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { WinnerMetar } from "@/components/dashboard/WinnerMetar";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { BaselineGenerator } from "@/components/dashboard/BaselineGenerator";
import { SourceArticles } from "@/components/dashboard/SourceArticles";
import { ResearchExecutiveSummary } from "@/components/dashboard/ResearchExecutiveSummary";
import { ResearchDimensions } from "@/components/dashboard/ResearchDimensions";
import { SentimentTimeline } from "@/components/dashboard/SentimentTimeline";
import { ResearchControls } from "@/components/dashboard/ResearchControls";
import { ResearchSources } from "@/components/dashboard/ResearchSources";
import { Settings, LogOut, Plane } from "lucide-react";
import { Button } from "@/components/ui/button";

const Index = () => {
  const { user, isAdmin, loading: authLoading, signOut } = useAuth();
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [winnerScore, setWinnerScore] = useState({ gripen: 0, f35: 0 });
  const [baselineDate, setBaselineDate] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      window.location.href = "/auth";
    }
  }, [user, authLoading]);

  useEffect(() => {
    const fetchScores = async () => {
      // Fetch latest research report scores
      const { data: report } = await supabase
        .from('research_reports')
        .select('media_tonality')
        .order('report_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (report?.media_tonality) {
        const tonality = report.media_tonality as any;
        setWinnerScore({
          gripen: tonality.gripen_score || 0,
          f35: tonality.f35_score || 0
        });
      }
    };

    const fetchBaseline = async () => {
      const { data } = await supabase
        .from('baselines')
        .select('start_date')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (data?.start_date) {
        setBaselineDate(data.start_date);
      }
    };

    fetchScores();
    fetchBaseline();

    const interval = setInterval(() => {
      setLastUpdate(new Date());
      fetchScores();
    }, 30000);

    const reportsChannel = supabase
      .channel('reports-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'research_reports' },
        () => fetchScores()
      )
      .subscribe();

    const baselinesChannel = supabase
      .channel('baselines-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'baselines' },
        () => fetchBaseline()
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(reportsChannel);
      supabase.removeChannel(baselinesChannel);
    };
  }, []);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Plane className="h-8 w-8 text-primary -rotate-45 scale-x-[-1]" />
              <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-primary rounded-full animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                Portuguese Fighter Program Monitor
              </h1>
              <p className="text-xs text-muted-foreground">
                Real-time intelligence dashboard • Last updated: {lastUpdate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })} {lastUpdate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                {baselineDate && (
                  <span className="ml-2 px-2 py-0.5 bg-primary/10 text-primary rounded">
                    Tracking from: {new Date(baselineDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <>
                <BaselineGenerator />
                <DashboardHeader />
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = '/settings'}
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={signOut}
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {isAdmin && (
          <div className="mb-6">
            <ResearchControls />
          </div>
        )}

        <div className="mb-6">
          <ResearchExecutiveSummary />
        </div>

        <div className="mb-6">
          <SentimentTimeline />
        </div>

        <div className="mb-6">
          <ResearchDimensions />
        </div>

        <div className="mb-6">
          <ResearchSources />
        </div>

        <div className="mb-6">
          <WinnerMetar gripenScore={winnerScore.gripen} f35Score={winnerScore.f35} />
        </div>

        <div className="mb-6">
          <SourceArticles />
        </div>
      </div>
    </div>
  );
};

export default Index;
