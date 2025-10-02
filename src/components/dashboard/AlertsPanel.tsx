import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Bell, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Alert {
  id: string;
  type: string;
  created_at: string;
  matched_text: string;
  severity: string;
  status: string;
}

export const AlertsPanel = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    const fetchAlerts = async () => {
      const { data } = await supabase
        .from('alerts')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(5);

      if (data) {
        setAlerts(data);
      }
    };

    fetchAlerts();

    const channel = supabase
      .channel('alerts-panel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'alerts' },
        () => fetchAlerts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      default: return 'outline';
    }
  };

  const getAlertIcon = (type: string) => {
    if (type === 'lockheed_signal') return '🏢';
    if (type === 'us_embassy') return '🏛️';
    if (type === 'gov_milestone') return '📋';
    return '📊';
  };

  const getAlertTitle = (type: string) => {
    if (type === 'lockheed_signal') return 'Lockheed In-Country Signal';
    if (type === 'us_embassy') return 'US Embassy Statement';
    if (type === 'gov_milestone') return 'Government Milestone';
    return 'Volume Spike';
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Active Alerts
        </h3>
        <Badge variant="destructive">{alerts.length}</Badge>
      </div>

      <div className="space-y-3">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="p-3 rounded-lg bg-secondary/50 border-l-4 border-accent"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">{getAlertIcon(alert.type)}</span>
                <div>
                  <div className="font-semibold text-sm">{getAlertTitle(alert.type)}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(alert.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
              <Badge variant={getSeverityColor(alert.severity)} className="text-xs">
                {alert.severity}
              </Badge>
            </div>
            {alert.matched_text && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {alert.matched_text}
              </p>
            )}
          </div>
        ))}

        {alerts.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <div className="text-sm">No active alerts</div>
          </div>
        )}
      </div>
    </Card>
  );
};
