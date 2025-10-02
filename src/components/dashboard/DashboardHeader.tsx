import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";

export const DashboardHeader = () => {
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState("");

  useEffect(() => {
    const fetchKeywords = async () => {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'keywords')
        .single();

      if (data?.value) {
        setKeywords(data.value as string[]);
      }
    };

    fetchKeywords();
  }, []);

  const addKeyword = async () => {
    if (newKeyword.trim() && !keywords.includes(newKeyword.trim())) {
      const updated = [...keywords, newKeyword.trim()];
      setKeywords(updated);
      setNewKeyword("");
      
      await supabase
        .from('settings')
        .update({ value: updated })
        .eq('key', 'keywords');
    }
  };

  const removeKeyword = async (keyword: string) => {
    const updated = keywords.filter(k => k !== keyword);
    setKeywords(updated);
    
    await supabase
      .from('settings')
      .update({ value: updated })
      .eq('key', 'keywords');
  };

  return (
    <div className="mb-6 p-4 rounded-lg bg-card border border-border">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-sm font-semibold text-muted-foreground">Active Keywords:</span>
        {keywords.slice(0, 15).map((keyword) => (
          <Badge
            key={keyword}
            variant="secondary"
            className="gap-1 cursor-pointer hover:bg-secondary/80"
          >
            {keyword}
            <X
              className="h-3 w-3 hover:text-destructive"
              onClick={() => removeKeyword(keyword)}
            />
          </Badge>
        ))}
        {keywords.length > 15 && (
          <Badge variant="outline">+{keywords.length - 15} more</Badge>
        )}
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Add new keyword..."
          value={newKeyword}
          onChange={(e) => setNewKeyword(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
          className="max-w-xs"
        />
        <Button onClick={addKeyword} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>
    </div>
  );
};
