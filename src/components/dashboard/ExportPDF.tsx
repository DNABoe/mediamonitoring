import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, FileText, Printer } from "lucide-react";
import { Document, Page, Text, View, StyleSheet, pdf, Svg, Line, Rect, Circle } from "@react-pdf/renderer";
import { Document as DocxDocument, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, Table, TableRow, TableCell, WidthType } from "docx";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    backgroundColor: '#ffffff',
    color: '#1e293b',
    fontFamily: 'Helvetica',
    fontSize: 10,
  },
  header: {
    marginBottom: 20,
    borderBottom: '3px solid #3b82f6',
    paddingBottom: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 10,
    color: '#64748b',
    marginBottom: 3,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 10,
    paddingBottom: 5,
    borderBottom: '2px solid #e2e8f0',
  },
  subsectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#475569',
    marginBottom: 8,
    marginTop: 10,
  },
  text: {
    fontSize: 9,
    lineHeight: 1.5,
    color: '#334155',
    textAlign: 'justify',
  },
  scoreContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 12,
    gap: 10,
  },
  scoreBox: {
    flex: 1,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    border: '2px solid #e2e8f0',
  },
  scoreName: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#475569',
    marginBottom: 6,
  },
  scoreValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  metricRow: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingLeft: 8,
  },
  metricLabel: {
    fontSize: 9,
    color: '#64748b',
    width: '40%',
    fontWeight: 'bold',
  },
  metricValue: {
    fontSize: 9,
    color: '#334155',
    width: '60%',
  },
  table: {
    marginTop: 10,
    marginBottom: 10,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1px solid #e2e8f0',
    paddingVertical: 6,
  },
  tableHeader: {
    backgroundColor: '#f1f5f9',
    fontWeight: 'bold',
  },
  tableCell: {
    fontSize: 8,
    padding: 4,
    flex: 1,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#94a3b8',
    borderTop: '1px solid #e2e8f0',
    paddingTop: 8,
  },
  pageNumber: {
    position: 'absolute',
    bottom: 20,
    right: 40,
    fontSize: 8,
    color: '#94a3b8',
  },
  changeItem: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingLeft: 10,
  },
  changeIcon: {
    fontSize: 10,
    marginRight: 6,
    fontWeight: 'bold',
  },
  changeText: {
    fontSize: 9,
    flex: 1,
    lineHeight: 1.4,
  },
  chartContainer: {
    marginTop: 15,
    marginBottom: 15,
    padding: 15,
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    height: 180,
  },
  chartTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#475569',
  },
  chart: {
    height: 150,
    marginTop: 10,
  },
  suggestionItem: {
    marginBottom: 10,
    paddingLeft: 15,
  },
  suggestionText: {
    fontSize: 9,
    lineHeight: 1.4,
    marginBottom: 3,
  },
  suggestionMessenger: {
    fontSize: 8,
    color: '#64748b',
    fontStyle: 'italic',
    marginLeft: 10,
  },
});

interface PDFDocumentProps {
  data: any;
}

// Simple line chart component using react-pdf SVG primitives
const LineChart = ({ data, dataKey1, dataKey2, label1, label2, color1, color2, yMin, yMax }: any) => {
  const width = 480;
  const height = 150;
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  if (!data || data.length === 0) return null;

  // Get values and calculate range
  const values1 = data.map((d: any) => parseFloat(d[dataKey1]) || 0);
  const values2 = data.map((d: any) => parseFloat(d[dataKey2]) || 0);
  const minValue = yMin ?? Math.min(...values1, ...values2);
  const maxValue = yMax ?? Math.max(...values1, ...values2);
  const valueRange = maxValue - minValue || 1;

  // Helper functions
  const getY = (value: number) => {
    return padding.top + chartHeight - ((value - minValue) / valueRange) * chartHeight;
  };

  const getX = (index: number) => {
    return padding.left + (index / Math.max(data.length - 1, 1)) * chartWidth;
  };

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* Background */}
      <Rect
        x={padding.left}
        y={padding.top}
        width={chartWidth}
        height={chartHeight}
        fill="#f8fafc"
      />

      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const y = padding.top + chartHeight * ratio;
        return (
          <Line
            key={ratio}
            x1={padding.left}
            y1={y}
            x2={padding.left + chartWidth}
            y2={y}
            stroke="#e2e8f0"
            strokeWidth={1}
          />
        );
      })}

      {/* Y-axis labels */}
      {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
        const value = maxValue - (valueRange * ratio);
        const y = padding.top + chartHeight * ratio;
        return (
          <Text
            key={i}
            x={padding.left - 10}
            y={y}
            style={{ fontSize: 8, fill: '#64748b', textAnchor: 'end' }}
          >
            {value.toFixed(1)}
          </Text>
        );
      })}

      {/* Line 1 */}
      {values1.map((value, index) => {
        if (index === 0) return null;
        const x1 = getX(index - 1);
        const y1 = getY(values1[index - 1]);
        const x2 = getX(index);
        const y2 = getY(value);
        return (
          <Line
            key={`line1-${index}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={color1}
            strokeWidth={2}
          />
        );
      })}

      {/* Line 2 */}
      {values2.map((value, index) => {
        if (index === 0) return null;
        const x1 = getX(index - 1);
        const y1 = getY(values2[index - 1]);
        const x2 = getX(index);
        const y2 = getY(value);
        return (
          <Line
            key={`line2-${index}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={color2}
            strokeWidth={2}
          />
        );
      })}

      {/* Data points */}
      {values1.map((value, index) => (
        <Circle
          key={`point1-${index}`}
          cx={getX(index)}
          cy={getY(value)}
          r={3}
          fill={color1}
        />
      ))}
      {values2.map((value, index) => (
        <Circle
          key={`point2-${index}`}
          cx={getX(index)}
          cy={getY(value)}
          r={3}
          fill={color2}
        />
      ))}

      {/* X-axis labels (show first, middle, last) */}
      {[0, Math.floor(data.length / 2), data.length - 1].map((index) => {
        if (index >= data.length) return null;
        const x = getX(index);
        return (
          <Text
            key={`xlabel-${index}`}
            x={x}
            y={height - 5}
            style={{ fontSize: 8, fill: '#64748b', textAnchor: 'middle' }}
          >
            {format(new Date(data[index].date), 'MMM yy')}
          </Text>
        );
      })}

      {/* Legend */}
      <Rect x={padding.left} y={5} width={15} height={3} fill={color1} />
      <Text x={padding.left + 20} y={8} style={{ fontSize: 8, fill: '#1e293b' }}>
        {label1}
      </Text>
      <Rect x={padding.left + 80} y={5} width={15} height={3} fill={color2} />
      <Text x={padding.left + 100} y={8} style={{ fontSize: 8, fill: '#1e293b' }}>
        {label2}
      </Text>
    </Svg>
  );
};

