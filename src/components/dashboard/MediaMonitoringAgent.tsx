import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { formatDistanceToNow } from 'date-fns';
import { Activity, Clock, TrendingUp, AlertCircle } from 'lucide-react';

interface AgentActivity {
  id: string;
  activity_type: string;
  details: any;
  created_at: string;
}

export const MediaMonitoringAgent = () => {
  const [agentStatus, setAgentStatus] = useState<any>(null);
  const [recentActivity, setRecentActivity] = useState<AgentActivity[]>([]);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    fetchAgentStatus();
    fetchRecentActivity();

    // Set up realtime subscription for activity logs
    const channel = supabase
      .channel('agent-activity')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'agent_activity_log'
        },
        (payload) => {
          setRecentActivity(prev => [payload.new as AgentActivity, ...prev].slice(0, 5));
        }
      )
      .subscribe();

    // Refresh status every 30 seconds
    const interval = setInterval(fetchAgentStatus, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const fetchAgentStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('agent_status')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (data) {
      setAgentStatus(data);
      setIsActive(data.status === 'running');
    }
  };

  const fetchRecentActivity = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('agent_activity_log')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (data) {
      setRecentActivity(data);
    }
  };

  if (!agentStatus) {
    return null;
  }

  const getStatusColor = () => {
    if (agentStatus.status === 'running') return 'bg-green-500';
    if (agentStatus.status === 'error') return 'bg-red-500';
    return 'bg-yellow-500';
  };

  const getStatusText = () => {
    if (agentStatus.status === 'running') return 'Actively Monitoring';
    if (agentStatus.status === 'error') return 'Error - Check Logs';
    return 'Idle';
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        {/* Status Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Activity className="h-6 w-6 text-primary" />
              {isActive && (
                <span className={`absolute -top-1 -right-1 h-3 w-3 ${getStatusColor()} rounded-full animate-pulse`} />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-lg">Media Monitoring Agent</h3>
              <p className="text-sm text-muted-foreground">{getStatusText()}</p>
            </div>
          </div>
          <Badge variant={isActive ? "default" : "secondary"}>
            {agentStatus.update_frequency}
          </Badge>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Articles Collected</p>
            <p className="text-2xl font-bold">{agentStatus.articles_collected_total || 0}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Outlets Discovered</p>
            <p className="text-2xl font-bold">{agentStatus.outlets_discovered || 0}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Next Update</p>
            <p className="text-sm font-medium">
              {agentStatus.next_run_at ? (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(agentStatus.next_run_at), { addSuffix: true })}
                </span>
              ) : 'Scheduled'}
            </p>
          </div>
        </div>

        {/* Last Fetch Timestamp */}
        {agentStatus.last_articles_fetch && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            <span>
              Last updated: {formatDistanceToNow(new Date(agentStatus.last_articles_fetch), { addSuffix: true })}
            </span>
          </div>
        )}

        {/* Recent Activity */}
        {recentActivity.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <p className="text-sm font-medium">Recent Activity</p>
            <div className="space-y-2">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-2 text-xs">
                  <div className="min-w-[60px] text-muted-foreground">
                    {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                  </div>
                  <div className="flex-1">
                    <Badge variant="outline" className="text-xs">
                      {activity.activity_type}
                    </Badge>
                    {activity.details?.message && (
                      <p className="text-muted-foreground mt-1">{activity.details.message}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Display */}
        {agentStatus.last_error && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-md">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-destructive">Last Error</p>
              <p className="text-muted-foreground">{agentStatus.last_error}</p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};