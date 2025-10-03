import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, FileText, Printer } from "lucide-react";
import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";
import { Document as DocxDocument, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, BorderStyle } from "docx";
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
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchReportData = async () => {
    const { data: report } = await supabase
      .from('research_reports')
      .select('*')
      .order('report_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!report) {
      throw new Error("No report data available");
    }

    return report as any;
  };

  const handleExportPDF = async () => {
    try {
      setLoading(true);
      toast.loading("Generating PDF report...");
      
      const report = await fetchReportData();

      const blob = await pdf(
        <PDFDocument report={report} lastUpdate={new Date(report.created_at)} />
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
      
      const report = await fetchReportData();

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
                new TextRun(`${((report.media_tonality?.gripen_score || 0) * 100).toFixed(1)}%`),
              ],
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "F-35: ", bold: true }),
                new TextRun(`${((report.media_tonality?.f35_score || 0) * 100).toFixed(1)}%`),
              ],
              spacing: { after: 400 },
            }),
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
            ...(report.media_tonality?.gripen ? [
              new Paragraph({
                children: [
                  new TextRun({ text: "Sentiment Score: ", bold: true }),
                  new TextRun(`${report.media_tonality.gripen.sentiment_score?.toFixed(2) || 'N/A'}`),
                ],
                spacing: { after: 100 },
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: "Mentions: ", bold: true }),
                  new TextRun(`${report.media_tonality.gripen.mentions || 0}`),
                ],
                spacing: { after: 100 },
              }),
              new Paragraph({
                text: report.media_tonality.gripen.summary || 'No summary available',
                spacing: { after: 300 },
              }),
            ] : []),
            new Paragraph({
              text: "F-35 Media Presence",
              heading: HeadingLevel.HEADING_3,
              spacing: { after: 100 },
            }),
            ...(report.media_tonality?.f35 ? [
              new Paragraph({
                children: [
                  new TextRun({ text: "Sentiment Score: ", bold: true }),
                  new TextRun(`${report.media_tonality.f35.sentiment_score?.toFixed(2) || 'N/A'}`),
                ],
                spacing: { after: 100 },
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: "Mentions: ", bold: true }),
                  new TextRun(`${report.media_tonality.f35.mentions || 0}`),
                ],
                spacing: { after: 100 },
              }),
              new Paragraph({
                text: report.media_tonality.f35.summary || 'No summary available',
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
      const report = await fetchReportData();

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
                body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
                h1 { color: #3b82f6; border-bottom: 3px solid #3b82f6; padding-bottom: 10px; }
                h2 { color: #3b82f6; border-left: 4px solid #3b82f6; padding-left: 10px; margin-top: 30px; }
                h3 { color: #60a5fa; margin-top: 20px; }
                .scores { display: flex; justify-content: space-between; margin: 20px 0; }
                .score-box { width: 48%; padding: 15px; background: #f1f5f9; border-left: 4px solid #3b82f6; }
                .score-value { font-size: 24px; font-weight: bold; color: #3b82f6; }
                .metric { margin: 10px 0; }
                .metric strong { color: #475569; }
                p { line-height: 1.6; text-align: justify; }
              }
            </style>
          </head>
          <body>
            <h1>Portuguese Fighter Program Monitor</h1>
            <p><strong>Intelligence Report</strong></p>
            <p>Generated: ${new Date(report.created_at).toLocaleDateString('en-GB')} ${new Date(report.created_at).toLocaleTimeString('en-GB', { hour12: false })}</p>
            
            <h2>Executive Summary</h2>
            <p>${report.executive_summary || 'No summary available'}</p>
            
            <div class="scores">
              <div class="score-box">
                <strong>Saab Gripen</strong>
                <div class="score-value">${((report.media_tonality?.gripen_score || 0) * 100).toFixed(1)}%</div>
              </div>
              <div class="score-box">
                <strong>F-35</strong>
                <div class="score-value">${((report.media_tonality?.f35_score || 0) * 100).toFixed(1)}%</div>
              </div>
            </div>
            
            <h2>Media Sentiment Analysis</h2>
            <h3>Gripen Media Presence</h3>
            ${report.media_tonality?.gripen ? `
              <div class="metric"><strong>Sentiment Score:</strong> ${report.media_tonality.gripen.sentiment_score?.toFixed(2) || 'N/A'}</div>
              <div class="metric"><strong>Mentions:</strong> ${report.media_tonality.gripen.mentions || 0}</div>
              <p>${report.media_tonality.gripen.summary || 'No summary available'}</p>
            ` : ''}
            
            <h3>F-35 Media Presence</h3>
            ${report.media_tonality?.f35 ? `
              <div class="metric"><strong>Sentiment Score:</strong> ${report.media_tonality.f35.sentiment_score?.toFixed(2) || 'N/A'}</div>
              <div class="metric"><strong>Mentions:</strong> ${report.media_tonality.f35.mentions || 0}</div>
              <p>${report.media_tonality.f35.summary || 'No summary available'}</p>
            ` : ''}
            
            <h2>Capability Analysis</h2>
            <p>${report.capability_analysis || 'No analysis available'}</p>
            
            <h2>Cost Analysis</h2>
            <p>${report.cost_analysis || 'No analysis available'}</p>
            
            <h2>Political Analysis</h2>
            <p>${report.political_analysis || 'No analysis available'}</p>
            
            <h2>Industrial Cooperation</h2>
            <p>${report.industrial_cooperation || 'No analysis available'}</p>
            
            <h2>Geopolitical Analysis</h2>
            <p>${report.geopolitical_analysis || 'No analysis available'}</p>
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
