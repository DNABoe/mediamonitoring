import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlayCircle, PauseCircle, RefreshCw, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface AgentStatus {
  id: string;
  user_id: string;
  active_country: string;
  active_competitors: string[];
  status: 'running' | 'paused' | 'stopped';
  last_run_at: string | null;
  next_run_at: string | null;
  articles_collected_total: number;
  outlets_discovered: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

interface AgentStatusPanelProps {
  activeCountry: string;
  activeCompetitors: string[];
}

export const AgentStatusPanel = ({ activeCountry, activeCompetitors }: AgentStatusPanelProps) => {
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const { toast } = useToast();

  const fetchAgentStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('agent_status')
        .select('*')
        .eq('user_id', user.id)
        .eq('active_country', activeCountry)
        .maybeSingle();

      if (error) throw error;
      setAgentStatus(data as AgentStatus | null);
    } catch (error) {
      console.error('Error fetching agent status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgentStatus();

    // Set up realtime subscription
    const channel = supabase
      .channel('agent-status-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agent_status',
          filter: `active_country=eq.${activeCountry}`,
        },
        () => {
          fetchAgentStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeCountry]);

  const handlePauseResume = async () => {
    if (!agentStatus) return;
    setActionLoading(true);

    try {
      const newStatus = agentStatus.status === 'running' ? 'paused' : 'running';
      
      const { error } = await supabase
        .from('agent_status')
        .update({ 
          status: newStatus,
          next_run_at: newStatus === 'running' 
            ? new Date(Date.now() + 5 * 60 * 1000).toISOString() // Run in 5 minutes
            : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', agentStatus.id);

      if (error) throw error;

      toast({
        title: newStatus === 'running' ? 'Agent resumed' : 'Agent paused',
        description: newStatus === 'running' 
          ? 'News monitoring will resume shortly'
          : 'News monitoring is paused',
      });

      fetchAgentStatus();
    } catch (error) {
      console.error('Error updating agent:', error);
      toast({
        title: "Error",
        description: "Failed to update agent status",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRunNow = async () => {
    if (!agentStatus) return;
    setActionLoading(true);

    try {
      const { error } = await supabase.functions.invoke('agent-monitor-news');

      if (error) throw error;

      toast({
        title: "Agent triggered",
        description: "News collection started",
      });

      fetchAgentStatus();
    } catch (error) {
      console.error('Error triggering agent:', error);
      toast({
        title: "Error",
        description: "Failed to trigger news collection",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!agentStatus || !confirm('This will delete all collected data and stop the agent. Continue?')) return;
    setActionLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.rpc('stop_agent_and_cleanup', {
        _user_id: user.id,
        _country: activeCountry,
      });

      if (error) throw error;

      toast({
        title: "Data deleted",
        description: "All data cleared and agent stopped",
      });

      fetchAgentStatus();
    } catch (error) {
      console.error('Error deleting data:', error);
      toast({
        title: "Error",
        description: "Failed to delete data",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </Card>
    );
  }

  if (!agentStatus) {
    return null;
  }

  const getStatusBadge = () => {
    switch (agentStatus.status) {
      case 'running':
        return <Badge className="bg-green-500">🟢 Active</Badge>;
      case 'paused':
        return <Badge className="bg-yellow-500">⏸️ Paused</Badge>;
      case 'stopped':
        return <Badge variant="secondary">⏹️ Stopped</Badge>;
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">AI News Agent</h3>
          {getStatusBadge()}
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Last check</p>
            <p className="font-medium">
              {agentStatus.last_run_at 
                ? formatDistanceToNow(new Date(agentStatus.last_run_at), { addSuffix: true })
                : 'Never'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Next check</p>
            <p className="font-medium">
              {agentStatus.next_run_at && agentStatus.status === 'running'
                ? formatDistanceToNow(new Date(agentStatus.next_run_at), { addSuffix: true })
                : '-'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Articles collected</p>
            <p className="font-medium">{agentStatus.articles_collected_total}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Outlets monitored</p>
            <p className="font-medium">{agentStatus.outlets_discovered}</p>
          </div>
        </div>

        {agentStatus.last_error && (
          <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
            <p className="font-medium">Last error:</p>
            <p>{agentStatus.last_error}</p>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handlePauseResume}
            disabled={actionLoading || agentStatus.status === 'stopped'}
            variant="outline"
            size="sm"
          >
            {actionLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : agentStatus.status === 'running' ? (
              <>
                <PauseCircle className="h-4 w-4 mr-2" />
                Pause
              </>
            ) : (
              <>
                <PlayCircle className="h-4 w-4 mr-2" />
                Resume
              </>
            )}
          </Button>

          <Button
            onClick={handleRunNow}
            disabled={actionLoading || agentStatus.status !== 'running'}
            variant="outline"
            size="sm"
          >
            {actionLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Run Now
              </>
            )}
          </Button>

          <Button
            onClick={handleDeleteAll}
            disabled={actionLoading}
            variant="destructive"
            size="sm"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete All Data
          </Button>
        </div>
      </div>
    </Card>
  );
};
