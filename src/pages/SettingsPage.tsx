import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, UserPlus, Trash2, Crown, Plus, Pencil, X, Users, Loader2, Music, Copy, Mail, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/components/TeamProvider";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import PageTitle from "@/components/PageTitle";
import SectionLabel from "@/components/SectionLabel";
import Eyebrow from "@/components/Eyebrow";
import Chip from "@/components/Chip";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import BandDocuments from "@/components/BandDocuments";
import type { Song } from "@/lib/types";
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

const TAB_KEYS = ["general", "integrations", "documents", "party", "songs", "team"] as const;
type TabKey = (typeof TAB_KEYS)[number];
const isTabKey = (v: string | null): v is TabKey =>
  !!v && (TAB_KEYS as readonly string[]).includes(v);

interface PartyMemberForm {
  name: string;
  email: string;
  phone: string;
  role: string;
}

const emptyPartyForm: PartyMemberForm = { name: "", email: "", phone: "", role: "" };

function initialsFor(source: string): string {
  const trimmed = source.trim();
  if (!trimmed) return "?";
  const local = trimmed.includes("@") ? trimmed.split("@")[0] : trimmed;
  const parts = local.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return trimmed.slice(0, 2).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

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

  // Song catalog state
  const [songAdding, setSongAdding] = useState(false);
  const [songEditingId, setSongEditingId] = useState<string | null>(null);
  const [songDraft, setSongDraft] = useState("");
  const [pendingRemoveSongId, setPendingRemoveSongId] = useState<string | null>(null);

  // Confirmation state
  const [slackDisconnectOpen, setSlackDisconnectOpen] = useState(false);
  const [pendingRemovePartyId, setPendingRemovePartyId] = useState<string | null>(null);
  const [pendingRemoveMemberId, setPendingRemoveMemberId] = useState<string | null>(null);

  // Team identity (the business/account name, distinct from the artist name).
  // Falls back to the artist name when unset.
  const [teamName, setTeamName] = useState("");
  useEffect(() => {
    setTeamName(team?.team_name ?? "");
  }, [team?.team_name]);

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
        .select("id, email_subject, from_address, status, created_at, reviewed_show_id")
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

  const [searchParams, setSearchParams] = useSearchParams();

  const [tab, setTab] = useState<TabKey>(() => {
    const qs = new URLSearchParams(window.location.search);
    if (qs.get("slack")) return "integrations";
    if (qs.get("section") === "email-forwarding") return "integrations";
    const fromTab = qs.get("tab");
    return isTabKey(fromTab) ? fromTab : "general";
  });

  const handleTabChange = (v: string) => {
    if (!isTabKey(v)) return;
    setTab(v);
    // Read from window.location so stale params (e.g. `slack` cleared via
    // replaceState in the OAuth effect below) don't get reintroduced.
    const next = new URLSearchParams(window.location.search);
    next.set("tab", v);
    setSearchParams(next, { replace: true });
  };

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
        .update({
          slack_webhook_url: null,
          slack_channel_name: null,
          slack_team_name: null,
          slack_auto_daysheet_enabled: false,
        })
        .eq("id", existing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-settings", teamId] });
      toast.success("Slack disconnected");
    },
    onError: () => toast.error("Failed to disconnect Slack"),
  });

  // Auto-push day sheet automation. Toggle + time are persisted immediately on
  // change so the Integrations panel feels like the rest of Settings
  // (connect/disconnect actions, no save button).
  const autoPushEnabled = !!appSettings?.slack_auto_daysheet_enabled;
  const autoPushTime = appSettings?.slack_auto_daysheet_time ?? "08:00";

  const updateAutoPushMutation = useMutation({
    mutationFn: async (patch: { enabled?: boolean; time?: string }) => {
      const { data: existing } = await supabase
        .from("app_settings")
        .select("id")
        .eq("team_id", teamId!)
        .limit(1)
        .single();
      if (!existing) throw new Error("App settings not found");
      const update: Record<string, unknown> = {};
      if (patch.enabled !== undefined) update.slack_auto_daysheet_enabled = patch.enabled;
      if (patch.time !== undefined) update.slack_auto_daysheet_time = patch.time;
      const { error } = await supabase
        .from("app_settings")
        .update(update)
        .eq("id", existing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-settings", teamId] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to update auto-push"),
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

  // ── Song Catalog ──
  // Typed as a loose client call until `src/integrations/supabase/types.ts`
  // is regenerated after the set_list migration applies.
  const { data: songs = [], isLoading: songsLoading } = useQuery({
    queryKey: ["songs"],
    queryFn: async (): Promise<Song[]> => {
      const { data, error } = await (supabase as any)
        .from("songs")
        .select("*")
        .order("title");
      if (error) throw error;
      return (data ?? []) as Song[];
    },
  });

  const createSongMutation = useMutation({
    mutationFn: async (title: string) => {
      const trimmed = title.trim();
      if (!trimmed) throw new Error("Song title cannot be empty");
      const { error } = await (supabase as any).from("songs").insert({
        title: trimmed,
        team_id: teamId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["songs"] });
      // Keep the input open so the user can rapid-fire add songs.
      // Clearing the draft is enough; the input stays mounted and focused.
      setSongDraft("");
      toast.success("Song added");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateSongMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const trimmed = title.trim();
      if (!trimmed) throw new Error("Song title cannot be empty");
      const { error } = await (supabase as any)
        .from("songs")
        .update({ title: trimmed })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["songs"] });
      setSongEditingId(null);
      setSongDraft("");
      toast.success("Song updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteSongMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("songs")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["songs"] });
      setPendingRemoveSongId(null);
      toast.success("Song removed");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const startSongEdit = (s: Song) => {
    setSongEditingId(s.id);
    setSongDraft(s.title);
    setSongAdding(false);
  };

  const cancelSongEdit = () => {
    setSongEditingId(null);
    setSongAdding(false);
    setSongDraft("");
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

  const saveTeamNameMutation = useMutation({
    mutationFn: async () => {
      const trimmed = teamName.trim();
      const { error } = await supabase
        .from("teams")
        .update({ team_name: trimmed.length > 0 ? trimmed : null })
        .eq("id", teamId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-teams"] });
      toast.success("Team name saved");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to save team name"),
  });

  const inviteMutation = useMutation({
    mutationFn: async (email: string) => {
      const { data: inserted, error } = await supabase
        .from("team_invites")
        .insert({
          team_id: teamId!,
          email: email.toLowerCase().trim(),
          invited_by: session!.user.id,
        })
        .select("id")
        .single();
      if (error) {
        if (error.code === "23505") throw new Error("Already invited");
        throw error;
      }

      const { data: sendData, error: sendError } = await supabase.functions.invoke<{
        success?: boolean;
        error?: string;
      }>("send-team-invite-email", { body: { inviteId: inserted.id } });
      // Row is inserted either way; if the email failed to send, surface it
      // in the toast rather than rolling back (owner can re-send by removing
      // and re-adding). We require an explicit success flag from the function
      // because the Supabase SDK has swallowed gateway-level 401s into a
      // null-error response in the past, causing false "sent" reports.
      const sent = !sendError && sendData?.success === true;
      const sendErrorMessage = sendError?.message ?? sendData?.error;
      return { sent, sendErrorMessage };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["team-invites", teamId] });
      setInviteEmail("");
      if (result.sent) {
        toast.success("Invite sent");
      } else {
        toast.warning("Invite saved, but the email didn't send.");
      }
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
    <div className="animate-fade-in stagger-list mx-auto max-w-[920px] space-y-6 sm:space-y-8">
      <PageTitle subline="Manage your artist profile and integrations">Settings</PageTitle>

      <Tabs value={tab} onValueChange={handleTabChange}>
        <div className="border-b border-border overflow-x-auto">
          <TabsList className="h-auto bg-transparent p-0 gap-5 rounded-none flex-nowrap">
            <TabsTrigger value="general" className="relative h-auto px-0 pb-2 rounded-none bg-transparent text-sm font-medium text-muted-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-foreground after:opacity-0 data-[state=active]:after:opacity-100">General</TabsTrigger>
            <TabsTrigger value="integrations" className="relative h-auto px-0 pb-2 rounded-none bg-transparent text-sm font-medium text-muted-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-foreground after:opacity-0 data-[state=active]:after:opacity-100">Integrations</TabsTrigger>
            <TabsTrigger value="documents" className="relative h-auto px-0 pb-2 rounded-none bg-transparent text-sm font-medium text-muted-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-foreground after:opacity-0 data-[state=active]:after:opacity-100">Documents</TabsTrigger>
            <TabsTrigger value="party" className="relative h-auto px-0 pb-2 rounded-none bg-transparent text-sm font-medium text-muted-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-foreground after:opacity-0 data-[state=active]:after:opacity-100">Touring Party</TabsTrigger>
            <TabsTrigger value="songs" className="relative h-auto px-0 pb-2 rounded-none bg-transparent text-sm font-medium text-muted-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-foreground after:opacity-0 data-[state=active]:after:opacity-100">Songs</TabsTrigger>
            <TabsTrigger value="team" className="relative h-auto px-0 pb-2 rounded-none bg-transparent text-sm font-medium text-muted-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-foreground after:opacity-0 data-[state=active]:after:opacity-100">Team</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="general" className="mt-6 sm:mt-8 space-y-6 sm:space-y-8">

      {/* ── Active Artist ── */}
      <section>
        <SectionLabel>Active artist</SectionLabel>
        <div className="rounded-lg border bg-card p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
                <Music className="h-5 w-5 text-muted-foreground" />
              </div>
              <span className="text-xl font-semibold tracking-tight text-foreground truncate">{team?.name}</span>
            </div>
            <Chip tone={isOwner ? "blue" : "muted"}>
              {isOwner ? <><Crown className="h-3 w-3" />Owner</> : "Member"}
            </Chip>
          </div>
        </div>
      </section>

      {/* ── Home base ── */}
      <section>
        <SectionLabel>Home base</SectionLabel>
        <div className="rounded-lg border bg-card p-4 sm:p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
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
                            e.preventDefault();
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
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || settingsLoading}
            className="gap-1.5 w-full sm:w-auto h-11 sm:h-9"
          >
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </section>

        </TabsContent>

        <TabsContent value="integrations" className="mt-6 sm:mt-8 space-y-6 sm:space-y-8">

      {/* ── Integrations ── */}
      <section>
        <SectionLabel>Integrations</SectionLabel>
        <div className="space-y-3">
          {/* Slack */}
          <div className="rounded-lg border bg-card p-4 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-medium text-foreground">Slack</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Push day sheets directly to a channel.</p>
              </div>
              <Chip tone={appSettings?.slack_webhook_url ? "green" : "muted"}>
                {appSettings?.slack_webhook_url ? "Connected" : "Not connected"}
              </Chip>
            </div>
            {settingsLoading ? (
              <div className="h-10 rounded-md bg-muted animate-pulse" />
            ) : appSettings?.slack_webhook_url ? (
              <>
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

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Label
                        htmlFor="slack-auto-daysheet"
                        className="text-sm font-medium text-foreground cursor-pointer"
                      >
                        Auto-push day sheet
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Post the day sheet to Slack on the morning of each show.
                      </p>
                    </div>
                    <Switch
                      id="slack-auto-daysheet"
                      checked={autoPushEnabled}
                      disabled={updateAutoPushMutation.isPending}
                      onCheckedChange={(checked) =>
                        updateAutoPushMutation.mutate({ enabled: checked })
                      }
                    />
                  </div>

                  {autoPushEnabled && (
                    <div className="flex items-center justify-between gap-3 pl-0">
                      <div className="min-w-0">
                        <Label
                          htmlFor="slack-auto-daysheet-time"
                          className="text-sm text-foreground cursor-pointer flex items-center gap-1.5"
                        >
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          Push time
                        </Label>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Uses each show's local timezone.
                        </p>
                      </div>
                      <Input
                        id="slack-auto-daysheet-time"
                        type="time"
                        step={300}
                        defaultValue={autoPushTime}
                        disabled={updateAutoPushMutation.isPending}
                        onBlur={(e) => {
                          const next = e.target.value;
                          if (next && /^\d{2}:\d{2}$/.test(next) && next !== autoPushTime) {
                            updateAutoPushMutation.mutate({ time: next });
                          }
                        }}
                        className="w-auto h-9"
                      />
                    </div>
                  )}
                </div>
              </>
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

          {/* Email forwarding */}
          <div id="email-forwarding" className="rounded-lg border bg-card p-4 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email forwarding
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Forward venue advances to auto-queue them for review.
                </p>
              </div>
              <Chip tone={forwardingAddress ? "green" : "muted"}>
                {forwardingAddress ? "Active" : "Not provisioned"}
              </Chip>
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
              <Eyebrow>Recent inbound emails</Eyebrow>
              {recentInboundEvents.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Mail className="h-7 w-7 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Forwarded emails will appear here.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentInboundEvents.map((e) => {
                    const linkTo =
                      e.status === "reviewed" && e.reviewed_show_id
                        ? `/shows/${e.reviewed_show_id}`
                        : null;
                    const rowClass = cn(
                      "flex items-center justify-between rounded-md border px-3 py-2 gap-2",
                      linkTo &&
                        "hover:bg-accent/40 hover:border-border [transition:background-color_150ms_var(--ease-out),border-color_150ms_var(--ease-out)]",
                    );
                    const inner = (
                      <>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">
                            {e.email_subject || "(no subject)"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {e.from_address || "unknown sender"} · {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                          </p>
                        </div>
                        <Chip
                          tone={
                            e.status === "pending" ? "yellow"
                            : e.status === "reviewed" ? "green"
                            : "muted"
                          }
                          className="capitalize"
                        >
                          {e.status}
                        </Chip>
                      </>
                    );
                    return linkTo ? (
                      <Link key={e.id} to={linkTo} className={rowClass}>
                        {inner}
                      </Link>
                    ) : (
                      <div key={e.id} className={rowClass}>
                        {inner}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

        </TabsContent>

        <TabsContent value="documents" className="mt-6 sm:mt-8 space-y-6 sm:space-y-8">

      {/* ── Band Documents (full width) ── */}
      <BandDocuments />

        </TabsContent>

        <TabsContent value="party" className="mt-6 sm:mt-8 space-y-6 sm:space-y-8">

      {/* ── Touring Party ── */}
      <section>
        <SectionLabel
          action={
            <Dialog open={partyDialogOpen} onOpenChange={setPartyDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Add member</span>
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
          }
        >
          Touring party · {partyMembers.length}
        </SectionLabel>

        <div className="rounded-lg border bg-card overflow-hidden">
          {partyLoading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 rounded-md bg-muted animate-pulse" />
              ))}
            </div>
          ) : partyMembers.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No members yet. Add people to your touring party.</p>
            </div>
          ) : (
            <div className="stagger-list">
              {partyMembers.map((m, i) => {
                const isEditing = partyEditingId === m.id;
                const role = (m as any).role as string | null;
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3",
                      i < partyMembers.length - 1 && "border-b border-border/60",
                    )}
                  >
                    {isEditing ? (
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
                      <>
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-[11px] font-medium text-muted-foreground">
                          {initialsFor(m.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">{m.name}</div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-3 mt-0.5">
                            {m.email && <span className="text-xs text-muted-foreground truncate">{m.email}</span>}
                            {m.phone && <span className="text-xs font-mono text-muted-foreground">{m.phone}</span>}
                          </div>
                        </div>
                        {role && <Chip tone="muted">{role}</Chip>}
                      </>
                    )}
                    <div className="flex items-center gap-1 shrink-0">
                      {isEditing ? (
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
                );
              })}
            </div>
          )}
        </div>
      </section>

        </TabsContent>

        <TabsContent value="songs" className="mt-6 sm:mt-8 space-y-6 sm:space-y-8">

      {/* ── Song Catalog ── */}
      <section>
        <SectionLabel
          action={
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                setSongAdding(true);
                setSongEditingId(null);
                setSongDraft("");
              }}
              disabled={songAdding}
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add song</span>
              <span className="sm:hidden">Add</span>
            </Button>
          }
        >
          Song catalog · {songs.length}
        </SectionLabel>

        <div className="rounded-lg border bg-card overflow-hidden">
          {songAdding && (
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60 bg-muted/30">
              <Input
                autoFocus
                value={songDraft}
                onChange={(e) => setSongDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && songDraft.trim() && !createSongMutation.isPending) {
                    createSongMutation.mutate(songDraft);
                  } else if (e.key === "Escape") {
                    cancelSongEdit();
                  }
                }}
                placeholder="Song title — press Enter to add, Esc to close"
                className="h-9 flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={cancelSongEdit}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => createSongMutation.mutate(songDraft)}
                disabled={!songDraft.trim() || createSongMutation.isPending}
              >
                <Save className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {songsLoading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 rounded-md bg-muted animate-pulse" />
              ))}
            </div>
          ) : songs.length === 0 && !songAdding ? (
            <div className="text-center py-10 text-muted-foreground">
              <Music className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No songs yet. Build your catalog to quickly pick set lists for each show.</p>
            </div>
          ) : (
            <div className="stagger-list max-h-[400px] overflow-y-auto">
              {songs.map((s, i) => {
                const isEditing = songEditingId === s.id;
                return (
                  <div
                    key={s.id}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3",
                      i < songs.length - 1 && "border-b border-border/60",
                    )}
                  >
                    {isEditing ? (
                      <Input
                        autoFocus
                        value={songDraft}
                        onChange={(e) => setSongDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && songDraft.trim()) {
                            updateSongMutation.mutate({ id: s.id, title: songDraft });
                          } else if (e.key === "Escape") {
                            cancelSongEdit();
                          }
                        }}
                        className="h-9 flex-1"
                      />
                    ) : (
                      <div className="flex-1 min-w-0 text-sm text-foreground truncate">
                        {s.title}
                      </div>
                    )}
                    <div className="flex items-center gap-1 shrink-0">
                      {isEditing ? (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={cancelSongEdit}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateSongMutation.mutate({ id: s.id, title: songDraft })}
                            disabled={!songDraft.trim() || updateSongMutation.isPending}
                          >
                            <Save className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startSongEdit(s)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setPendingRemoveSongId(s.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

        </TabsContent>

        <TabsContent value="team" className="mt-6 sm:mt-8 space-y-6 sm:space-y-8">

      {/* ── Team identity ── */}
      <section>
        <SectionLabel>Team name</SectionLabel>
        <div className="rounded-lg border bg-card p-4 sm:p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            The name of your overall account — shown on team-invite emails. Set this when your business name
            differs from your artist name (e.g. <span className="text-foreground">Juice Music, LLC</span> for
            an artist called <span className="text-foreground">Juice</span>). Leave blank to use the artist name
            ({team?.name}).
          </p>
          <div className="space-y-2">
            <Label htmlFor="team-name">Name</Label>
            <Input
              id="team-name"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder={team?.name ?? ""}
              className="text-sm h-11 sm:h-9"
              disabled={!isOwner || saveTeamNameMutation.isPending}
            />
          </div>
          {isOwner && (
            <Button
              onClick={() => saveTeamNameMutation.mutate()}
              disabled={
                saveTeamNameMutation.isPending ||
                teamName.trim() === (team?.team_name ?? "")
              }
              className="gap-1.5 w-full sm:w-auto h-11 sm:h-9"
            >
              <Save className="h-4 w-4" />
              {saveTeamNameMutation.isPending ? "Saving…" : "Save"}
            </Button>
          )}
        </div>
      </section>

      {/* ── Team Members ── */}
      <section className="space-y-4">
        <SectionLabel>
          Team · {teamMembers.length} with login access
        </SectionLabel>

        <div className="rounded-lg border bg-card overflow-hidden">
          {teamMembers.map((m, i) => {
            const isSelf = m.user_id === session?.user.id;
            const email = emailMap[m.user_id] || (isSelf ? session?.user.email ?? undefined : undefined);
            const metadata = isSelf ? session?.user.user_metadata : undefined;
            const selfName =
              typeof metadata?.full_name === "string" ? metadata.full_name :
              typeof metadata?.name === "string" ? metadata.name :
              undefined;
            const avatarUrl =
              typeof metadata?.avatar_url === "string" ? metadata.avatar_url :
              typeof metadata?.picture === "string" ? metadata.picture :
              undefined;
            const display = isSelf ? (selfName ?? "You") : (email || m.user_id.slice(0, 8) + "…");
            return (
              <div
                key={m.id}
                className={cn(
                  "flex items-center gap-3 px-4 py-3",
                  i < teamMembers.length - 1 && "border-b border-border/60",
                )}
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-[11px] font-medium text-muted-foreground">
                    {initialsFor(selfName || email || display)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{display}</div>
                  {isSelf && email && (
                    <div className="text-xs font-mono text-muted-foreground truncate">{email}</div>
                  )}
                </div>
                <Chip tone={m.role === "owner" ? "blue" : "muted"}>
                  {m.role === "owner" ? <><Crown className="h-2.5 w-2.5" />Owner</> : "Member"}
                </Chip>
                {isOwner && !isSelf && (
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
            );
          })}
        </div>

        {invites.length > 0 && (
          <div className="space-y-2">
            <Eyebrow>Pending invites</Eyebrow>
            <div className="rounded-lg border border-dashed overflow-hidden">
              {invites.map((inv, i) => (
                <div
                  key={inv.id}
                  className={cn(
                    "flex items-center justify-between gap-3 px-4 py-3",
                    i < invites.length - 1 && "border-b border-dashed border-border/60",
                  )}
                >
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
              variant="outline"
              className="gap-1.5 shrink-0 h-11 sm:h-9"
              onClick={() => inviteMutation.mutate(inviteEmail)}
              disabled={!inviteEmail.trim() || inviteMutation.isPending}
            >
              <UserPlus className="h-4 w-4" />
              Invite
            </Button>
          </div>
        )}
      </section>

        </TabsContent>
      </Tabs>

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
        open={!!pendingRemoveSongId}
        onOpenChange={(open) => { if (!open) setPendingRemoveSongId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove song?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the song from your catalog. Existing set lists that reference it keep the title.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingRemoveSongId) deleteSongMutation.mutate(pendingRemoveSongId);
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
