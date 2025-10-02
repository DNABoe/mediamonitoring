import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { HotnessMeter } from "@/components/dashboard/HotnessMeter";
import { WinnerMetar } from "@/components/dashboard/WinnerMetar";
import { LiveStream } from "@/components/dashboard/LiveStream";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { DynamicNarrativeSummaries } from "@/components/dashboard/DynamicNarrativeSummaries";
import { PoliticsHeatMap } from "@/components/dashboard/PoliticsHeatMap";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { BaselineGenerator } from "@/components/dashboard/BaselineGenerator";
import { ScraperControls } from "@/components/dashboard/ScraperControls";
import { SourcesPanel } from "@/components/dashboard/SourcesPanel";
import { SourceArticles } from "@/components/dashboard/SourceArticles";
import { Bell, Settings, LogOut, Plane } from "lucide-react";
import { Button } from "@/components/ui/button";

const Index = () => {
  const { user, isAdmin, loading: authLoading, signOut } = useAuth();
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [gripenHotness, setGripenHotness] = useState(0);
  const [f35Hotness, setF35Hotness] = useState(0);
  const [winnerScore, setWinnerScore] = useState({ gripen: 0, f35: 0 });
  const [activeAlerts, setActiveAlerts] = useState(0);
  const [baselineDate, setBaselineDate] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      window.location.href = "/auth";
    }
  }, [user, authLoading]);

  useEffect(() => {
    const fetchMetrics = async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const { data: metrics } = await supabase
        .from('metrics')
        .select('*')
        .eq('day', today)
        .order('created_at', { ascending: false });

      if (metrics) {
        const gripen = metrics.find(m => m.fighter === 'Gripen');
        const f35 = metrics.find(m => m.fighter === 'F-35');
        
        setGripenHotness(gripen?.hotness || 0);
        setF35Hotness(f35?.hotness || 0);
        
        setWinnerScore({
          gripen: gripen?.hotness || 0,
          f35: f35?.hotness || 0
        });
      }
    };

    const fetchAlerts = async () => {
      const { count } = await supabase
        .from('alerts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');
      
      setActiveAlerts(count || 0);
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

    fetchMetrics();
    fetchAlerts();
    fetchBaseline();

    const interval = setInterval(() => {
      setLastUpdate(new Date());
      fetchMetrics();
      fetchAlerts();
    }, 30000);

    const alertsChannel = supabase
      .channel('alerts-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'alerts' },
        () => fetchAlerts()
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
      supabase.removeChannel(alertsChannel);
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
                <ScraperControls />
                <BaselineGenerator />
                <DashboardHeader />
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              className="relative"
              onClick={() => window.location.href = '/alerts'}
            >
              <Bell className="h-4 w-4" />
              {activeAlerts > 0 && (
                <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {activeAlerts}
                </span>
              )}
            </Button>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <HotnessMeter fighter="Gripen" score={gripenHotness} trend="up" />
          <HotnessMeter fighter="F-35" score={f35Hotness} trend="down" />
        </div>

        <div className="mb-6">
          <WinnerMetar gripenScore={winnerScore.gripen} f35Score={winnerScore.f35} />
        </div>

        <div className="mb-6">
          <SourcesPanel />
        </div>

        <div className="mb-6">
          <SourceArticles />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2">
            <DynamicNarrativeSummaries />
          </div>
          <div>
            <AlertsPanel />
          </div>
        </div>

        <div className="mb-6">
          <PoliticsHeatMap />
        </div>

        <div className="mb-6">
          <LiveStream />
        </div>
      </div>
    </div>
  );
};

export default Index;
