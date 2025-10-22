import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, X, Calendar as CalendarIcon, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { ArticleFiltersState } from '@/hooks/useArticleFilters';
import { Checkbox } from '@/components/ui/checkbox';

interface ArticleFiltersProps {
  filters: ArticleFiltersState;
  onSearchChange: (text: string) => void;
  onDateRangeChange: (from: Date | null, to: Date | null) => void;
  onSentimentChange: (sentiment: ArticleFiltersState['sentiment']) => void;
  onSourceTypeChange: (sourceType: ArticleFiltersState['sourceType']) => void;
  onCompetitorsChange: (competitors: string[]) => void;
  onClearFilters: () => void;
  activeFilterCount: number;
  availableCompetitors: string[];
}

export const ArticleFilters = ({
  filters,
  onSearchChange,
  onDateRangeChange,
  onSentimentChange,
  onSourceTypeChange,
  onCompetitorsChange,
  onClearFilters,
  activeFilterCount,
  availableCompetitors
}: ArticleFiltersProps) => {
  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          <h3 className="font-semibold">Filters</h3>
          {activeFilterCount > 0 && (
            <Badge variant="secondary">{activeFilterCount} active</Badge>
          )}
        </div>
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={onClearFilters}>
            <X className="h-4 w-4 mr-2" />
            Clear All
          </Button>
        )}
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search articles by title or source..."
          value={filters.searchText}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Date Range */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Date Range</label>
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dateFrom ? format(filters.dateFrom, 'PP') : 'From'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={filters.dateFrom || undefined}
                  onSelect={(date) => onDateRangeChange(date || null, filters.dateTo)}
                />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dateTo ? format(filters.dateTo, 'PP') : 'To'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={filters.dateTo || undefined}
                  onSelect={(date) => onDateRangeChange(filters.dateFrom, date || null)}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Sentiment */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Sentiment</label>
          <Select value={filters.sentiment} onValueChange={onSentimentChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sentiment</SelectItem>
              <SelectItem value="positive">Positive</SelectItem>
              <SelectItem value="neutral">Neutral</SelectItem>
              <SelectItem value="negative">Negative</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Source Type */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Source Type</label>
          <Select value={filters.sourceType} onValueChange={onSourceTypeChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="local">Local Media</SelectItem>
              <SelectItem value="international">International Media</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Competitors */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Competitors</label>
          <div className="space-y-2 max-h-32 overflow-y-auto p-2 border rounded-md">
            {availableCompetitors.map(competitor => (
              <div key={competitor} className="flex items-center gap-2">
                <Checkbox
                  checked={filters.competitors.includes(competitor)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onCompetitorsChange([...filters.competitors, competitor]);
                    } else {
                      onCompetitorsChange(filters.competitors.filter(c => c !== competitor));
                    }
                  }}
                />
                <label className="text-sm">{competitor}</label>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Active Filters Display */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.searchText && (
            <Badge variant="secondary">
              Search: {filters.searchText}
              <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => onSearchChange('')} />
            </Badge>
          )}
          {(filters.dateFrom || filters.dateTo) && (
            <Badge variant="secondary">
              Date: {filters.dateFrom && format(filters.dateFrom, 'PP')} - {filters.dateTo && format(filters.dateTo, 'PP')}
              <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => onDateRangeChange(null, null)} />
            </Badge>
          )}
          {filters.sentiment !== 'all' && (
            <Badge variant="secondary">
              {filters.sentiment}
              <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => onSentimentChange('all')} />
            </Badge>
          )}
          {filters.competitors.map(comp => (
            <Badge key={comp} variant="secondary">
              {comp}
              <X 
                className="h-3 w-3 ml-1 cursor-pointer" 
                onClick={() => onCompetitorsChange(filters.competitors.filter(c => c !== comp))} 
              />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};