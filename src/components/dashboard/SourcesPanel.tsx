import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Database, Globe, Shield, Users, MessageSquare } from "lucide-react";

interface Source {
  id: string;
  name: string;
  type: string;
  country: string;
  credibility_tier: number;
  enabled: boolean;
}

export const SourcesPanel = () => {
  const [sources, setSources] = useState<Source[]>([]);
  const [sourceCounts, setSourceCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchSources = async () => {
      const { data } = await supabase
        .from('sources')
        .select('*')
        .eq('enabled', true)
        .order('credibility_tier', { ascending: false });

      if (data) {
        setSources(data);
        
        const counts: Record<string, number> = {};
        for (const source of data) {
          const { count } = await supabase
            .from('items')
            .select('*', { count: 'exact', head: true })
            .eq('source_id', source.id);
          
          counts[source.id] = count || 0;
        }
        setSourceCounts(counts);
      }
    };

    fetchSources();
  }, []);

  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'news': return <Globe className="h-4 w-4" />;
      case 'government': return <Shield className="h-4 w-4" />;
      case 'defense': return <Database className="h-4 w-4" />;
      case 'social': return <Users className="h-4 w-4" />;
      case 'comment': return <MessageSquare className="h-4 w-4" />;
      default: return <Globe className="h-4 w-4" />;
    }
  };

  const getCredibilityStars = (tier: number) => {
    return '⭐'.repeat(tier);
  };

  return (
    <Card className="p-6">
      <h3 className="text-xl font-bold mb-4">Sources</h3>

      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {sources.map((source) => (
          <div
            key={source.id}
            className="p-3 rounded-lg bg-secondary/50 border border-border hover:border-primary transition-all"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                {getSourceIcon(source.type)}
                <div>
                  <div className="font-semibold text-sm">{source.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {source.country} • {source.type}
                  </div>
                </div>
              </div>
              <Badge variant="outline" className="text-xs">
                {sourceCounts[source.id] || 0}
              </Badge>
            </div>
            <div className="text-xs">
              {getCredibilityStars(source.credibility_tier)}
            </div>
          </div>
        ))}

        {sources.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            <Database className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <div className="text-sm">No sources configured</div>
          </div>
        )}
      </div>
    </Card>
  );
};