const PDFDocument = ({ data }: PDFDocumentProps) => {
  const { report, metrics, previousReport, settings, suggestions } = data;
  
  // Process metrics for chart representation
  const processMetrics = () => {
    if (!metrics || metrics.length === 0) return null;
    
    const monthMap = new Map();
    metrics.forEach((metric: any) => {
      const date = new Date(metric.metric_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, { 
          date: monthKey,
          gripenMentions: 0,
          f35Mentions: 0,
          gripenSentimentSum: 0,
          f35SentimentSum: 0,
          gripenCount: 0,
          f35Count: 0
        });
      }
      
      const entry = monthMap.get(monthKey);
      if (metric.fighter === 'Gripen') {
        entry.gripenMentions += metric.mentions_count;
        entry.gripenSentimentSum += metric.sentiment_score;
        entry.gripenCount += 1;
      } else {
        entry.f35Mentions += metric.mentions_count;
        entry.f35SentimentSum += metric.sentiment_score;
        entry.f35Count += 1;
      }
    });

    return Array.from(monthMap.values()).map(entry => ({
      date: entry.date,
      gripenMentions: entry.gripenMentions,
      f35Mentions: entry.f35Mentions,
      gripenSentiment: entry.gripenCount > 0 ? (entry.gripenSentimentSum / entry.gripenCount).toFixed(2) : '0.00',
      f35Sentiment: entry.f35Count > 0 ? (entry.f35SentimentSum / entry.f35Count).toFixed(2) : '0.00'
    })).sort((a, b) => a.date.localeCompare(b.date));
  };

  // Calculate changes from previous report
  const calculateChanges = () => {
    if (!previousReport) return null;
    
    const changes: any[] = [];
    const latestTonality = report.media_tonality as any;
    const prevTonality = previousReport.media_tonality as any;

    if (latestTonality?.gripen_score && prevTonality?.gripen_score) {
      const diff = latestTonality.gripen_score - prevTonality.gripen_score;
      if (Math.abs(diff) > 2) {
        changes.push({
          type: diff > 0 ? 'increase' : 'decrease',
          text: `Gripen Overall Score ${diff > 0 ? 'increased' : 'decreased'} by ${Math.abs(diff).toFixed(1)} points`
        });
      }
    }

    if (latestTonality?.f35_score && prevTonality?.f35_score) {
      const diff = latestTonality.f35_score - prevTonality.f35_score;
      if (Math.abs(diff) > 2) {
        changes.push({
          type: diff > 0 ? 'increase' : 'decrease',
          text: `F-35 Overall Score ${diff > 0 ? 'increased' : 'decreased'} by ${Math.abs(diff).toFixed(1)} points`
        });
      }
    }

    return changes;
  };

  const chartData = processMetrics();
  const changes = calculateChanges();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Portuguese Fighter Program Monitor</Text>
          <Text style={styles.subtitle}>Intelligence Report</Text>
          <Text style={styles.subtitle}>
            Generated: {new Date(report.created_at).toLocaleDateString('en-GB')} {new Date(report.created_at).toLocaleTimeString('en-GB', { hour12: false })}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Executive Summary</Text>
          <Text style={styles.text}>{report.executive_summary || 'No summary available'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overall Scores</Text>
          <View style={styles.scoreContainer}>
            <View style={styles.scoreBox}>
              <Text style={styles.scoreName}>Saab Gripen</Text>
              <Text style={styles.scoreValue}>{((report.media_tonality?.gripen_score || 0) * 100).toFixed(1)}%</Text>
            </View>
            <View style={styles.scoreBox}>
              <Text style={styles.scoreName}>F-35</Text>
              <Text style={styles.scoreValue}>{((report.media_tonality?.f35_score || 0) * 100).toFixed(1)}%</Text>
            </View>
          </View>
        </View>

        {changes && changes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Key Changes Since Last Report</Text>
            {changes.map((change: any, index: number) => (
              <View key={index} style={styles.changeItem}>
                <Text style={[styles.changeIcon, { color: change.type === 'increase' ? '#10b981' : '#ef4444' }]}>
                  {change.type === 'increase' ? '↑' : '↓'}
                </Text>
                <Text style={styles.changeText}>{change.text}</Text>
              </View>
            ))}
          </View>
        )}


        <Text style={styles.footer}>
          Portuguese Fighter Program Monitor • Page 1
        </Text>
      </Page>

      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Media Sentiment Analysis</Text>
          
          <Text style={styles.subsectionTitle}>Gripen Media Presence</Text>
          {report.media_tonality?.gripen && (
            <>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Sentiment Score:</Text>
                <Text style={styles.metricValue}>
                  {report.media_tonality.gripen.sentiment_score?.toFixed(2) || 'N/A'}
                </Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Mentions:</Text>
                <Text style={styles.metricValue}>
                  {report.media_tonality.gripen.mentions || 0}
                </Text>
              </View>
              <Text style={[styles.text, { marginTop: 8 }]}>
                {report.media_tonality.gripen.summary || 'No summary available'}
              </Text>
            </>
          )}

          <Text style={styles.subsectionTitle}>F-35 Media Presence</Text>
          {report.media_tonality?.f35 && (
            <>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Sentiment Score:</Text>
                <Text style={styles.metricValue}>
                  {report.media_tonality.f35.sentiment_score?.toFixed(2) || 'N/A'}
                </Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Mentions:</Text>
                <Text style={styles.metricValue}>
                  {report.media_tonality.f35.mentions || 0}
                </Text>
              </View>
              <Text style={[styles.text, { marginTop: 8 }]}>
                {report.media_tonality.f35.summary || 'No summary available'}
              </Text>
            </>
          )}
        </View>

        {chartData && chartData.length > 0 && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Media Sentiment Trends</Text>
              <Text style={[styles.text, { marginBottom: 10 }]}>
                Monthly sentiment scores tracking how media coverage has evolved over time (range: -1 to +1).
              </Text>
              <View style={styles.chartContainer}>
                <LineChart
                  data={chartData}
                  dataKey1="gripenSentiment"
                  dataKey2="f35Sentiment"
                  label1="Gripen"
                  label2="F-35"
                  color1="#10b981"
                  color2="#3b82f6"
                  yMin={-1}
                  yMax={1}
                />
              </View>
              
              <Text style={styles.subsectionTitle}>Platform-Specific Analysis</Text>
              <Text style={[styles.text, { marginBottom: 8 }]}>
                The sentiment trends reveal distinct platform narratives across Portuguese media:
              </Text>
              <Text style={[styles.text, { marginBottom: 5 }]}>
                • News outlets (Público, Observador, DN) tend to frame the F-35 within NATO standardization and alliance credibility contexts, often with neutral-to-positive tonality, while presenting Gripen through fiscal responsibility and industrial cooperation lenses.
              </Text>
              <Text style={[styles.text, { marginBottom: 5 }]}>
                • Business media (Jornal de Negócios, Expresso) emphasize lifecycle costs and offset opportunities, typically showing more favorable sentiment toward Gripen when discussing economic impact, and F-35 skepticism during budget debates.
              </Text>
              <Text style={[styles.text, { marginBottom: 5 }]}>
                • Defense-focused platforms and international sources cited locally maintain more balanced technical coverage, with sentiment fluctuating based on capability demonstrations, procurement delays, or sustainment cost revelations.
              </Text>
              <Text style={styles.text}>
                • Social media and opinion pieces reflect polarized views, with pro-Gripen sentiment stronger among sovereignty and cost-conscious commentators, while pro-F-35 sentiment prevails in strategic and interoperability discussions.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Media Mentions Over Time</Text>
              <Text style={[styles.text, { marginBottom: 10 }]}>
                Total number of media mentions per month in Portuguese media sources.
              </Text>
              <View style={styles.chartContainer}>
                <LineChart
                  data={chartData}
                  dataKey1="gripenMentions"
                  dataKey2="f35Mentions"
                  label1="Gripen"
                  label2="F-35"
                  color1="#10b981"
                  color2="#3b82f6"
                />
              </View>
            </View>
          </>
        )}

        <Text style={styles.footer}>
          Portuguese Fighter Program Monitor • Page 2
        </Text>
      </Page>

      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Capability Analysis</Text>
          <Text style={styles.text}>{report.capability_analysis || 'No analysis available'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cost Analysis</Text>
          <Text style={styles.text}>{report.cost_analysis || 'No analysis available'}</Text>
        </View>

        <Text style={styles.footer}>
          Portuguese Fighter Program Monitor • Page 3
        </Text>
      </Page>

      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Political Analysis</Text>
          <Text style={styles.text}>{report.political_analysis || 'No analysis available'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Industrial Cooperation</Text>
          <Text style={styles.text}>{report.industrial_cooperation || 'No analysis available'}</Text>
        </View>

        <Text style={styles.footer}>
          Portuguese Fighter Program Monitor • Page 4
        </Text>
      </Page>

      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Geopolitical Analysis</Text>
          <Text style={styles.text}>{report.geopolitical_analysis || 'No analysis available'}</Text>
        </View>

        {report.media_tonality?.dimension_scores && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dimensional Scores Breakdown</Text>
            <Text style={[styles.text, { marginBottom: 10 }]}>
              Scores across key evaluation dimensions (scale: 0-10):
            </Text>
            
            {report.media_tonality.dimension_scores.gripen && (
              <>
                <Text style={styles.subsectionTitle}>Gripen Scores</Text>
                {Object.entries(report.media_tonality.dimension_scores.gripen).map(([key, value]: [string, any]) => (
                  <View key={key} style={styles.metricRow}>
                    <Text style={styles.metricLabel}>{key.charAt(0).toUpperCase() + key.slice(1)}:</Text>
                    <Text style={styles.metricValue}>{value?.toFixed(1) || 'N/A'}</Text>
                  </View>
                ))}
              </>
            )}
            
            {report.media_tonality.dimension_scores.f35 && (
              <>
                <Text style={styles.subsectionTitle}>F-35 Scores</Text>
                {Object.entries(report.media_tonality.dimension_scores.f35).map(([key, value]: [string, any]) => (
                  <View key={key} style={styles.metricRow}>
                    <Text style={styles.metricLabel}>{key.charAt(0).toUpperCase() + key.slice(1)}:</Text>
                    <Text style={styles.metricValue}>{value?.toFixed(1) || 'N/A'}</Text>
                  </View>
                ))}
              </>
            )}
          </View>
        )}

        <Text style={styles.footer}>
          Portuguese Fighter Program Monitor • Page 5
        </Text>
      </Page>

      {suggestions && (
        <Page size="A4" style={styles.page}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Strategic Messaging Suggestions</Text>
            <Text style={[styles.text, { marginBottom: 15 }]}>
              AI-generated strategic messaging recommendations based on current analysis.
            </Text>

            <Text style={styles.subsectionTitle}>Gripen Campaign Strategy</Text>
            
            <Text style={[styles.text, { fontWeight: 'bold', marginTop: 10, marginBottom: 5 }]}>Media Strategy:</Text>
            {suggestions.gripen?.media?.map((item: any, i: number) => (
              <View key={i} style={styles.suggestionItem}>
                <Text style={styles.suggestionText}>• {item.message}</Text>
                <Text style={styles.suggestionMessenger}>Messenger: {item.messenger}</Text>
              </View>
            ))}

            <Text style={[styles.text, { fontWeight: 'bold', marginTop: 10, marginBottom: 5 }]}>Political Engagement:</Text>
            {suggestions.gripen?.politicians?.map((item: any, i: number) => (
              <View key={i} style={styles.suggestionItem}>
                <Text style={styles.suggestionText}>• {item.message}</Text>
                <Text style={styles.suggestionMessenger}>Messenger: {item.messenger}</Text>
              </View>
            ))}

            <Text style={[styles.text, { fontWeight: 'bold', marginTop: 10, marginBottom: 5 }]}>Air Force Messaging:</Text>
            {suggestions.gripen?.airforce?.map((item: any, i: number) => (
              <View key={i} style={styles.suggestionItem}>
                <Text style={styles.suggestionText}>• {item.message}</Text>
                <Text style={styles.suggestionMessenger}>Messenger: {item.messenger}</Text>
              </View>
            ))}

            <Text style={[styles.subsectionTitle, { marginTop: 20 }]}>F-35 Campaign Strategy</Text>
            
            <Text style={[styles.text, { fontWeight: 'bold', marginTop: 10, marginBottom: 5 }]}>Media Strategy:</Text>
            {suggestions.f35?.media?.map((item: any, i: number) => (
              <View key={i} style={styles.suggestionItem}>
                <Text style={styles.suggestionText}>• {item.message}</Text>
                <Text style={styles.suggestionMessenger}>Messenger: {item.messenger}</Text>
              </View>
            ))}

            <Text style={[styles.text, { fontWeight: 'bold', marginTop: 10, marginBottom: 5 }]}>Political Engagement:</Text>
            {suggestions.f35?.politicians?.map((item: any, i: number) => (
              <View key={i} style={styles.suggestionItem}>
                <Text style={styles.suggestionText}>• {item.message}</Text>
                <Text style={styles.suggestionMessenger}>Messenger: {item.messenger}</Text>
              </View>
            ))}

            <Text style={[styles.text, { fontWeight: 'bold', marginTop: 10, marginBottom: 5 }]}>Air Force Messaging:</Text>
            {suggestions.f35?.airforce?.map((item: any, i: number) => (
              <View key={i} style={styles.suggestionItem}>
                <Text style={styles.suggestionText}>• {item.message}</Text>
                <Text style={styles.suggestionMessenger}>Messenger: {item.messenger}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.footer}>
            Portuguese Fighter Program Monitor • Page 6
          </Text>
        </Page>
      )}
    </Document>
  );
};

export const ExportPDF = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchReportData = async () => {
    // Fetch latest report
    const { data: report } = await supabase
      .from('research_reports')
      .select('*')
      .order('report_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!report) {
      throw new Error("No report data available");
    }

    // Fetch sentiment timeline data (only public fields)
    const { data: baselineData } = await supabase
      .from('baselines')
      .select('start_date')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const startDate = baselineData?.start_date || new Date().toISOString().split('T')[0];

    const { data: metrics } = await supabase
      .from('comparison_metrics')
      .select('*')
      .gte('metric_date', startDate)
      .order('metric_date', { ascending: true });

    // Fetch previous report for changes
    const { data: reports } = await supabase
      .from('research_reports')
      .select('*')
      .order('report_date', { ascending: false })
      .limit(2);

    // Fetch settings/weights
    const { data: settings } = await supabase
      .from('settings')
      .select('*');

    // Fetch or generate strategic suggestions
    let suggestions = null;
    try {
      const { data: suggestionsData } = await supabase.functions.invoke('generate-strategic-suggestions');
      if (suggestionsData?.suggestions) {
        suggestions = suggestionsData.suggestions;
      }
    } catch (error) {
      console.error('Could not fetch strategic suggestions:', error);
    }

    return { 
      report, 
      metrics: metrics || [], 
      previousReport: reports?.[1] || null,
      settings: settings || [],
      suggestions
    };
  };

  const handleExportPDF = async () => {
    try {
      setLoading(true);
      toast.loading("Generating PDF report...");
      
      const data = await fetchReportData();

      const blob = await pdf(
        <PDFDocument data={data} />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `fighter-program-report-${new Date().toISOString().split('T')[0]}.pdf`;
      link.click();
      URL.revokeObjectURL(url);

      toast.dismiss();
      toast.success("PDF report generated successfully");
      setOpen(false);
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.dismiss();
      toast.error("Failed to generate PDF report");
    } finally {
      setLoading(false);
    }
  };

  const handleExportWord = async () => {
    try {
      setLoading(true);
      toast.loading("Generating Word document...");
      
      const data = await fetchReportData();
      const { report, metrics, previousReport, settings, suggestions } = data;

      // Process changes
      const changes: any[] = [];
      if (previousReport) {
        const latestTonality: any = report.media_tonality;
        const prevTonality: any = previousReport.media_tonality;

        if (latestTonality?.gripen_score && prevTonality?.gripen_score) {
          const diff = latestTonality.gripen_score - prevTonality.gripen_score;
          if (Math.abs(diff) > 2) {
            changes.push(`Gripen Overall Score ${diff > 0 ? 'increased' : 'decreased'} by ${Math.abs(diff).toFixed(1)} points`);
          }
        }

        if (latestTonality?.f35_score && prevTonality?.f35_score) {
          const diff = latestTonality.f35_score - prevTonality.f35_score;
          if (Math.abs(diff) > 2) {
            changes.push(`F-35 Overall Score ${diff > 0 ? 'increased' : 'decreased'} by ${Math.abs(diff).toFixed(1)} points`);
          }
        }
      }

      // Process metrics for table
      const chartData: any[] = [];
      if (metrics && metrics.length > 0) {
        const monthMap = new Map();
        metrics.forEach((metric: any) => {
          const date = new Date(metric.metric_date);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          
          if (!monthMap.has(monthKey)) {
            monthMap.set(monthKey, { 
              date: monthKey,
              gripenMentions: 0,
              f35Mentions: 0,
              gripenSentimentSum: 0,
              f35SentimentSum: 0,
              gripenCount: 0,
              f35Count: 0
            });
          }
          
          const entry = monthMap.get(monthKey);
          if (metric.fighter === 'Gripen') {
            entry.gripenMentions += metric.mentions_count;
            entry.gripenSentimentSum += metric.sentiment_score;
            entry.gripenCount += 1;
          } else {
            entry.f35Mentions += metric.mentions_count;
            entry.f35SentimentSum += metric.sentiment_score;
            entry.f35Count += 1;
          }
        });

        Array.from(monthMap.values()).forEach(entry => {
          chartData.push({
            date: entry.date,
            gripenMentions: entry.gripenMentions,
            f35Mentions: entry.f35Mentions,
            gripenSentiment: entry.gripenCount > 0 ? (entry.gripenSentimentSum / entry.gripenCount).toFixed(2) : '0.00',
            f35Sentiment: entry.f35Count > 0 ? (entry.f35SentimentSum / entry.f35Count).toFixed(2) : '0.00'
          });
        });
        chartData.sort((a, b) => a.date.localeCompare(b.date));
      }

      const doc = new DocxDocument({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              text: "Portuguese Fighter Program Monitor",
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
            }),
            new Paragraph({
              text: "Intelligence Report",
              heading: HeadingLevel.HEADING_2,
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 },
            }),
            new Paragraph({
              text: `Generated: ${new Date(report.created_at).toLocaleDateString('en-GB')} ${new Date(report.created_at).toLocaleTimeString('en-GB', { hour12: false })}`,
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),
            new Paragraph({
              text: "Executive Summary",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 200 },
            }),
            new Paragraph({
              text: report.executive_summary || 'No summary available',
              spacing: { after: 400 },
            }),
            new Paragraph({
              text: "Overall Scores",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Saab Gripen: ", bold: true }),
                new TextRun(`${(((report.media_tonality as any)?.gripen_score || 0) * 100).toFixed(1)}%`),
              ],
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "F-35: ", bold: true }),
                new TextRun(`${(((report.media_tonality as any)?.f35_score || 0) * 100).toFixed(1)}%`),
              ],
              spacing: { after: 400 },
            }),
            ...(changes.length > 0 ? [
              new Paragraph({
                text: "Key Changes Since Last Report",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 200 },
              }),
              ...changes.map(change => new Paragraph({
                text: `• ${change}`,
                spacing: { after: 100 },
              })),
              new Paragraph({
                text: "",
                spacing: { after: 200 },
              }),
            ] : []),
            ...(settings && settings.length > 0 ? [
              new Paragraph({
                text: "Analysis Weights & Configuration",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 200 },
              }),
              new Paragraph({
                text: "These are the weights configured for the analysis dimensions:",
                spacing: { after: 200 },
              }),
              ...settings.map((setting: any) =>
                new Paragraph({
                  text: `${setting.key}: ${JSON.stringify(setting.value)}`,
                  spacing: { after: 100 },
                })
              ),
            ] : []),
            new Paragraph({
              text: "Media Sentiment Analysis",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 200 },
            }),
            new Paragraph({
              text: "Gripen Media Presence",
              heading: HeadingLevel.HEADING_3,
              spacing: { after: 100 },
            }),
            ...((report.media_tonality as any)?.gripen ? [
              new Paragraph({
                children: [
                  new TextRun({ text: "Sentiment Score: ", bold: true }),
                  new TextRun(`${(report.media_tonality as any).gripen.sentiment_score?.toFixed(2) || 'N/A'}`),
                ],
                spacing: { after: 100 },
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: "Mentions: ", bold: true }),
                  new TextRun(`${(report.media_tonality as any).gripen.mentions || 0}`),
                ],
                spacing: { after: 100 },
              }),
              new Paragraph({
                text: (report.media_tonality as any).gripen.summary || 'No summary available',
                spacing: { after: 300 },
              }),
            ] : []),
            new Paragraph({
              text: "F-35 Media Presence",
              heading: HeadingLevel.HEADING_3,
              spacing: { after: 100 },
            }),
            ...((report.media_tonality as any)?.f35 ? [
              new Paragraph({
                children: [
                  new TextRun({ text: "Sentiment Score: ", bold: true }),
                  new TextRun(`${(report.media_tonality as any).f35.sentiment_score?.toFixed(2) || 'N/A'}`),
                ],
                spacing: { after: 100 },
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: "Mentions: ", bold: true }),
                  new TextRun(`${(report.media_tonality as any).f35.mentions || 0}`),
                ],
                spacing: { after: 100 },
              }),
              new Paragraph({
                text: (report.media_tonality as any).f35.summary || 'No summary available',
                spacing: { after: 400 },
              }),
            ] : []),
            ...(chartData.length > 0 ? [
              new Paragraph({
                text: "Sentiment Timeline Data",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 200 },
              }),
              new Paragraph({
                text: "Monthly sentiment scores and media mentions over the tracking period:",
                spacing: { after: 200 },
              }),
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph({ text: "Month", style: "Strong" })] }),
                      new TableCell({ children: [new Paragraph({ text: "Gripen Sentiment", style: "Strong" })] }),
                      new TableCell({ children: [new Paragraph({ text: "F-35 Sentiment", style: "Strong" })] }),
                      new TableCell({ children: [new Paragraph({ text: "Gripen Mentions", style: "Strong" })] }),
                      new TableCell({ children: [new Paragraph({ text: "F-35 Mentions", style: "Strong" })] }),
                    ],
                  }),
                  ...chartData.slice(0, 12).map((row: any) => 
                    new TableRow({
                      children: [
                        new TableCell({ children: [new Paragraph(format(new Date(row.date), 'MMM yyyy'))] }),
                        new TableCell({ children: [new Paragraph(row.gripenSentiment)] }),
                        new TableCell({ children: [new Paragraph(row.f35Sentiment)] }),
                        new TableCell({ children: [new Paragraph(row.gripenMentions.toString())] }),
                        new TableCell({ children: [new Paragraph(row.f35Mentions.toString())] }),
                      ],
                    })
                  ),
                ],
              }),
              new Paragraph({
                text: "",
                spacing: { after: 400 },
              }),
            ] : []),
            new Paragraph({
              text: "Capability Analysis",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 200 },
            }),
            new Paragraph({
              text: report.capability_analysis || 'No analysis available',
              spacing: { after: 400 },
            }),
            new Paragraph({
              text: "Cost Analysis",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 200 },
            }),
            new Paragraph({
              text: report.cost_analysis || 'No analysis available',
              spacing: { after: 400 },
            }),
            new Paragraph({
              text: "Political Analysis",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 200 },
            }),
            new Paragraph({
              text: report.political_analysis || 'No analysis available',
              spacing: { after: 400 },
            }),
            new Paragraph({
              text: "Industrial Cooperation",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 200 },
            }),
            new Paragraph({
              text: report.industrial_cooperation || 'No analysis available',
              spacing: { after: 400 },
            }),
            new Paragraph({
              text: "Geopolitical Analysis",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 200 },
            }),
            new Paragraph({
              text: report.geopolitical_analysis || 'No analysis available',
              spacing: { after: 400 },
            }),
            ...((report.media_tonality as any)?.dimension_scores ? [
              new Paragraph({
                text: "Dimensional Scores Breakdown",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 200 },
              }),
              new Paragraph({
                text: "Scores across key evaluation dimensions (scale: 0-10):",
                spacing: { after: 200 },
              }),
              ...((report.media_tonality as any).dimension_scores.gripen ? [
                new Paragraph({
                  text: "Gripen Scores",
                  heading: HeadingLevel.HEADING_3,
                  spacing: { after: 100 },
                }),
                ...Object.entries((report.media_tonality as any).dimension_scores.gripen).map(([key, value]: [string, any]) =>
                  new Paragraph({
                    text: `${key.charAt(0).toUpperCase() + key.slice(1)}: ${value?.toFixed(1) || 'N/A'}`,
                    spacing: { after: 50 },
                  })
                ),
              ] : []),
              ...((report.media_tonality as any).dimension_scores.f35 ? [
                new Paragraph({
                  text: "F-35 Scores",
                  heading: HeadingLevel.HEADING_3,
                  spacing: { before: 200, after: 100 },
                }),
                ...Object.entries((report.media_tonality as any).dimension_scores.f35).map(([key, value]: [string, any]) =>
                  new Paragraph({
                    text: `${key.charAt(0).toUpperCase() + key.slice(1)}: ${value?.toFixed(1) || 'N/A'}`,
                    spacing: { after: 50 },
                  })
                ),
              ] : []),
            ] : []),
            ...(suggestions ? [
              new Paragraph({
                text: "Strategic Messaging Suggestions",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 400, after: 200 },
              }),
              new Paragraph({
                text: "AI-generated strategic messaging recommendations based on current analysis.",
                spacing: { after: 300 },
              }),
              new Paragraph({
                text: "Gripen Campaign Strategy",
                heading: HeadingLevel.HEADING_3,
                spacing: { before: 200, after: 100 },
              }),
              new Paragraph({
                children: [new TextRun({ text: "Media Strategy:", bold: true })],
                spacing: { after: 100 },
              }),
              ...(suggestions.gripen?.media || []).map((item: any) => 
                new Paragraph({
                  text: `• ${item.message} (Messenger: ${item.messenger})`,
                  spacing: { after: 100 },
                })
              ),
              new Paragraph({
                children: [new TextRun({ text: "Political Engagement:", bold: true })],
                spacing: { before: 200, after: 100 },
              }),
              ...(suggestions.gripen?.politicians || []).map((item: any) => 
                new Paragraph({
                  text: `• ${item.message} (Messenger: ${item.messenger})`,
                  spacing: { after: 100 },
                })
              ),
              new Paragraph({
                children: [new TextRun({ text: "Air Force Messaging:", bold: true })],
                spacing: { before: 200, after: 100 },
              }),
              ...(suggestions.gripen?.airforce || []).map((item: any) => 
                new Paragraph({
                  text: `• ${item.message} (Messenger: ${item.messenger})`,
                  spacing: { after: 100 },
                })
              ),
              new Paragraph({
                text: "F-35 Campaign Strategy",
                heading: HeadingLevel.HEADING_3,
                spacing: { before: 300, after: 100 },
              }),
              new Paragraph({
                children: [new TextRun({ text: "Media Strategy:", bold: true })],
                spacing: { after: 100 },
              }),
              ...(suggestions.f35?.media || []).map((item: any) => 
                new Paragraph({
                  text: `• ${item.message} (Messenger: ${item.messenger})`,
                  spacing: { after: 100 },
                })
              ),
              new Paragraph({
                children: [new TextRun({ text: "Political Engagement:", bold: true })],
                spacing: { before: 200, after: 100 },
              }),
              ...(suggestions.f35?.politicians || []).map((item: any) => 
                new Paragraph({
                  text: `• ${item.message} (Messenger: ${item.messenger})`,
                  spacing: { after: 100 },
                })
              ),
              new Paragraph({
                children: [new TextRun({ text: "Air Force Messaging:", bold: true })],
                spacing: { before: 200, after: 100 },
              }),
              ...(suggestions.f35?.airforce || []).map((item: any) => 
                new Paragraph({
                  text: `• ${item.message} (Messenger: ${item.messenger})`,
                  spacing: { after: 100 },
                })
              ),
            ] : []),
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `fighter-program-report-${new Date().toISOString().split('T')[0]}.docx`;
      link.click();
      URL.revokeObjectURL(url);

      toast.dismiss();
      toast.success("Word document generated successfully");
      setOpen(false);
    } catch (error) {
      console.error('Error generating Word document:', error);
      toast.dismiss();
      toast.error("Failed to generate Word document");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async () => {
    try {
      setLoading(true);
      const data = await fetchReportData();
      const { report, metrics, previousReport, settings, suggestions } = data;

      // Process changes
      let changesHTML = '';
      if (previousReport) {
        const latestTonality: any = report.media_tonality;
        const prevTonality: any = previousReport.media_tonality;
        const changes: string[] = [];

        if (latestTonality?.gripen_score && prevTonality?.gripen_score) {
          const diff = latestTonality.gripen_score - prevTonality.gripen_score;
          if (Math.abs(diff) > 2) {
            changes.push(`<li>Gripen Overall Score ${diff > 0 ? 'increased' : 'decreased'} by ${Math.abs(diff).toFixed(1)} points</li>`);
          }
        }

        if (latestTonality?.f35_score && prevTonality?.f35_score) {
          const diff = latestTonality.f35_score - prevTonality.f35_score;
          if (Math.abs(diff) > 2) {
            changes.push(`<li>F-35 Overall Score ${diff > 0 ? 'increased' : 'decreased'} by ${Math.abs(diff).toFixed(1)} points</li>`);
          }
        }

        if (changes.length > 0) {
          changesHTML = `
            <h2>Key Changes Since Last Report</h2>
            <ul>${changes.join('')}</ul>
          `;
        }
      }

      // Process metrics for table
      let timelineHTML = '';
      if (metrics && metrics.length > 0) {
        const monthMap = new Map();
        metrics.forEach((metric: any) => {
          const date = new Date(metric.metric_date);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          
          if (!monthMap.has(monthKey)) {
            monthMap.set(monthKey, { 
              date: monthKey,
              gripenMentions: 0,
              f35Mentions: 0,
              gripenSentimentSum: 0,
              f35SentimentSum: 0,
              gripenCount: 0,
              f35Count: 0
            });
          }
          
          const entry = monthMap.get(monthKey);
          if (metric.fighter === 'Gripen') {
            entry.gripenMentions += metric.mentions_count;
            entry.gripenSentimentSum += metric.sentiment_score;
            entry.gripenCount += 1;
          } else {
            entry.f35Mentions += metric.mentions_count;
            entry.f35SentimentSum += metric.sentiment_score;
            entry.f35Count += 1;
          }
        });

        const chartData = Array.from(monthMap.values()).map(entry => ({
          date: entry.date,
          gripenMentions: entry.gripenMentions,
          f35Mentions: entry.f35Mentions,
          gripenSentiment: entry.gripenCount > 0 ? (entry.gripenSentimentSum / entry.gripenCount).toFixed(2) : '0.00',
          f35Sentiment: entry.f35Count > 0 ? (entry.f35SentimentSum / entry.f35Count).toFixed(2) : '0.00'
        })).sort((a, b) => a.date.localeCompare(b.date));

        const tableRows = chartData.map(row => `
          <tr>
            <td>${format(new Date(row.date), 'MMM yyyy')}</td>
            <td>${row.gripenSentiment}</td>
            <td>${row.f35Sentiment}</td>
            <td>${row.gripenMentions}</td>
            <td>${row.f35Mentions}</td>
          </tr>
        `).join('');

        timelineHTML = `
          <h2>Sentiment Timeline Data</h2>
          <p>Monthly sentiment scores and media mentions over the tracking period:</p>
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Gripen Sentiment</th>
                <th>F-35 Sentiment</th>
                <th>Gripen Mentions</th>
                <th>F-35 Mentions</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        `;
      }

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error("Please allow popups to print");
        setLoading(false);
        return;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Fighter Program Report</title>
            <style>
              @media print {
                body { margin: 0; padding: 20px; font-family: Arial, sans-serif; font-size: 11pt; }
                h1 { color: #1e293b; border-bottom: 3px solid #3b82f6; padding-bottom: 10px; page-break-after: avoid; }
                h2 { color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px; margin-top: 30px; page-break-after: avoid; }
                h3 { color: #475569; margin-top: 20px; page-break-after: avoid; }
                .scores { display: flex; justify-content: space-between; margin: 20px 0; page-break-inside: avoid; }
                .score-box { width: 48%; padding: 15px; background: #f8fafc; border: 2px solid #e2e8f0; }
                .score-value { font-size: 24px; font-weight: bold; color: #3b82f6; }
                .metric { margin: 10px 0; }
                .metric strong { color: #475569; }
                p { line-height: 1.6; text-align: justify; margin: 10px 0; }
                ul { margin: 10px 0; padding-left: 20px; }
                li { margin: 5px 0; }
                table { width: 100%; border-collapse: collapse; margin: 15px 0; page-break-inside: avoid; }
                th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
                th { background: #f1f5f9; font-weight: bold; }
                .page-break { page-break-before: always; }
              }
            </style>
          </head>
          <body>
            <h1>Portuguese Fighter Program Monitor</h1>
            <p><strong>Intelligence Report</strong></p>
            <p>Generated: ${new Date(report.created_at).toLocaleDateString('en-GB')} ${new Date(report.created_at).toLocaleTimeString('en-GB', { hour12: false })}</p>
            
            <h2>Executive Summary</h2>
            <p>${report.executive_summary || 'No summary available'}</p>
            
            <h2>Overall Scores</h2>
            <div class="scores">
              <div class="score-box">
                <strong>Saab Gripen</strong>
                <div class="score-value">${(((report.media_tonality as any)?.gripen_score || 0) * 100).toFixed(1)}%</div>
              </div>
              <div class="score-box">
                <strong>F-35</strong>
                <div class="score-value">${(((report.media_tonality as any)?.f35_score || 0) * 100).toFixed(1)}%</div>
              </div>
            </div>
            
            ${changesHTML}
            
            <h2>Media Sentiment Analysis</h2>
            <h3>Gripen Media Presence</h3>
            ${(report.media_tonality as any)?.gripen ? `
              <div class="metric"><strong>Sentiment Score:</strong> ${(report.media_tonality as any).gripen.sentiment_score?.toFixed(2) || 'N/A'}</div>
              <div class="metric"><strong>Mentions:</strong> ${(report.media_tonality as any).gripen.mentions || 0}</div>
              <p>${(report.media_tonality as any).gripen.summary || 'No summary available'}</p>
            ` : ''}
            
            <h3>F-35 Media Presence</h3>
            ${(report.media_tonality as any)?.f35 ? `
              <div class="metric"><strong>Sentiment Score:</strong> ${(report.media_tonality as any).f35.sentiment_score?.toFixed(2) || 'N/A'}</div>
              <div class="metric"><strong>Mentions:</strong> ${(report.media_tonality as any).f35.mentions || 0}</div>
              <p>${(report.media_tonality as any).f35.summary || 'No summary available'}</p>
            ` : ''}
            
            ${timelineHTML}
            
            <div class="page-break"></div>
            
            <h2>Capability Analysis</h2>
            <p>${report.capability_analysis || 'No analysis available'}</p>
            
            <h2>Cost Analysis</h2>
            <p>${report.cost_analysis || 'No analysis available'}</p>
            
            <div class="page-break"></div>
            
            <h2>Political Analysis</h2>
            <p>${report.political_analysis || 'No analysis available'}</p>
            
            <h2>Industrial Cooperation</h2>
            <p>${report.industrial_cooperation || 'No analysis available'}</p>
            
            <div class="page-break"></div>
            
            <h2>Geopolitical Analysis</h2>
            <p>${report.geopolitical_analysis || 'No analysis available'}</p>
            
            ${(report.media_tonality as any)?.dimension_scores ? `
              <h2>Dimensional Scores Breakdown</h2>
              <p>Scores across key evaluation dimensions (scale: 0-10):</p>
              ${(report.media_tonality as any).dimension_scores.gripen ? `
                <h3>Gripen Scores</h3>
                ${Object.entries((report.media_tonality as any).dimension_scores.gripen).map(([key, value]: [string, any]) => `
                  <div class="metric"><strong>${key.charAt(0).toUpperCase() + key.slice(1)}:</strong> ${value?.toFixed(1) || 'N/A'}</div>
                `).join('')}
              ` : ''}
              ${(report.media_tonality as any).dimension_scores.f35 ? `
                <h3>F-35 Scores</h3>
                ${Object.entries((report.media_tonality as any).dimension_scores.f35).map(([key, value]: [string, any]) => `
                  <div class="metric"><strong>${key.charAt(0).toUpperCase() + key.slice(1)}:</strong> ${value?.toFixed(1) || 'N/A'}</div>
                `).join('')}
              ` : ''}
            ` : ''}
          </body>
        </html>
      `);

      printWindow.document.close();
      printWindow.focus();
      
      setTimeout(() => {
        printWindow.print();
        setLoading(false);
        setOpen(false);
      }, 250);

    } catch (error) {
      console.error('Error printing:', error);
      toast.error("Failed to print report");
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2"
      >
        <Download className="h-4 w-4" />
        Export
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Report</DialogTitle>
            <DialogDescription>
              Choose how you want to export the intelligence report
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-3 py-4">
            <Button
              variant="outline"
              onClick={handleExportPDF}
              disabled={loading}
              className="justify-start gap-3 h-auto py-4"
            >
              <FileText className="h-5 w-5 text-destructive" />
              <div className="text-left">
                <div className="font-semibold">Export as PDF</div>
                <div className="text-xs text-muted-foreground">Professional formatted PDF document</div>
              </div>
            </Button>

            <Button
              variant="outline"
              onClick={handleExportWord}
              disabled={loading}
              className="justify-start gap-3 h-auto py-4"
            >
              <FileText className="h-5 w-5 text-primary" />
              <div className="text-left">
                <div className="font-semibold">Export as Word</div>
                <div className="text-xs text-muted-foreground">Editable Microsoft Word document</div>
              </div>
            </Button>

            <Button
              variant="outline"
              onClick={handlePrint}
              disabled={loading}
              className="justify-start gap-3 h-auto py-4"
            >
              <Printer className="h-5 w-5 text-muted-foreground" />
              <div className="text-left">
                <div className="font-semibold">Print Report</div>
                <div className="text-xs text-muted-foreground">Send directly to printer</div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
