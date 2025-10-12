import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, RefreshCw } from "lucide-react";
import { useState } from "react";

export const DataCleanup = () => {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCleanAndRecollect = async () => {
    if (!confirm('This will delete all existing articles and recollect fresh data. Continue?')) {
      return;
    }

    setIsProcessing(true);
    try {
      toast.loading("Cleaning old data and recollecting...", { id: 'cleanup' });

      const { data, error } = await supabase.functions.invoke('clean-and-recollect');

      if (error) throw error;

      toast.success("Data cleaned and recollection started!", { id: 'cleanup' });
      
      // Refresh page after 2 seconds to show new data
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Cleanup error:', error);
      toast.error("Failed to clean and recollect data", { id: 'cleanup' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Button
      onClick={handleCleanAndRecollect}
      variant="outline"
      size="sm"
      disabled={isProcessing}
      className="gap-2"
    >
      {isProcessing ? (
        <>
          <RefreshCw className="h-4 w-4 animate-spin" />
          Processing...
        </>
      ) : (
        <>
          <Trash2 className="h-4 w-4" />
          Clean & Recollect Data
        </>
      )}
    </Button>
  );
};
