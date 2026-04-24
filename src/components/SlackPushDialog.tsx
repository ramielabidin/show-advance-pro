import { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Show } from "@/lib/types";

interface SlackPushDialogProps {
  showId: string;
  show: Show;
  trigger?: React.ReactNode;
}

export default function SlackPushDialog({ showId, trigger }: SlackPushDialogProps) {
  const [pushing, setPushing] = useState(false);

  const handlePush = async () => {
    setPushing(true);
    try {
      const { data, error } = await supabase.functions.invoke("push-slack-daysheet", {
        body: { showId, appUrl: window.location.origin },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast.success("Day sheet pushed to Slack!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to push to Slack");
    } finally {
      setPushing(false);
    }
  };

  if (trigger) {
    return (
      <span
        onClick={(e) => {
          e.preventDefault();
          if (!pushing) handlePush();
        }}
      >
        {trigger}
      </span>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5"
      onClick={handlePush}
      disabled={pushing}
    >
      {pushing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      Slack
    </Button>
  );
}
