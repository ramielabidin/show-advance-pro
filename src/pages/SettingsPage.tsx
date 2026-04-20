import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, UserPlus, Trash2, Crown, Plus, Pencil, X, Users, Loader2, Music, Copy, Mail } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
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
import BandDocuments from "@/components/BandDocuments";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const PARTY_ROLES = ["Artist", "Manager", "Crew", "Photographer", "Driver", "Other"] as const;

const EMAIL_FORWARDING_DOMAIN = "parse.advancetouring.com";

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
  const [homeBaseCity, setHomeBaseCity] = useState("");
  const [cityPredictions, setCityPredictions] = useState<{ description: string; place_id: string }[]>([]);
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const [cityAutocompleteLoading, setCityAutocompleteLoading] = useState(false);
  const cityInputRef = useRef<HTMLInputElement>(null);
  const cityDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [connectingSlack, setConnectingSlack] = useState(false);

  // Touring party state
  const [partyDialogOpen, setPartyDialogOpen] = useState(false);
  const [partyEditingId, setPartyEditingId] = useState<string | null>(null);
  const [partyForm, setPartyForm] = useState<PartyMemberForm>(emptyPartyForm);

  // Confirmation state
  const [slackDisconnectOpen, setSlackDisconnectOpen] = useState(false);
  const [pendingRemovePartyId, setPendingRemovePartyId] = useState<string | null>(null);
  const [pendingRemoveMemberId, setPendingRemoveMemberId] = useState<string | null>(null);

  // ── App Settings ──
  const { isLoading: settingsLoading, data: appSettings } = useQuery({
    queryKey: ["app-settings", teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .eq("team_id", teamId!)
        .limit(1)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      setHomeBaseCity(data?.home_base_city ?? "");
      return data;
    },
    enabled: !!teamId,
  });

  const { data: recentInboundEvents = [] } = useQuery({
    queryKey: ["inbound-events-recent", teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inbound_parse_events")
        .select("id, email_subject, from_address, status, created_at")
        .eq("team_id", teamId!)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!teamId,
  });

  const forwardingAddress = appSettings?.inbound_email_token
    ? `${appSettings.inbound_email_token}@${EMAIL_FORWARDING_DOMAIN}`
    : null;

  const [searchParams] = useSearchParams();
  useEffect(() => {
    if (settingsLoading) return;
    if (searchParams.get("section") !== "email-forwarding") return;
    const el = document.getElementById("email-forwarding");
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [searchParams, settingsLoading]);

  const copyForwardingAddress = async () => {
    if (!forwardingAddress) return;
    try {
      await navigator.clipboard.writeText(forwardingAddress);
      toast.success("Forwarding address copied");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  // Detect OAuth redirect result (?slack=connected|error|denied)
  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get("slack");
    if (result === "connected") toast.success("Slack connected successfully!");
    else if (result === "error") toast.error("Slack connection failed. Please try again.");
    else if (result === "denied") toast.info("Slack connection was cancelled.");
    if (result) {
      const url = new URL(window.location.href);
      url.searchParams.delete("slack");
      window.history.replaceState({}, "", url.toString());
      queryClient.invalidateQueries({ queryKey: ["app-settings", teamId] });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: existing } = await supabase
        .from("app_settings")
        .select("id")
        .eq("team_id", teamId!)
        .limit(1)
        .single();
      const payload = { home_base_city: homeBaseCity.trim() || null };
      if (!existing) {
        const { error } = await supabase
          .from("app_settings")
          .insert({ team_id: teamId!, ...payload });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("app_settings")
          .update(payload)
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

  const fetchCityPredictions = useCallback(async (input: string) => {
    if (input.trim().length < 2) {
      setCityPredictions([]);
      setCityDropdownOpen(false);
      return;
    }
    setCityAutocompleteLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("autocomplete-place", {
        body: { input },
      });
      if (error) throw error;
      const preds = (data?.predictions ?? []) as { description: string; place_id: string }[];
      setCityPredictions(preds);
      setCityDropdownOpen(preds.length > 0);
    } catch {
      setCityPredictions([]);
      setCityDropdownOpen(false);
    } finally {
      setCityAutocompleteLoading(false);
    }
  }, []);

  const handleCityInput = (value: string) => {
    setHomeBaseCity(value);
    if (cityDebounceRef.current) clearTimeout(cityDebounceRef.current);
    cityDebounceRef.current = setTimeout(() => fetchCityPredictions(value), 300);
  };

  const selectCityPrediction = (description: string) => {
    // Strip trailing country name ("Brooklyn, NY, USA" → "Brooklyn, NY")
    const normalized = description.replace(/,\s*USA$/, "").trim();
    setHomeBaseCity(normalized);
    setCityPredictions([]);
    setCityDropdownOpen(false);
  };

  const handleConnectSlack = async () => {
    setConnectingSlack(true);
    try {
      // Fetch a fresh session so we always send a user JWT (not the cached
      // anon key). getSession() also transparently refreshes an expired token.
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      // Call the edge function with a direct fetch instead of
      // supabase.functions.invoke(). The SDK's invoke() wraps the Response in a
      // FunctionsHttpError and — on some infrastructure error paths — returns
      // an HTML body (auth gateway, 502 from upstream, unpublished function).
      // Parsing HTML as JSON surfaces the confusing
      //   "Unauthorized: Unexpected token '<', \"<html>...\" is not valid JSON"
      // toast. Reading the body as text once here lets us show an actionable
      // error regardless of what the gateway returned.
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const endpoint = `${supabaseUrl}/functions/v1/slack-oauth-initiate`;

      let response: Response;
      try {
        response = await fetch(endpoint, {
          method: "POST",
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        });
      } catch (networkErr) {
        const message = networkErr instanceof Error ? networkErr.message : "network error";
        throw new Error(`Could not reach Slack OAuth service: ${message}`);
      }

      const rawBody = await response.text();
      let parsed: { authorizationUrl?: string; error?: string } | null = null;
      try {
        parsed = rawBody ? JSON.parse(rawBody) : null;
      } catch {
        // Non-JSON response (typically an HTML error page from the gateway).
        parsed = null;
      }

      if (!response.ok) {
        // Log the raw body so the root cause is visible in devtools without
        // leaking HTML into the user-facing toast.
        console.error("slack-oauth-initiate failed", {
          status: response.status,
          statusText: response.statusText,
          body: rawBody.slice(0, 500),
        });
        if (parsed?.error) throw new Error(parsed.error);
        if (response.status === 401) {
          throw new Error(
            "Slack connection is not authorized. Sign out and back in, then try again.",
          );
        }
        if (response.status === 404) {
          throw new Error(
            "Slack OAuth function is not deployed. Ask an admin to deploy slack-oauth-initiate.",
          );
        }
        throw new Error(
          `Failed to start Slack connection (HTTP ${response.status} ${response.statusText}).`,
        );
      }

      if (!parsed?.authorizationUrl) {
        throw new Error("Slack OAuth service returned no authorization URL.");
      }
      window.location.href = parsed.authorizationUrl;
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to start Slack connection");
      setConnectingSlack(false);
    }
  };

  const disconnectSlackMutation = useMutation({
    mutationFn: async () => {
      const { data: existing } = await supabase
        .from("app_settings")
        .select("id")
        .eq("team_id", teamId!)
        .limit(1)
        .single();
      if (!existing) return;
      const { error } = await supabase
        .from("app_settings")
        .update({ slack_webhook_url: null, slack_channel_name: null, slack_team_name: null })
        .eq("id", existing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-settings", teamId] });
      toast.success("Slack disconnected");
    },
    onError: () => toast.error("Failed to disconnect Slack"),
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
    <div className="stagger-list max-w-5xl space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl tracking-[-0.02em]">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your artist profile and integrations</p>
      </div>

      {/* ── Active Artist ── */}
      <div className="rounded-lg border bg-card p-4 sm:p-6">
        <p className="label-small mb-2">active artist</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
              <Music className="h-5 w-5 text-muted-foreground" />
            </div>
            <span className="text-xl font-semibold tracking-tight text-foreground">{team?.name}</span>
          </div>
          <Badge variant={isOwner ? "default" : "secondary"} className="gap-1">
            {isOwner ? <><Crown className="h-3 w-3" />Owner</> : "Member"}
          </Badge>
        </div>
      </div>

      {/* ── App Settings (full width) ── */}
      <div className="rounded-lg border bg-card p-4 sm:p-6 space-y-6">
        {/* Slack Integration */}
        <div>
          <h2 className="font-medium text-foreground mb-1">Slack Integration</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Connect your Slack workspace to push day sheets directly to a channel.
          </p>
          {settingsLoading ? (
            <div className="h-10 rounded-md bg-muted animate-pulse" />
          ) : appSettings?.slack_webhook_url ? (
            <div className="flex items-center justify-between rounded-md border border-pastel-green/60 bg-pastel-green px-3 py-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="h-2 w-2 rounded-full bg-[hsl(var(--success))] shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-pastel-green-foreground leading-tight">
                    {appSettings.slack_channel_name ?? "Slack"} connected
                  </p>
                  {appSettings.slack_team_name && (
                    <p className="text-xs text-muted-foreground">{appSettings.slack_team_name}</p>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                disabled={disconnectSlackMutation.isPending}
                onClick={() => setSlackDisconnectOpen(true)}
              >
                {disconnectSlackMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Disconnect"
                )}
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleConnectSlack}
              disabled={connectingSlack || !teamId}
              className="gap-2 h-11 sm:h-9"
              style={{ backgroundColor: "#4A154B" }}
            >
              {connectingSlack ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                  <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
                </svg>
              )}
              {connectingSlack ? "Connecting…" : "Connect Slack"}
            </Button>
          )}
        </div>

        <Separator />

        {/* Home Base City */}
        <div>
          <h2 className="font-medium text-foreground mb-1">Home Base City</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Used to calculate drive times for the first show of a tour when there's no previous show to depart from.
          </p>
          <div className="space-y-2">
            <Label htmlFor="home-base-city">City</Label>
            <div className="relative">
              <Input
                id="home-base-city"
                ref={cityInputRef}
                value={homeBaseCity}
                onChange={(e) => handleCityInput(e.target.value)}
                onFocus={() => {
                  if (cityPredictions.length > 0) setCityDropdownOpen(true);
                }}
                onBlur={() => {
                  // Small delay so click on a suggestion registers first
                  setTimeout(() => setCityDropdownOpen(false), 150);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setCityDropdownOpen(false);
                }}
                placeholder="e.g. Nashville, TN"
                className="text-sm h-11 sm:h-9"
                disabled={settingsLoading}
                autoComplete="off"
              />
              {cityAutocompleteLoading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
              {cityDropdownOpen && cityPredictions.length > 0 && (
                <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
                  <ul className="py-1">
                    {cityPredictions.map((p) => (
                      <li key={p.place_id}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground [transition:background-color_150ms_var(--ease-out),color_150ms_var(--ease-out)]"
                          onMouseDown={(e) => {
                            e.preventDefault(); // prevent blur before click
                            selectCityPrediction(p.description);
                          }}
                        >
                          {p.description}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
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

      {/* ── Email Forwarding (full width) ── */}
      <div id="email-forwarding" className="rounded-lg border bg-card p-4 sm:p-6 space-y-4">
        <div>
          <h2 className="font-medium text-foreground mb-1 flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email Forwarding
          </h2>
          <p className="text-sm text-muted-foreground">
            Forward any venue advance email to this address and Advance will automatically queue it for review.
          </p>
        </div>

        {settingsLoading ? (
          <div className="h-10 rounded-md bg-muted animate-pulse" />
        ) : forwardingAddress ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <code className="flex-1 rounded-md border bg-muted/40 px-3 py-2 font-mono text-sm truncate">
              {forwardingAddress}
            </code>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-11 sm:h-9 shrink-0"
              onClick={copyForwardingAddress}
            >
              <Copy className="h-3.5 w-3.5" />
              Copy
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No forwarding address provisioned yet.</p>
        )}

        <Separator />

        <div>
          <p className="label-small mb-2">recent inbound emails</p>
          {recentInboundEvents.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Mail className="h-7 w-7 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Forwarded emails will appear here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentInboundEvents.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {e.email_subject || "(no subject)"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {e.from_address || "unknown sender"} · {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <Badge
                    variant={
                      e.status === "pending" ? "default"
                      : e.status === "reviewed" ? "secondary"
                      : "outline"
                    }
                    className="text-[10px] px-1.5 py-0 shrink-0 capitalize"
                  >
                    {e.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Band Documents (full width) ── */}
      <BandDocuments />

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
          <div className="space-y-2 stagger-list">
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
                        onClick={() => setPendingRemovePartyId(m.id)}
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
                  onClick={() => setPendingRemoveMemberId(m.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>

        {invites.length > 0 && (
          <div className="space-y-2">
            <p className="label-small">pending invites</p>
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

      <AlertDialog open={slackDisconnectOpen} onOpenChange={setSlackDisconnectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Slack?</AlertDialogTitle>
            <AlertDialogDescription>
              Day sheets can no longer be pushed to Slack until you reconnect.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                disconnectSlackMutation.mutate();
                setSlackDisconnectOpen(false);
              }}
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!pendingRemovePartyId}
        onOpenChange={(open) => { if (!open) setPendingRemovePartyId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove party member?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes them from your touring party. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingRemovePartyId) deletePartyMutation.mutate(pendingRemovePartyId);
                setPendingRemovePartyId(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!pendingRemoveMemberId}
        onOpenChange={(open) => { if (!open) setPendingRemoveMemberId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove team member?</AlertDialogTitle>
            <AlertDialogDescription>
              They will lose access to this team. You can re-invite them later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingRemoveMemberId) removeMemberMutation.mutate(pendingRemoveMemberId);
                setPendingRemoveMemberId(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
