import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export default function DataFlowTest() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const testDataFlow = async () => {
    setLoading(true);
    setResults(null);
    const testResults: any = {
      steps: []
    };

    try {
      // Step 1: Check authentication
      testResults.steps.push({ name: "Auth Check", status: "running" });
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        testResults.steps[0] = { name: "Auth Check", status: "failed", error: authError?.message || "No user" };
        setResults(testResults);
        return;
      }
      testResults.steps[0] = { name: "Auth Check", status: "passed", data: user.id };

      // Step 2: Check user settings
      testResults.steps.push({ name: "User Settings Check", status: "running" });
      const { data: settings, error: settingsError } = await supabase
        .from('user_settings')
        .select('active_country, active_competitors')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (settingsError) {
        testResults.steps[1] = { name: "User Settings Check", status: "failed", error: settingsError.message };
        setResults(testResults);
        return;
      }
      testResults.steps[1] = { name: "User Settings Check", status: "passed", data: settings };

      // Step 3: Check baseline
      testResults.steps.push({ name: "Baseline Check", status: "running" });
      const { data: baseline, error: baselineError } = await supabase
        .from('baselines')
        .select('start_date, end_date')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (baselineError) {
        testResults.steps[2] = { name: "Baseline Check", status: "failed", error: baselineError.message };
        setResults(testResults);
        return;
      }
      if (!baseline) {
        testResults.steps[2] = { name: "Baseline Check", status: "failed", error: "No baseline found" };
        setResults(testResults);
        return;
      }
      testResults.steps[2] = { name: "Baseline Check", status: "passed", data: baseline };

      // Step 4: Test article collection
      testResults.steps.push({ name: "Article Collection", status: "running" });
      const collectionParams = {
        country: settings?.active_country || 'PT',
        competitors: settings?.active_competitors || ['F-35'],
        startDate: baseline.start_date,
        endDate: baseline.end_date
      };

      console.log('Testing article collection with params:', collectionParams);
      
      const { data: collectionData, error: collectionError } = await supabase.functions.invoke(
        'collect-articles-for-tracking',
        { body: collectionParams }
      );

      if (collectionError) {
        testResults.steps[3] = { 
          name: "Article Collection", 
          status: "failed", 
          error: collectionError.message,
          details: collectionError
        };
        setResults(testResults);
        return;
      }

      testResults.steps[3] = { 
        name: "Article Collection", 
        status: "passed", 
        data: collectionData 
      };

      // Step 5: Verify database storage
      testResults.steps.push({ name: "Database Verification", status: "running" });
      const { data: items, error: itemsError } = await supabase
        .from('items')
        .select('id, url, title_en, fighter_tags, source_country, published_at')
        .order('created_at', { ascending: false })
        .limit(10);

      if (itemsError) {
        testResults.steps[4] = { name: "Database Verification", status: "failed", error: itemsError.message };
      } else {
        testResults.steps[4] = { 
          name: "Database Verification", 
          status: items && items.length > 0 ? "passed" : "warning",
          data: {
            count: items?.length || 0,
            sample: items?.slice(0, 3)
          }
        };
      }

      setResults(testResults);
      toast.success("Data flow test complete!");

    } catch (error) {
      console.error('Test error:', error);
      testResults.steps.push({
        name: "Unexpected Error",
        status: "failed",
        error: error instanceof Error ? error.message : String(error)
      });
      setResults(testResults);
      toast.error("Test failed with exception");
    } finally {
      setLoading(false);
    }
  };

  const checkEdgeFunctionLogs = async () => {
    toast.info("Check the browser console for edge function invocation details");
    console.log("=== Edge Function Logs Check ===");
    console.log("Note: Edge function logs are only available in the Supabase dashboard");
    console.log("Check: https://supabase.com/dashboard/project/[project-id]/logs/edge-functions");
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Data Flow Test Page</h1>
      
      <div className="mb-6 space-x-4">
        <Button onClick={testDataFlow} disabled={loading}>
          {loading ? "Testing..." : "Run Full Data Flow Test"}
        </Button>
        <Button onClick={checkEdgeFunctionLogs} variant="outline">
          Check Edge Function Logs
        </Button>
      </div>

      {results && (
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Test Results</h2>
          <div className="space-y-4">
            {results.steps.map((step: any, index: number) => (
              <div key={index} className="border-l-4 pl-4" style={{
                borderColor: 
                  step.status === 'passed' ? 'green' : 
                  step.status === 'warning' ? 'orange' :
                  step.status === 'failed' ? 'red' : 
                  'gray'
              }}>
                <div className="font-semibold">
                  {index + 1}. {step.name}: <span className="capitalize">{step.status}</span>
                </div>
                {step.error && (
                  <div className="text-red-600 text-sm mt-1">Error: {step.error}</div>
                )}
                {step.data && (
                  <div className="text-sm mt-1 bg-gray-100 p-2 rounded overflow-auto max-h-40">
                    <pre>{JSON.stringify(step.data, null, 2)}</pre>
                  </div>
                )}
                {step.details && (
                  <div className="text-sm mt-1 text-gray-600">
                    <pre>{JSON.stringify(step.details, null, 2)}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-6 mt-6">
        <h2 className="text-xl font-bold mb-4">Data Flow Overview</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm">
          <li><strong>User clicks "Tracking from" button</strong> → Opens date picker</li>
          <li><strong>User selects date</strong> → Triggers BaselineGenerator.handleGenerate()</li>
          <li><strong>generate-baseline edge function</strong> → Creates baseline record with start/end dates</li>
          <li><strong>collect-articles-for-tracking edge function</strong> → 
            <ul className="list-disc list-inside ml-6 mt-1 space-y-1">
              <li>Searches DuckDuckGo for articles</li>
              <li>Extracts article URLs, titles, snippets</li>
              <li>Sends to AI for fighter tag extraction & sentiment analysis</li>
              <li>Matches titles back to URLs</li>
              <li>Determines source_country from URL domain</li>
              <li>Stores in items table with fighter_tags, source_country, published_at</li>
            </ul>
          </li>
          <li><strong>MediaArticlesList component</strong> → Queries items table, filters by fighter_tags and source_country</li>
        </ol>

        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
          <strong>⚠️ Critical Issue:</strong> The items table has 0 records. This means either:
          <ul className="list-disc list-inside ml-4 mt-2">
            <li>The collect-articles-for-tracking function was never triggered (check by clicking "Tracking from" button)</li>
            <li>The function ran but failed to find/store articles (check edge function logs)</li>
            <li>Articles were found but RLS policy blocked insertion (but we fixed this)</li>
            <li>Articles were found but had no fighter_tags (filtered out)</li>
          </ul>
        </div>
      </Card>
    </div>
  );
}
