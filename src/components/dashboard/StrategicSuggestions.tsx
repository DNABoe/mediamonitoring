import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Lightbulb, Loader2, Newspaper, Users, Plane } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MessageSuggestion {
  message: string;
  messenger: string;
}

interface FighterSuggestions {
  media: MessageSuggestion[];
  politicians: MessageSuggestion[];
  airforce: MessageSuggestion[];
}

interface Suggestions {
  gripen: FighterSuggestions;
  [key: string]: FighterSuggestions;
}

interface StrategicSuggestionsProps {
  activeCompetitors: string[];
}

export const StrategicSuggestions = ({ activeCompetitors }: StrategicSuggestionsProps) => {
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
  const [loading, setLoading] = useState(false);

  const generateSuggestions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-strategic-suggestions');
      
      if (error) throw error;
      
      if (data?.suggestions) {
        setSuggestions(data.suggestions);
        toast.success('Strategic suggestions generated');
      }
    } catch (error) {
      console.error('Error generating suggestions:', error);
      toast.error('Failed to generate suggestions');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-primary" />
          <h3 className="text-xl font-bold">Strategic Messaging Suggestions</h3>
        </div>
        <Button
          onClick={generateSuggestions}
          disabled={loading}
          size="sm"
          variant="outline"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Lightbulb className="h-4 w-4 mr-2" />
              Generate AI Suggestions
            </>
          )}
        </Button>
      </div>

      {!suggestions && !loading && (
        <div className="text-center py-12 text-muted-foreground">
          <Lightbulb className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Click "Generate AI Suggestions" to get strategic messaging recommendations</p>
          <p className="text-sm mt-2">Based on current research analysis</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {suggestions && !loading && (
        <Tabs defaultValue="gripen" className="w-full">
          <TabsList className={`grid w-full grid-cols-${activeCompetitors.length + 1}`}>
            <TabsTrigger value="gripen" className="text-success">
              Gripen
            </TabsTrigger>
            {activeCompetitors.map((competitor) => (
              <TabsTrigger key={competitor} value={competitor.toLowerCase()} className="text-destructive">
                {competitor}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="gripen" className="mt-6 space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Newspaper className="h-4 w-4" />
                <span>Media Strategy</span>
              </div>
              <div className="space-y-3 ml-6">
                {suggestions.gripen.media.map((suggestion, i) => (
                  <div key={i} className="flex flex-col gap-1 p-3 bg-muted/30 rounded-lg border border-border">
                    <div className="text-sm text-foreground flex gap-2">
                      <span className="text-success font-bold">•</span>
                      <span>{suggestion.message}</span>
                    </div>
                    <div className="text-xs text-muted-foreground ml-4 flex items-center gap-2">
                      <span className="font-semibold">Messenger:</span>
                      <span className="italic">{suggestion.messenger}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Users className="h-4 w-4" />
                <span>Political Engagement</span>
              </div>
              <div className="space-y-3 ml-6">
                {suggestions.gripen.politicians.map((suggestion, i) => (
                  <div key={i} className="flex flex-col gap-1 p-3 bg-muted/30 rounded-lg border border-border">
                    <div className="text-sm text-foreground flex gap-2">
                      <span className="text-success font-bold">•</span>
                      <span>{suggestion.message}</span>
                    </div>
                    <div className="text-xs text-muted-foreground ml-4 flex items-center gap-2">
                      <span className="font-semibold">Messenger:</span>
                      <span className="italic">{suggestion.messenger}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Plane className="h-4 w-4" />
                <span>Portuguese Air Force Messaging</span>
              </div>
              <div className="space-y-3 ml-6">
                {suggestions.gripen.airforce.map((suggestion, i) => (
                  <div key={i} className="flex flex-col gap-1 p-3 bg-muted/30 rounded-lg border border-border">
                    <div className="text-sm text-foreground flex gap-2">
                      <span className="text-success font-bold">•</span>
                      <span>{suggestion.message}</span>
                    </div>
                    <div className="text-xs text-muted-foreground ml-4 flex items-center gap-2">
                      <span className="font-semibold">Messenger:</span>
                      <span className="italic">{suggestion.messenger}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {activeCompetitors.map((competitor) => {
            const competitorKey = competitor.toLowerCase().replace('-', '');
            const competitorData = suggestions[competitorKey] || suggestions[competitor.toLowerCase()];
            
            if (!competitorData) return null;
            
            return (
              <TabsContent key={competitor} value={competitor.toLowerCase()} className="mt-6 space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Newspaper className="h-4 w-4" />
                    <span>Media Strategy</span>
                  </div>
                  <div className="space-y-3 ml-6">
                    {competitorData.media.map((suggestion, i) => (
                      <div key={i} className="flex flex-col gap-1 p-3 bg-muted/30 rounded-lg border border-border">
                        <div className="text-sm text-foreground flex gap-2">
                          <span className="text-destructive font-bold">•</span>
                          <span>{suggestion.message}</span>
                        </div>
                        <div className="text-xs text-muted-foreground ml-4 flex items-center gap-2">
                          <span className="font-semibold">Messenger:</span>
                          <span className="italic">{suggestion.messenger}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Users className="h-4 w-4" />
                    <span>Political Engagement</span>
                  </div>
                  <div className="space-y-3 ml-6">
                    {competitorData.politicians.map((suggestion, i) => (
                      <div key={i} className="flex flex-col gap-1 p-3 bg-muted/30 rounded-lg border border-border">
                        <div className="text-sm text-foreground flex gap-2">
                          <span className="text-destructive font-bold">•</span>
                          <span>{suggestion.message}</span>
                        </div>
                        <div className="text-xs text-muted-foreground ml-4 flex items-center gap-2">
                          <span className="font-semibold">Messenger:</span>
                          <span className="italic">{suggestion.messenger}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Plane className="h-4 w-4" />
                    <span>Portuguese Air Force Messaging</span>
                  </div>
                  <div className="space-y-3 ml-6">
                    {competitorData.airforce.map((suggestion, i) => (
                      <div key={i} className="flex flex-col gap-1 p-3 bg-muted/30 rounded-lg border border-border">
                        <div className="text-sm text-foreground flex gap-2">
                          <span className="text-destructive font-bold">•</span>
                          <span>{suggestion.message}</span>
                        </div>
                        <div className="text-xs text-muted-foreground ml-4 flex items-center gap-2">
                          <span className="font-semibold">Messenger:</span>
                          <span className="italic">{suggestion.messenger}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </Card>
  );
};