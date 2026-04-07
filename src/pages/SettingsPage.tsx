import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, UserPlus, Trash2, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/components/TeamProvider";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { team, teamId, isOwner } = useTeam();
  const { session } = useAuth();
  const [webhookUrl, setWebhookUrl] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");

  const { isLoading: settingsLoading } = useQuery({
    queryKey: ["app-settings", teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .eq("team_id", teamId!)
        .limit(1)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      setWebhookUrl(data?.slack_webhook_url ?? "");
      return data;
    },
    enabled: !!teamId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: existing } = await supabase
        .from("app_settings")
        .select("id")
        .eq("team_id", teamId!)
        .limit(1)
        .single();
      if (!existing) {
        const { error } = await supabase
          .from("app_settings")
          .insert({ team_id: teamId!, slack_webhook_url: webhookUrl || null });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("app_settings")
          .update({ slack_webhook_url: webhookUrl || null })
          .eq("id", existing.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-settings", teamId] });
      toast.success("Settings saved");
    },
    onError: () => toast.error("Failed to save settings"),
  });

  const { data: members = [] } = useQuery({
    queryKey: ["team-members", teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("id, user_id, role, created_at")
        .eq("team_id", teamId!)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!teamId,
  });

  const { data: emailMap = {} } = useQuery({
    queryKey: ["team-member-emails", teamId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_team_member_emails", {
        _team_id: teamId!,
      });
      if (error) throw error;
      const map: Record<string, string> = {};
      (data ?? []).forEach((r: { user_id: string; email: string }) => {
        map[r.user_id] = r.email;
      });
      return map;
    },
    enabled: !!teamId,
  });

  const { data: invites = [] } = useQuery({
    queryKey: ["team-invites", teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_invites")
        .select("*")
        .eq("team_id", teamId!)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!teamId && isOwner,
  });

  const inviteMutation = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.from("team_invites").insert({
        team_id: teamId!,
        email: email.toLowerCase().trim(),
        invited_by: session!.user.id,
      });
      if (error) {
        if (error.code === "23505") throw new Error("Already invited");
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-invites", teamId] });
      setInviteEmail("");
      toast.success("Invite sent");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to send invite"),
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.from("team_members").delete().eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members", teamId] });
      toast.success("Member removed");
    },
  });

  const removeInviteMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase.from("team_invites").delete().eq("id", inviteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-invites", teamId] });
      toast.success("Invite removed");
    },
  });

  return (
    <div className="animate-fade-in max-w-xl space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your team and integrations</p>
      </div>

      {/* Team Section */}
      <div className="rounded-lg border bg-card p-4 sm:p-6 space-y-6">
        <div>
          <h2 className="font-medium text-foreground mb-1">Team</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {team?.name} · {members.length} member{members.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-md border px-3 py-2.5 sm:py-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm text-foreground truncate">
                  {m.user_id === session?.user.id ? "You" : (emailMap[m.user_id] || m.user_id.slice(0, 8) + "…")}
                </span>
                {m.role === "owner" && (
                  <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                )}
              </div>
              {isOwner && m.user_id !== session?.user.id && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                  onClick={() => {
                    if (confirm("Remove this member?")) removeMemberMutation.mutate(m.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>

        {invites.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Pending Invites</p>
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between rounded-md border border-dashed px-3 py-2.5 sm:py-2">
                <span className="text-sm text-muted-foreground truncate">{inv.email}</span>
                {isOwner && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                    onClick={() => removeInviteMutation.mutate(inv.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {isOwner && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="teammate@email.com"
              type="email"
              className="text-sm h-11 sm:h-9"
              onKeyDown={(e) => {
                if (e.key === "Enter" && inviteEmail.trim()) {
                  inviteMutation.mutate(inviteEmail);
                }
              }}
            />
            <Button
              size="sm"
              className="gap-1.5 shrink-0 h-11 sm:h-9"
              onClick={() => inviteMutation.mutate(inviteEmail)}
              disabled={!inviteEmail.trim() || inviteMutation.isPending}
            >
              <UserPlus className="h-4 w-4" />
              Invite
            </Button>
          </div>
        )}
      </div>

      <Separator />

      {/* Slack Integration */}
      <div className="rounded-lg border bg-card p-4 sm:p-6 space-y-6">
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
              className="font-mono text-sm h-11 sm:h-9"
              disabled={settingsLoading}
            />
          </div>
        </div>

        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || settingsLoading}
          className="gap-1.5 w-full sm:w-auto h-11 sm:h-9"
        >
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? "Saving…" : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
