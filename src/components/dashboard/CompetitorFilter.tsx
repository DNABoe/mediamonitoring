import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CompetitorFilterProps {
  availableCompetitors: string[];
  selectedCompetitors: string[];
  onSelectionChange: (selected: string[]) => void;
}

export const CompetitorFilter = ({ 
  availableCompetitors, 
  selectedCompetitors, 
  onSelectionChange 
}: CompetitorFilterProps) => {
  const [open, setOpen] = useState(false);

  const toggleCompetitor = (competitor: string) => {
    const newSelection = selectedCompetitors.includes(competitor)
      ? selectedCompetitors.filter(c => c !== competitor)
      : [...selectedCompetitors, competitor];
    
    // Ensure at least one competitor is selected
    if (newSelection.length > 0) {
      onSelectionChange(newSelection);
    }
  };

  const selectAll = () => {
    onSelectionChange(availableCompetitors);
  };

  if (availableCompetitors.length <= 1) {
    return null; // Don't show filter if there's only one or no competitors
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="h-4 w-4" />
          Competitors
          <Badge variant="secondary" className="ml-1">
            {selectedCompetitors.length}/{availableCompetitors.length}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">Filter Competitors</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={selectAll}
              className="h-auto py-1 px-2 text-xs"
            >
              Select All
            </Button>
          </div>
          
          <div className="space-y-2">
            {availableCompetitors.map((competitor) => (
              <div key={competitor} className="flex items-center space-x-2">
                <Checkbox
                  id={`filter-${competitor}`}
                  checked={selectedCompetitors.includes(competitor)}
                  onCheckedChange={() => toggleCompetitor(competitor)}
                  disabled={selectedCompetitors.length === 1 && selectedCompetitors.includes(competitor)}
                />
                <Label
                  htmlFor={`filter-${competitor}`}
                  className="text-sm font-normal cursor-pointer flex-1"
                >
                  {competitor}
                </Label>
              </div>
            ))}
          </div>

          {selectedCompetitors.length === 1 && (
            <p className="text-xs text-muted-foreground">
              At least one competitor must be selected
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
