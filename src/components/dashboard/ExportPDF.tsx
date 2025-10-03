import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { Document, Page, Text, View, StyleSheet, pdf, Image } from "@react-pdf/renderer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    backgroundColor: '#0a0f1e',
    color: '#f8fafc',
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 30,
    borderBottom: '2px solid #3b82f6',
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#3b82f6',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 4,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3b82f6',
    marginBottom: 12,
    borderLeft: '4px solid #3b82f6',
    paddingLeft: 10,
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#60a5fa',
    marginBottom: 8,
    marginTop: 12,
  },
  text: {
    fontSize: 11,
    lineHeight: 1.6,
    color: '#e2e8f0',
    textAlign: 'justify',
  },
  scoreContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
    marginBottom: 15,
  },
  scoreBox: {
    width: '48%',
    padding: 15,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    borderLeft: '4px solid #3b82f6',
  },
  scoreName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#60a5fa',
    marginBottom: 8,
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  metricRow: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingLeft: 10,
  },
  metricLabel: {
    fontSize: 10,
    color: '#94a3b8',
    width: '40%',
  },
  metricValue: {
    fontSize: 10,
    color: '#e2e8f0',
    width: '60%',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 9,
    color: '#64748b',
    borderTop: '1px solid #334155',
    paddingTop: 10,
  },
  badge: {
    fontSize: 9,
    padding: '4 8',
    borderRadius: 4,
    marginRight: 6,
  },
  badgePositive: {
    backgroundColor: '#166534',
    color: '#86efac',
  },
  badgeNeutral: {
    backgroundColor: '#713f12',
    color: '#fde047',
  },
  badgeNegative: {
    backgroundColor: '#7f1d1d',
    color: '#fca5a5',
  },
});

interface PDFDocumentProps {
  report: any;
  lastUpdate: Date;
}

const PDFDocument = ({ report, lastUpdate }: PDFDocumentProps) => {
  const getSentimentBadge = (score: number) => {
    if (score >= 0.3) return { text: 'Positive', style: styles.badgePositive };
    if (score <= -0.3) return { text: 'Negative', style: styles.badgeNegative };
    return { text: 'Neutral', style: styles.badgeNeutral };
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Portuguese Fighter Program Monitor</Text>
          <Text style={styles.subtitle}>Intelligence Report</Text>
          <Text style={styles.subtitle}>
            Generated: {lastUpdate.toLocaleDateString('en-GB')} {lastUpdate.toLocaleTimeString('en-GB', { hour12: false })}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Executive Summary</Text>
          <Text style={styles.text}>{report.executive_summary || 'No summary available'}</Text>
        </View>

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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Political Analysis</Text>
          <Text style={styles.text}>{report.political_analysis || 'No analysis available'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Industrial Cooperation</Text>
          <Text style={styles.text}>{report.industrial_cooperation || 'No analysis available'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Geopolitical Analysis</Text>
          <Text style={styles.text}>{report.geopolitical_analysis || 'No analysis available'}</Text>
        </View>

        <Text style={styles.footer}>
          Portuguese Fighter Program Monitor • Confidential Intelligence Report
        </Text>
      </Page>
    </Document>
  );
};

export const ExportPDF = () => {
  const handleExport = async () => {
    try {
      toast.loading("Generating PDF report...");
      
      const { data: report } = await supabase
        .from('research_reports')
        .select('*')
        .order('report_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!report) {
        toast.error("No report data available");
        return;
      }

      const blob = await pdf(
        <PDFDocument report={report} lastUpdate={new Date(report.created_at)} />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `fighter-program-report-${new Date().toISOString().split('T')[0]}.pdf`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success("PDF report generated successfully");
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error("Failed to generate PDF report");
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      className="gap-2"
    >
      <Download className="h-4 w-4" />
      Export PDF
    </Button>
  );
};
