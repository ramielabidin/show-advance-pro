import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [webhookUrl, setWebhookUrl] = useState("");
  const [loaded, setLoaded] = useState(false);

  const { isLoading } = useQuery({
    queryKey: ["app-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .limit(1)
        .single();
      if (error) throw error;
      setWebhookUrl(data.slack_webhook_url ?? "");
      setLoaded(true);
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: existing } = await supabase
        .from("app_settings")
        .select("id")
        .limit(1)
        .single();
      if (!existing) throw new Error("Settings row not found");
      const { error } = await supabase
        .from("app_settings")
        .update({ slack_webhook_url: webhookUrl || null })
        .eq("id", existing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-settings"] });
      toast.success("Settings saved");
    },
    onError: () => toast.error("Failed to save settings"),
  });

  return (
    <div className="animate-fade-in max-w-xl">
      <div className="mb-8">
        <h1 className="text-3xl tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Configure integrations</p>
      </div>

      <div className="rounded-lg border bg-card p-6 space-y-6">
        <div>
          <h2 className="font-medium text-foreground mb-1">Slack Integration</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Add a Slack Incoming Webhook URL to push day sheets to your channel.{" "}
            <a
              href="https://api.slack.com/messaging/webhooks"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              How to create a webhook
            </a>
          </p>
          <div className="space-y-2">
            <Label htmlFor="webhook">Webhook URL</Label>
            <Input
              id="webhook"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://hooks.slack.com/services/T00/B00/xxx"
              className="font-mono text-sm"
              disabled={isLoading}
            />
          </div>
        </div>

        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || isLoading}
          className="gap-1.5"
        >
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? "Saving…" : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
