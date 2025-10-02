import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, X, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const DashboardHeader = () => {
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fetchKeywords = async () => {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'keywords')
        .maybeSingle();

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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Tag className="h-4 w-4" />
          Keywords ({keywords.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Keywords</DialogTitle>
          <DialogDescription>
            Add or remove keywords to track across all sources
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Add new keyword..."
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
            />
            <Button onClick={addKeyword} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {keywords.map((keyword) => (
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
