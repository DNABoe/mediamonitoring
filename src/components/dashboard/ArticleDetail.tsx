import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ExternalLink, Loader2, MessageSquare, TrendingUp, Award } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';

interface ArticleDetailProps {
  article: any;
  isOpen: boolean;
  onClose: () => void;
  competitors: string[];
}

export const ArticleDetail = ({ article, isOpen, onClose, competitors }: ArticleDetailProps) => {
  const [analysis, setAnalysis] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen && article) {
      fetchAnalysis();
    }
  }, [isOpen, article]);

  const fetchAnalysis = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('article_analyses')
      .select('*')
      .eq('article_id', article.id)
      .maybeSingle();

    setAnalysis(data);
    setIsLoading(false);
  };

  const analyzeArticle = async () => {
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-article', {
        body: { articleId: article.id, competitors }
      });

      if (error) throw error;

      setAnalysis(data.analysis);
      toast({
        title: "Analysis Complete",
        description: "Article has been analyzed successfully",
      });
    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: "Analysis Failed",
        description: "Could not analyze article. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getSentimentColor = (score: number) => {
    if (score > 0.3) return 'text-green-600';
    if (score < -0.3) return 'text-red-600';
    return 'text-gray-600';
  };

  const getSentimentLabel = (score: number) => {
    if (score > 0.3) return 'Positive';
    if (score < -0.3) return 'Negative';
    return 'Neutral';
  };

  const getToneColor = (tone: string) => {
    switch (tone) {
      case 'promotional': return 'bg-purple-100 text-purple-800';
      case 'critical': return 'bg-red-100 text-red-800';
      case 'opinion': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl pr-8">
            {article?.title_en || article?.title_pt}
          </DialogTitle>
          <div className="flex items-center gap-4 pt-2">
            <Badge variant="outline">{article?.source_country || 'Unknown'}</Badge>
            <span className="text-sm text-muted-foreground">
              {format(new Date(article?.published_at), 'PPP')}
            </span>
            {article?.fighter_tags?.map((tag: string) => (
              <Badge key={tag} variant="secondary">{tag}</Badge>
            ))}
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Read Original Button */}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => window.open(article?.url, '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Read Original Article
          </Button>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !analysis ? (
            <div className="text-center py-8 space-y-4">
              <p className="text-muted-foreground">This article hasn't been analyzed yet</p>
              <Button onClick={analyzeArticle} disabled={isAnalyzing}>
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  'Analyze Now'
                )}
              </Button>
            </div>
          ) : (
            <>
              {/* Sentiment Breakdown */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Sentiment Analysis
                </h3>
                <div className="space-y-3">
                  {Object.entries(analysis.main_sentiment || {}).map(([fighter, score]: [string, any]) => (
                    <div key={fighter} className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">{fighter}</span>
                        <span className={`text-sm font-semibold ${getSentimentColor(score)}`}>
                          {getSentimentLabel(score)} ({(score * 100).toFixed(0)}%)
                        </span>
                      </div>
                      <Progress 
                        value={((score + 1) / 2) * 100} 
                        className="h-2"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Tone & Influence */}
              <div className="flex gap-4">
                <div className="flex-1 space-y-2">
                  <h4 className="text-sm font-semibold">Article Tone</h4>
                  <Badge className={getToneColor(analysis.article_tone)}>
                    {analysis.article_tone || 'factual'}
                  </Badge>
                </div>
                <div className="flex-1 space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    Influence Score
                  </h4>
                  <div className="flex items-center gap-2">
                    <Progress value={(analysis.influence_score / 10) * 100} className="flex-1" />
                    <span className="text-sm font-bold">{analysis.influence_score}/10</span>
                  </div>
                </div>
              </div>

              {/* Key Points */}
              {analysis.key_points && analysis.key_points.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Key Points
                  </h3>
                  <ul className="space-y-2">
                    {analysis.key_points.map((point: string, idx: number) => (
                      <li key={idx} className="flex gap-2">
                        <span className="text-primary font-bold">•</span>
                        <span className="text-sm">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Extracted Quotes */}
              {analysis.extracted_quotes && analysis.extracted_quotes.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold">Notable Quotes</h3>
                  {analysis.extracted_quotes.map((quoteObj: any, idx: number) => (
                    <blockquote key={idx} className="border-l-4 border-primary pl-4 py-2 bg-muted/30">
                      <p className="text-sm italic">"{quoteObj.quote}"</p>
                      {quoteObj.context && (
                        <footer className="text-xs text-muted-foreground mt-1">
                          — {quoteObj.context}
                        </footer>
                      )}
                    </blockquote>
                  ))}
                </div>
              )}

              {/* Narrative Themes */}
              {analysis.narrative_themes && analysis.narrative_themes.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold">Narrative Themes</h3>
                  <div className="flex flex-wrap gap-2">
                    {analysis.narrative_themes.map((theme: string, idx: number) => (
                      <Badge key={idx} variant="outline">{theme}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};