import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, UserPlus, Trash2, Crown, Plus, Pencil, X, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/components/TeamProvider";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const PARTY_ROLES = ["Artist", "Manager", "Crew", "Photographer", "Driver", "Other"] as const;

interface PartyMemberForm {
  name: string;
  email: string;
  phone: string;
  role: string;
}

const emptyPartyForm: PartyMemberForm = { name: "", email: "", phone: "", role: "" };

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { team, teamId, isOwner } = useTeam();
  const { session } = useAuth();
  const [webhookUrl, setWebhookUrl] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");

  // Touring party state
  const [partyDialogOpen, setPartyDialogOpen] = useState(false);
  const [partyEditingId, setPartyEditingId] = useState<string | null>(null);
  const [partyForm, setPartyForm] = useState<PartyMemberForm>(emptyPartyForm);

  // ── App Settings (Slack) ──
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

  // ── Touring Party ──
  const { data: partyMembers = [], isLoading: partyLoading } = useQuery({
    queryKey: ["touring-party"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("touring_party_members")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const createPartyMutation = useMutation({
    mutationFn: async (m: PartyMemberForm) => {
      const { error } = await supabase.from("touring_party_members").insert({
        name: m.name,
        email: m.email,
        phone: m.phone,
        role: m.role || null,
        team_id: teamId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["touring-party"] });
      setPartyDialogOpen(false);
      setPartyForm(emptyPartyForm);
      toast.success("Member added");
    },
    onError: () => toast.error("Failed to add member"),
  });

  const updatePartyMutation = useMutation({
    mutationFn: async ({ id, ...m }: PartyMemberForm & { id: string }) => {
      const { error } = await supabase
        .from("touring_party_members")
        .update({ name: m.name, email: m.email, phone: m.phone, role: m.role || null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["touring-party"] });
      setPartyEditingId(null);
      setPartyForm(emptyPartyForm);
      toast.success("Member updated");
    },
  });

  const deletePartyMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("touring_party_members")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["touring-party"] });
      toast.success("Member removed");
    },
  });

  const startPartyEdit = (m: (typeof partyMembers)[0]) => {
    setPartyEditingId(m.id);
    setPartyForm({
      name: m.name,
      email: m.email,
      phone: m.phone,
      role: (m as any).role ?? "",
    });
  };

  // ── Team Members ──
  const { data: teamMembers = [] } = useQuery({
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
    <div className="animate-fade-in max-w-5xl space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your team and integrations</p>
      </div>

      {/* ── Slack Integration (full width) ── */}

      {/* ── Slack Integration ── */}
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

      {/* ── Two-column grid: Touring Party + Team Members ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 items-start">

      {/* ── Touring Party ── */}
      <div className="rounded-lg border bg-card p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-medium text-foreground mb-0.5">Touring Party</h2>
            <p className="text-sm text-muted-foreground">
              {partyMembers.length} member{partyMembers.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Dialog open={partyDialogOpen} onOpenChange={setPartyDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Add Member</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Member</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={partyForm.name} onChange={(e) => setPartyForm({ ...partyForm, name: e.target.value })} className="h-11 sm:h-9" />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={partyForm.role} onValueChange={(v) => setPartyForm({ ...partyForm, role: v })}>
                    <SelectTrigger className="h-11 sm:h-9">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {PARTY_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={partyForm.email} onChange={(e) => setPartyForm({ ...partyForm, email: e.target.value })} className="h-11 sm:h-9" />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={partyForm.phone} onChange={(e) => setPartyForm({ ...partyForm, phone: e.target.value })} className="h-11 sm:h-9" />
                </div>
                <Button
                  className="w-full h-11 sm:h-9"
                  onClick={() => createPartyMutation.mutate(partyForm)}
                  disabled={!partyForm.name || createPartyMutation.isPending}
                >
                  Add Member
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {partyLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-md bg-muted animate-pulse" />
            ))}
          </div>
        ) : partyMembers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No members yet. Add people to your touring party.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {partyMembers.map((m) => (
              <div
                key={m.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between rounded-md border px-3 py-2.5 gap-2"
              >
                {partyEditingId === m.id ? (
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input value={partyForm.name} onChange={(e) => setPartyForm({ ...partyForm, name: e.target.value })} placeholder="Name" className="h-9" />
                    <Select value={partyForm.role} onValueChange={(v) => setPartyForm({ ...partyForm, role: v })}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Role" />
                      </SelectTrigger>
                      <SelectContent>
                        {PARTY_ROLES.map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input value={partyForm.email} onChange={(e) => setPartyForm({ ...partyForm, email: e.target.value })} placeholder="Email" className="h-9" />
                    <Input value={partyForm.phone} onChange={(e) => setPartyForm({ ...partyForm, phone: e.target.value })} placeholder="Phone" className="h-9" />
                  </div>
                ) : (
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground text-sm">{m.name}</span>
                      {(m as any).role && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {(m as any).role}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-3 mt-0.5">
                      {m.email && <span className="text-xs text-muted-foreground truncate">{m.email}</span>}
                      {m.phone && <span className="text-xs font-mono text-muted-foreground">{m.phone}</span>}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-1 self-end sm:self-auto shrink-0">
                  {partyEditingId === m.id ? (
                    <>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setPartyEditingId(null); setPartyForm(emptyPartyForm); }}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updatePartyMutation.mutate({ id: m.id, ...partyForm })}>
                        <Save className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startPartyEdit(m)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm("Remove this member?")) deletePartyMutation.mutate(m.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Team Members ── */}
      <div className="rounded-lg border bg-card p-4 sm:p-6 space-y-4">
        <div>
          <h2 className="font-medium text-foreground mb-0.5">Team Members</h2>
          <p className="text-sm text-muted-foreground">
            {team?.name} · {teamMembers.length} member{teamMembers.length !== 1 ? "s" : ""} with login access
          </p>
        </div>

        <div className="space-y-2">
          {teamMembers.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-md border px-3 py-2.5 sm:py-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm text-foreground truncate">
                  {m.user_id === session?.user.id ? "You" : (emailMap[m.user_id] || m.user_id.slice(0, 8) + "…")}
                </span>
                {m.role === "owner" ? (
                  <Badge variant="default" className="text-[10px] px-1.5 py-0 gap-0.5">
                    <Crown className="h-2.5 w-2.5" />
                    Owner
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    Member
                  </Badge>
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

      </div>{/* end 2-column grid */}
    </div>
  );
}
