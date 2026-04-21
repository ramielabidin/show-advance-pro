import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Trash2, Save, X, Loader2, MapPin, MoreHorizontal, Send, CheckCircle2, Circle, Clock, Sparkles, Mic, DollarSign, Ticket, Users, TrendingUp, Plus, Check } from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import { format, parseISO, differenceInDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/components/TeamProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import FieldGroup from "@/components/FieldGroup";
import FieldRow from "@/components/FieldRow";
import Eyebrow from "@/components/Eyebrow";
import StatTile from "@/components/StatTile";
import DriveTimeCallout from "@/components/DriveTimeCallout";
import { Card } from "@/components/ui/card";
import SlackPushDialog from "@/components/SlackPushDialog";
import EmailBandDialog from "@/components/EmailBandDialog";
import ParseAdvanceForShowDialog from "@/components/ParseAdvanceForShowDialog";
import EmailAttachments from "@/components/EmailAttachments";
import ExportPdfDialog from "@/components/ExportPdfDialog";
import CopyGuestLinkButton, { GuestLinkMenuItems } from "@/components/CopyGuestLinkButton";
import GuestListEditor, { GuestListView, parseGuestList, guestTotal, parseComps } from "@/components/GuestListEditor";
import ScheduleEditor, { type ScheduleRow } from "@/components/ScheduleEditor";
import EmptyFieldPrompt from "@/components/EmptyFieldPrompt";
import { toast } from "sonner";
import { cn, formatCityState, normalizePhone } from "@/lib/utils";
import { normalizeTime } from "@/lib/timeFormat";
import TimeInput from "@/components/TimeInput";
import type { Show } from "@/lib/types";
import RevenueSimulator, { parseDollar } from "@/components/RevenueSimulator";

/**
 * Format a raw dollar string for display. Only reformats plain numbers
 * (e.g. "3000" → "$3,000", "18.50" → "$18.50"). Complex strings like
 * "$500 vs 80% of gross" are returned unchanged.
 */
function formatCurrency(raw: string): string {
  const stripped = raw.replace(/[\s$,]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(stripped)) return raw;
  const num = parseFloat(stripped);
  if (isNaN(num)) return raw;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: num % 1 !== 0 ? 2 : 0,
  }).format(num);
}

export default function ShowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { teamId } = useTeam();

  const [viewTab, setViewTab] = useState<"show" | "deal">("show");

  // Inline edit: which field key is currently being edited (null = none)
  const [inlineField, setInlineField] = useState<string | null>(null);
  const [inlineValue, setInlineValue] = useState<string>("");
  const inlineRef = useRef<HTMLDivElement>(null);
  const inlineTimeFormat = useRef(false);
  const scheduleRef = useRef<HTMLDivElement>(null);

  const [lookingUpAddress, setLookingUpAddress] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [driveCardDismissed, setDriveCardDismissed] = useState(() =>
    id ? localStorage.getItem(`drive-card-dismissed-${id}`) === "true" : false
  );
  const [suggestionDismissed, setSuggestionDismissed] = useState(() =>
    id ? localStorage.getItem(`departure-suggestion-dismissed-${id}`) === "true" : false
  );
  const [dealTabSeen, setDealTabSeen] = useState(() =>
    id ? localStorage.getItem(`deal-tab-seen-${id}`) === "true" : true
  );

  // Settle modal state
  const [settleOpen, setSettleOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [clearSettleOpen, setClearSettleOpen] = useState(false);
  // When the advance hasn't been imported, the Show Info tab shows a CTA card.
  // The user can click "or fill in manually" to bypass the CTA and see the
  // normal field layout without waiting for a parsed advance.
  const [showManualForm, setShowManualForm] = useState(false);
  const [settleForm, setSettleForm] = useState({
    actual_tickets_sold: "",
    actual_walkout: "",
    settlement_notes: "",
  });

  // Generic form state shared across group editors (only one group is active at a time,
  // gated by inlineField). Keyed by show column name.
  const [groupForm, setGroupForm] = useState<Record<string, string>>({});

  // Backend deal structured form state
  const [backendDealForm, setBackendDealForm] = useState<{
    pct: string;
    basis: "GBOR" | "NBOR";
    dealType: "vs" | "plus";
    tier2Pct: string;
    tier2Threshold: string;
    showTierRow: boolean;
  }>({ pct: "", basis: "GBOR", dealType: "vs", tier2Pct: "", tier2Threshold: "", showTierRow: false });

  const { data: show, isLoading } = useQuery({
    queryKey: ["show", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shows")
        .select("*, schedule_entries(*), tours(*)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // ── Drive-time: app settings (for home base city) ──
  const { data: appSettings } = useQuery({
    queryKey: ["app-settings", teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("home_base_city")
        .eq("team_id", teamId!)
        .limit(1)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!teamId,
  });

  // ── Drive-time: previous show in the same tour ──
  const { data: previousShow } = useQuery({
    queryKey: ["previous-show-in-tour", (show as any)?.tour_id, show?.date, show?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shows")
        .select("id, city, venue_name, venue_address, date")
        .eq("tour_id", (show as any).tour_id)
        .lt("date", show!.date)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!show && !!(show as any).tour_id,
  });

  // Departure origin = previous show's city if ≤3 days ago (band still on road), else home base
  const departureOrigin = useMemo(() => {
    if (previousShow?.city && show?.date) {
      const dayGap = differenceInDays(parseISO(show.date), parseISO(previousShow.date));
      if (dayGap <= 3) {
        return { label: previousShow.city, query: previousShow.venue_address || previousShow.city };
      }
    }
    const home = appSettings?.home_base_city?.trim();
    if (home) {
      return { label: home, query: home };
    }
    return null;
  }, [previousShow, appSettings, show]);

  // Destination = current show's venue address or city
  const destinationQuery = useMemo(() => {
    if (!show) return null;
    return show.venue_address || `${show.venue_name}, ${show.city}`;
  }, [show]);

  // ── Drive-time: call edge function ──
  const { data: driveTime } = useQuery({
    queryKey: ["drive-time", departureOrigin?.query, destinationQuery],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("calculate-drive-time", {
        body: { origin: departureOrigin!.query, destination: destinationQuery! },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as {
        duration_seconds: number;
        duration_text: string;
        distance_text?: string;
      };
    },
    enabled: !!departureOrigin && !!destinationQuery,
    staleTime: 1000 * 60 * 60, // 1 hour
    retry: false,
  });

  // Parse load-in time from schedule entries into minutes since midnight
  const loadInMinutes = useMemo(() => {
    const entries = (show as any)?.schedule_entries ?? [];
    const loadIn = entries.find((e: any) => /load\s*-?\s*in/i.test(e.label));
    if (!loadIn?.time) return null;
    const match = (loadIn.time as string).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!match) return null;
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const ampm = match[3]?.toUpperCase();
    if (ampm === "PM" && hours < 12) hours += 12;
    if (ampm === "AM" && hours === 12) hours = 0;
    // No AM/PM given — load-in is almost always afternoon; assume PM when hour < 8
    if (!ampm && hours < 8) hours += 12;
    return hours * 60 + minutes;
  }, [show]);

  // Recommended departure = load-in - drive - 45min buffer
  const recommendedDeparture = useMemo(() => {
    if (loadInMinutes == null || !driveTime?.duration_seconds) return null;
    const driveMin = Math.round(driveTime.duration_seconds / 60);
    const mins = loadInMinutes - driveMin - 45;
    if (mins < 0) return null;
    const h24 = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    const ampm = h24 >= 12 ? "PM" : "AM";
    const h12 = ((h24 + 11) % 12) + 1;
    return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
  }, [loadInMinutes, driveTime]);

  // Formatted drive duration: "X hr Y min"
  const driveTimeLabel = useMemo(() => {
    if (!driveTime?.duration_seconds) return null;
    const totalMin = Math.round(driveTime.duration_seconds / 60);
    const hrs = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    if (hrs === 0) return `${mins} min`;
    if (mins === 0) return `${hrs} hr`;
    return `${hrs} hr ${mins} min`;
  }, [driveTime]);

  // Scroll inline editor into view
  useEffect(() => {
    if (inlineField && inlineRef.current) {
      inlineRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [inlineField]);

  // Silently mark the show as reviewed on first visit. Drives the "New" badge
  // on show cards — visiting the detail page counts as acknowledgement.
  const autoReviewedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!id || !show || show.is_reviewed || autoReviewedRef.current === id) return;
    autoReviewedRef.current = id;
    supabase
      .from("shows")
      .update({ is_reviewed: true })
      .eq("id", id)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["shows"] });
        queryClient.invalidateQueries({ queryKey: ["show", id] });
      });
  }, [id, show, queryClient]);

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Show>) => {
      const { schedule_entries, show_party_members, tours, ...showUpdates } = updates as any;
      if (showUpdates.tour_id === "" || showUpdates.tour_id === "none") showUpdates.tour_id = null;
      const { error } = await supabase.from("shows").update(showUpdates).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["show", id] });
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      setEditingSchedule(false);
      setInlineField(null);
      toast.success("Show updated");
    },
    onError: () => toast.error("Failed to update show"),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("shows").delete().eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      navigate("/");
      toast.success("Show deleted");
    },
  });

  const settleMutation = useMutation({
    mutationFn: async (values: { actual_tickets_sold: string; actual_walkout: string; settlement_notes: string }) => {
      const { error } = await supabase.from("shows").update({
        is_settled: true,
        actual_tickets_sold: values.actual_tickets_sold || null,
        actual_walkout: values.actual_walkout || null,
        settlement_notes: values.settlement_notes || null,
      } as any).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["show", id] });
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      queryClient.invalidateQueries({ queryKey: ["tours"] });
      setSettleOpen(false);
      toast.success("Show settled");
    },
    onError: () => toast.error("Failed to settle show"),
  });

  const toggleAdvancedMutation = useMutation({
    mutationFn: async (nextAdvanced: boolean) => {
      const { error } = await supabase.from("shows").update({
        advanced_at: nextAdvanced ? new Date().toISOString() : null,
      } as any).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: (_data, nextAdvanced) => {
      queryClient.invalidateQueries({ queryKey: ["show", id] });
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      queryClient.invalidateQueries({ queryKey: ["tours"] });
      toast.success(nextAdvanced ? "Show marked as advanced" : "Marked as not advanced");
    },
    onError: () => toast.error("Failed to update advance status"),
  });

  const unsettleMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("shows").update({
        is_settled: false,
        actual_tickets_sold: null,
        actual_walkout: null,
        settlement_notes: null,
      } as any).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["show", id] });
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      queryClient.invalidateQueries({ queryKey: ["tours"] });
      toast.success("Settlement cleared");
    },
    onError: () => toast.error("Failed to clear settlement"),
  });

  if (isLoading) {
    return <div className="space-y-4 animate-pulse"><div className="h-8 w-48 bg-muted rounded" /><div className="h-64 bg-muted rounded-lg" /></div>;
  }

  if (!show) {
    return <div className="text-center py-20 text-muted-foreground">Show not found</div>;
  }

  // --- Inline edit helpers ---
  const startInlineEdit = (key: string, opts?: { timeFormat?: boolean; structuredTime?: boolean }) => {
    inlineTimeFormat.current = !!opts?.timeFormat;
    setInlineField(key);
    setInlineValue((show as any)[key] ?? "");
  };

  const cancelInline = () => {
    setInlineField(null);
    setInlineValue("");
  };

  const saveInline = () => {
    if (!inlineField) return;
    const val = inlineTimeFormat.current ? normalizeTime(inlineValue) : inlineValue;
    updateMutation.mutate({ [inlineField]: val || null } as any);
  };

  // --- Group editor helpers ---
  // Seed groupForm from the current show and enter edit mode for a named group
  const startGroupEdit = (groupKey: string, keys: (keyof Show)[]) => {
    const seed: Record<string, string> = {};
    for (const k of keys) seed[k as string] = ((show as any)?.[k] ?? "") as string;
    setGroupForm(seed);
    setInlineField(groupKey);
  };

  // Persist a subset of groupForm to the show, applying optional per-field normalizers
  const saveGroup = (
    keys: (keyof Show)[],
    normalizers: Partial<Record<keyof Show, (v: string) => string>> = {},
  ) => {
    const patch: Record<string, string | null> = {};
    for (const k of keys) {
      const raw = groupForm[k as string] ?? "";
      const fn = normalizers[k];
      const val = fn && raw ? fn(raw) : raw;
      patch[k as string] = val || null;
    }
    updateMutation.mutate(patch as any);
  };

  // --- Backend deal structured inline edit ---
  const startBackendDealEdit = () => {
    const raw = show.backend_deal ?? "";
    const pctMatch = raw.match(/(\d{1,3}(?:\.\d+)?)\s*%/);
    const pct = pctMatch ? pctMatch[1] : "";
    const basis: "GBOR" | "NBOR" = /NBOR/i.test(raw) ? "NBOR" : "GBOR";
    const dealType: "vs" | "plus" = /\(plus\)/i.test(raw) ? "plus" : "vs";
    const tierMatch = raw.match(/then\s+(\d{1,3}(?:\.\d+)?)\s*%\s+above\s+(\d+)\s*tickets?/i);
    const tier2Pct = tierMatch ? tierMatch[1] : "";
    const tier2Threshold = tierMatch ? tierMatch[2] : "";
    setBackendDealForm({ pct, basis, dealType, tier2Pct, tier2Threshold, showTierRow: !!tierMatch });
    setInlineField("backend_deal");
  };

  const saveBackendDeal = () => {
    const pctNum = parseFloat(backendDealForm.pct);
    if (!backendDealForm.pct || isNaN(pctNum)) {
      updateMutation.mutate({ backend_deal: null } as any);
      return;
    }
    const pctStr = pctNum % 1 === 0 ? String(Math.round(pctNum)) : String(pctNum);
    const plusTag = backendDealForm.dealType === "plus" ? " (plus)" : "";
    let deal = `${pctStr}% of ${backendDealForm.basis}${plusTag}`;
    const tier2Num = parseFloat(backendDealForm.tier2Pct);
    const thresholdNum = parseInt(backendDealForm.tier2Threshold, 10);
    if (!isNaN(tier2Num) && backendDealForm.tier2Pct.trim() !== "" &&
        !isNaN(thresholdNum) && backendDealForm.tier2Threshold.trim() !== "") {
      const t2Str = tier2Num % 1 === 0 ? String(Math.round(tier2Num)) : String(tier2Num);
      deal += `, then ${t2Str}% above ${thresholdNum} tickets`;
    }
    updateMutation.mutate({ backend_deal: deal } as any);
  };

  const scheduleEntries = show.schedule_entries?.sort((a, b) => a.sort_order - b.sort_order) ?? [];

  // Inline save/cancel buttons component
  const InlineActions = ({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) => (
    <div className="flex items-center gap-1.5 pt-1">
      <Button variant="ghost" size="sm" onClick={onCancel} className="h-7 text-xs">
        <X className="h-3 w-3 mr-1" /> Cancel
      </Button>
      <Button size="sm" onClick={onSave} disabled={updateMutation.isPending} className="h-7 text-xs">
        <Save className="h-3 w-3 mr-1" /> Save
      </Button>
    </div>
  );

  // Compact check button rendered inside an inline-edit input/textarea.
  // onMouseDown prevents the input from blurring first (which would double-fire the save).
  const InlineSaveIcon = ({ onSave, position }: { onSave: () => void; position: "input" | "textarea" }) => (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onSave}
      disabled={updateMutation.isPending}
      aria-label="Save"
      className={cn(
        "absolute h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent [transition:color_150ms_var(--ease-out),background-color_150ms_var(--ease-out)] disabled:opacity-50",
        position === "input" && "right-1.5 top-1/2 -translate-y-1/2",
        position === "textarea" && "right-1.5 bottom-1.5",
      )}
    >
      <Check className="h-3.5 w-3.5" />
    </button>
  );

  // Renders a field with inline edit support only
  const editField = (key: keyof Show, label: string, opts?: { mono?: boolean; multiline?: boolean; alwaysShow?: boolean; timeFormat?: boolean; structuredTime?: boolean; hideTbd?: boolean; phoneFormat?: boolean; placeholder?: string; currency?: boolean; compact?: boolean; labelHidden?: boolean }) => {
    // Inline editing for this specific field
    if (inlineField === key) {
      const handleBlurSave = () => {
        if (!inlineField) return;
        let val = inlineTimeFormat.current ? normalizeTime(inlineValue) : inlineValue;
        if (opts?.currency && val) val = formatCurrency(val);
        if (opts?.phoneFormat && val) val = normalizePhone(val);
        updateMutation.mutate({ [inlineField]: val || null } as any);
      };

      // Structured time picker (departure, changeover)
      if (opts?.structuredTime) {
        return (
          <div ref={inlineRef} className="space-y-2">
            <Label className="text-xs text-muted-foreground">{label}</Label>
            <TimeInput
              value={inlineValue}
              onChange={(val) => setInlineValue(val)}
              autoFocus
              hideTbd={opts?.hideTbd}
            />
            <InlineActions onSave={saveInline} onCancel={cancelInline} />
          </div>
        );
      }

      return (
        <div ref={inlineRef} className="space-y-1">
          <Label className="text-xs text-muted-foreground">{label}</Label>
          {opts?.multiline ? (
            <div className="relative">
              <Textarea
                value={inlineValue}
                onChange={(e) => setInlineValue(e.target.value)}
                className="text-sm min-h-[44px] ring-1 ring-ring/40 pr-10"
                autoFocus
                placeholder={opts?.placeholder}
                onBlur={handleBlurSave}
                onKeyDown={(e) => {
                  if (e.key === "Escape") { e.preventDefault(); cancelInline(); }
                }}
              />
              <InlineSaveIcon onSave={handleBlurSave} position="textarea" />
            </div>
          ) : (
            <div className="relative">
              <Input
                value={inlineValue}
                onChange={(e) => setInlineValue(e.target.value)}
                className={cn("text-sm h-11 sm:h-9 ring-1 ring-ring/40 pr-10", opts?.mono && "font-mono")}
                placeholder={opts?.timeFormat ? "e.g. 9:00 AM or 2:30 PM" : undefined}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); handleBlurSave(); }
                  if (e.key === "Escape") { e.preventDefault(); cancelInline(); }
                }}
                onBlur={handleBlurSave}
              />
              <InlineSaveIcon onSave={handleBlurSave} position="input" />
            </div>
          )}
        </div>
      );
    }

    // View mode
    const value = (show as any)[key];
    if (!value && opts?.alwaysShow) {
      return <EmptyFieldPrompt label={label} onClick={() => startInlineEdit(key, { timeFormat: opts?.timeFormat, structuredTime: opts?.structuredTime })} />;
    }
    if (!value) return null;

    const displayValue = opts?.currency ? formatCurrency(value) : value;

    // Clickable value to enter inline edit
    return (
      <button
        onClick={() => startInlineEdit(key, { timeFormat: opts?.timeFormat, structuredTime: opts?.structuredTime })}
        className="w-full text-left group"
      >
        <FieldRow label={label} value={displayValue} mono={opts?.mono} compact={opts?.compact} noLabel={opts?.labelHidden} />
      </button>
    );
  };

  // Guest list rendering
  const renderGuestList = () => {
    const isInlineGuest = inlineField === "guest_list_details";

    if (isInlineGuest) {
      return (
        <div ref={inlineRef} className="space-y-1">
          <Label className="text-xs text-muted-foreground">Guest List</Label>
          <GuestListEditor
            value={inlineValue}
            capacity={show.venue_capacity}
            compsAllotment={show.artist_comps}
            onChange={(val) => setInlineValue(val)}
            isInline
          />
          <InlineActions onSave={saveInline} onCancel={cancelInline} />
        </div>
      );
    }

    const entries = parseGuestList(show.guest_list_details);
    if (entries.length > 0) {
      return (
        <GuestListView
          value={show.guest_list_details}
          capacity={show.venue_capacity}
          compsAllotment={show.artist_comps}
          onEdit={() => startInlineEdit("guest_list_details")}
        />
      );
    }

    const comps = parseComps(show.artist_comps);
    return (
      <div className="space-y-1.5">
        {comps !== null && (
          <p className="text-xs text-muted-foreground">{comps} comps available</p>
        )}
        <EmptyFieldPrompt label="guest list" onClick={() => startInlineEdit("guest_list_details")} />
      </div>
    );
  };

  return (
    <div className="animate-fade-in max-w-3xl">
      <Tabs
        value={viewTab}
        onValueChange={(v) => {
          const next = v as "show" | "deal";
          setViewTab(next);
          if (next === "deal" && id && !dealTabSeen) {
            localStorage.setItem(`deal-tab-seen-${id}`, "true");
            setDealTabSeen(true);
          }
        }}
      >
      {/* Header */}
      <div className="mb-5 space-y-1.5 sm:space-y-2">
        {/* Back arrow + badges row */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7 -ml-1" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1.5">
            {(show as any).is_settled && (
              <Badge className="text-[10px] uppercase tracking-widest font-medium px-2 py-0 h-5 bg-[hsl(var(--primary))] text-primary-foreground gap-1">
                <CheckCircle2 className="h-2.5 w-2.5" />
                Settled
              </Badge>
            )}
            {(show as any).tours?.name && (
              <Link to={`/shows?view=tour&tourId=${(show as any).tours.id}`}>
                <Badge variant="secondary" className="text-[10px] uppercase tracking-widest font-medium px-2 py-0 h-5 hover:bg-secondary/80 transition-colors">
                  {(show as any).tours.name}
                </Badge>
              </Link>
            )}
          </div>
        </div>

        {/* Eyebrow — date (click to edit) */}
        {inlineField === "date" ? (
          <div ref={inlineRef}>
            <Input
              type="date"
              autoFocus
              value={inlineValue}
              onChange={(e) => setInlineValue(e.target.value)}
              onBlur={() => {
                if (inlineValue && inlineValue !== show.date) {
                  updateMutation.mutate({ date: inlineValue } as any);
                } else {
                  setInlineField(null);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                } else if (e.key === "Escape") {
                  setInlineField(null);
                }
              }}
              className="h-auto py-0 px-1 text-xs w-auto inline-block"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => { setInlineField("date"); setInlineValue(show.date); }}
            className="block text-left hover:text-foreground transition-colors"
          >
            <Eyebrow className="mb-0">
              {format(parseISO(show.date), "MMM d · EEEE")}
            </Eyebrow>
          </button>
        )}

        {/* Venue name — inline editable */}
        {inlineField === "venue_name" ? (
          <div ref={inlineRef}>
            <Input
              autoFocus
              value={inlineValue}
              onChange={(e) => setInlineValue(e.target.value)}
              onBlur={() => {
                if (inlineValue.trim() && inlineValue !== show.venue_name) {
                  updateMutation.mutate({ venue_name: inlineValue.trim() } as any);
                } else {
                  setInlineField(null);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                } else if (e.key === "Escape") {
                  setInlineField(null);
                }
              }}
              className="text-2xl sm:text-3xl font-display font-bold tracking-tight h-auto py-0.5 px-1 -ml-1"
            />
          </div>
        ) : (
          <h1
            className="text-2xl sm:text-3xl font-display font-bold tracking-tight leading-tight cursor-pointer hover:text-primary/80 transition-colors"
            onClick={() => { setInlineField("venue_name"); setInlineValue(show.venue_name); }}
          >
            {show.venue_name}
          </h1>
        )}

        {/* Address row */}
        <div className="text-xs sm:text-sm text-muted-foreground flex flex-wrap items-center gap-x-1.5">
          {show.venue_address ? (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(show.venue_address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:underline hover:text-foreground transition-colors"
            >
              <MapPin className="h-3 w-3 shrink-0" />
              {show.venue_address.replace(/,?\s*United States$/i, "")}
            </a>
          ) : (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              <span>{formatCityState(show.city)}</span>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-xs text-muted-foreground hover:text-foreground h-5 px-1.5"
                disabled={lookingUpAddress}
                onClick={async () => {
                  setLookingUpAddress(true);
                  try {
                    const { data, error } = await supabase.functions.invoke("lookup-venue-address", {
                      body: { venue_name: show.venue_name, city: show.city },
                    });
                    if (error || data?.error) throw new Error(data?.error || error.message);
                    const cleanAddress = (data.address as string).replace(/,?\s*United States$/, "");
                    // Also strip any trailing asterisks from city when confirming the address
                    const cleanCity = show.city?.replace(/\*+$/, "").trim() ?? show.city;
                    const { error: updateError } = await supabase
                      .from("shows")
                      .update({ venue_address: cleanAddress, city: cleanCity })
                      .eq("id", show.id);
                    if (updateError) throw updateError;
                    queryClient.invalidateQueries({ queryKey: ["show", id] });
                    toast.success("Address found and saved");
                  } catch (err: any) {
                    toast.error(err.message || "Could not find address");
                  } finally {
                    setLookingUpAddress(false);
                  }
                }}
              >
                {lookingUpAddress ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                Lookup
              </Button>
            </span>
          )}
        </div>

        {/* Status chips + icon actions — unified mobile + desktop */}
        <div className="pt-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            {/* Advanced chip — instant toggle */}
            {(show as any).advanced_at ? (
              <button
                type="button"
                onClick={() => toggleAdvancedMutation.mutate(false)}
                disabled={toggleAdvancedMutation.isPending}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium shrink-0 transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ backgroundColor: "var(--pastel-green-bg)", color: "var(--pastel-green-fg)" }}
              >
                <CheckCircle2 className="h-3 w-3" /> Advanced
              </button>
            ) : (
              <button
                type="button"
                onClick={() => toggleAdvancedMutation.mutate(true)}
                disabled={toggleAdvancedMutation.isPending}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium shrink-0 bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                <Circle className="h-3 w-3" /> Not advanced
              </button>
            )}

            {/* Settled chip — routes to existing dialogs */}
            {(show as any).is_settled ? (
              <button
                type="button"
                onClick={() => setClearSettleOpen(true)}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium shrink-0 transition-opacity hover:opacity-80"
                style={{ backgroundColor: "var(--pastel-green-bg)", color: "var(--pastel-green-fg)" }}
              >
                <CheckCircle2 className="h-3 w-3" /> Settled
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSettleForm({ actual_tickets_sold: "", actual_walkout: "", settlement_notes: "" });
                  setSettleOpen(true);
                }}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium shrink-0 bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <Circle className="h-3 w-3" /> Not settled
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Share (paper plane) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground">
                  <Send className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <SlackPushDialog showId={id!} show={show as Show} trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Send to Slack</DropdownMenuItem>} />
                <EmailBandDialog show={show as Show} trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Email Band</DropdownMenuItem>} />
                <ExportPdfDialog show={show as Show} trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Export Run of Show</DropdownMenuItem>} />
                <GuestLinkMenuItems
                  showId={id!}
                  linkType="daysheet"
                  copyLabel="Copy Day Sheet Link"
                  regenerateLabel="Regenerate Day Sheet Link"
                />
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Overflow — state-dependent contents */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <ParseAdvanceForShowDialog
                  showId={id!}
                  currentShow={show as Show}
                  onUpdated={() => {
                    queryClient.invalidateQueries({ queryKey: ["show", id] });
                    queryClient.invalidateQueries({ queryKey: ["shows"] });
                  }}
                  trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Import advance</DropdownMenuItem>}
                />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Show
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Underlined text tabs */}
        <div className="pt-3 border-b border-border">
          <TabsList className="h-auto bg-transparent p-0 gap-5 rounded-none">
            <TabsTrigger
              value="show"
              className="relative h-auto px-0 pb-2 rounded-none bg-transparent text-sm font-medium text-muted-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-foreground after:opacity-0 data-[state=active]:after:opacity-100"
            >
              Show Info
            </TabsTrigger>
            <TabsTrigger
              value="deal"
              className="relative h-auto px-0 pb-2 rounded-none bg-transparent text-sm font-medium text-muted-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-foreground after:opacity-0 data-[state=active]:after:opacity-100"
            >
              Deal Info
              {!dealTabSeen && (
                <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground" aria-hidden />
              )}
            </TabsTrigger>
          </TabsList>
        </div>
      </div>

      <TabsContent value="show">
          {!(show as any).advance_imported_at && !showManualForm ? (
            <div className="space-y-6 sm:space-y-8">
              <div className="rounded-lg border border-border bg-card p-6 sm:p-8 text-center animate-fade-in">
                <div className="inline-flex items-center justify-center rounded-full bg-muted p-3 mb-4">
                  <Sparkles className="h-5 w-5 text-muted-foreground" />
                </div>
                <h3 className="font-display text-xl sm:text-2xl text-foreground tracking-tight mb-2">
                  Parse an advance email
                </h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">
                  <Link
                    to="/settings?section=email-forwarding"
                    className="underline underline-offset-2 hover:text-foreground transition-colors"
                  >
                    Forward
                  </Link>
                  {" "}or paste the advance from the promoter. We'll pull the schedule, contacts, tech specs, and hospitality into this show.
                </p>
                <ParseAdvanceForShowDialog
                  showId={id!}
                  currentShow={show as Show}
                  onUpdated={() => {
                    queryClient.invalidateQueries({ queryKey: ["show", id] });
                    queryClient.invalidateQueries({ queryKey: ["shows"] });
                  }}
                  trigger={
                    <Button className="gap-2">
                      Import advance <ArrowRight className="h-4 w-4" />
                    </Button>
                  }
                />
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setShowManualForm(true)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                  >
                    or fill in manually
                  </button>
                </div>
              </div>

              <div className="space-y-2 opacity-50 pointer-events-none select-none">
                <div className="text-[10px] uppercase tracking-widest font-medium text-muted-foreground border-l-2 border-border pl-2">
                  Schedule
                </div>
                <div className="text-sm text-muted-foreground pl-2">Awaiting advance</div>
              </div>
              <div className="space-y-2 opacity-50 pointer-events-none select-none">
                <div className="text-[10px] uppercase tracking-widest font-medium text-muted-foreground border-l-2 border-border pl-2">
                  Contacts
                </div>
                <div className="text-sm text-muted-foreground pl-2">Awaiting advance</div>
              </div>
            </div>
          ) : (
          <div className="space-y-6 sm:space-y-8">
            {/* Drive-time callout — pulled out of Departure so it sits at the top of the show view */}
            {driveTimeLabel && departureOrigin && !driveCardDismissed && (
              <DriveTimeCallout
                driveTimeLabel={driveTimeLabel}
                originLabel={departureOrigin.label}
                distanceText={driveTime?.distance_text}
                onDismiss={() => {
                  if (id) localStorage.setItem(`drive-card-dismissed-${id}`, "true");
                  setDriveCardDismissed(true);
                }}
              />
            )}

            {/* Day of Show Contact + Departure — paired two-column */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              <FieldGroup title="Day of Show Contact" incomplete={!show.dos_contact_name && !show.dos_contact_phone}>
                {(() => {
                  const DOS_KEYS: (keyof Show)[] = ["dos_contact_name", "dos_contact_phone"];
                  const isEditing = inlineField === "dos_group";
                  const empty = !show.dos_contact_name && !show.dos_contact_phone;
                  const startEdit = () => startGroupEdit("dos_group", DOS_KEYS);

                  if (isEditing) {
                    return (
                      <div ref={inlineRef} className="space-y-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Name</Label>
                          <Input
                            value={groupForm.dos_contact_name ?? ""}
                            onChange={(e) => setGroupForm(p => ({ ...p, dos_contact_name: e.target.value }))}
                            className="text-sm h-9"
                            autoFocus
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Phone</Label>
                          <Input
                            value={groupForm.dos_contact_phone ?? ""}
                            onChange={(e) => setGroupForm(p => ({ ...p, dos_contact_phone: e.target.value }))}
                            className="text-sm h-9 font-mono"
                            inputMode="tel"
                          />
                        </div>
                        <InlineActions
                          onSave={() => saveGroup(DOS_KEYS, { dos_contact_phone: normalizePhone })}
                          onCancel={cancelInline}
                        />
                      </div>
                    );
                  }

                  if (empty) {
                    return <EmptyFieldPrompt label="day of show contact" onClick={startEdit} />;
                  }

                  return (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={startEdit}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); startEdit(); }
                      }}
                      className="w-full text-left space-y-2 card-pressable cursor-pointer"
                    >
                      <FieldRow label="Name" value={show.dos_contact_name} compact />
                      <FieldRow label="Phone" value={show.dos_contact_phone} mono compact />
                    </div>
                  );
                })()}
              </FieldGroup>

              <Separator className="md:hidden" />

              <FieldGroup title="Departure" incomplete={!show.departure_time && !show.departure_notes}>
                {(() => {
                  const DEPARTURE_KEYS: (keyof Show)[] = ["departure_time", "departure_notes"];
                  const isEditing = inlineField === "departure_group";
                  const empty = !show.departure_time && !show.departure_notes;
                  const startEdit = () => startGroupEdit("departure_group", DEPARTURE_KEYS);

                if (isEditing) {
                  return (
                    <div ref={inlineRef} className="space-y-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Time</Label>
                        <TimeInput
                          value={groupForm.departure_time ?? ""}
                          onChange={(val) => setGroupForm(p => ({ ...p, departure_time: val }))}
                          autoFocus
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Notes</Label>
                        <Textarea
                          value={groupForm.departure_notes ?? ""}
                          onChange={(e) => setGroupForm(p => ({ ...p, departure_notes: e.target.value }))}
                          className="text-sm min-h-[44px]"
                          placeholder="e.g. Car 1 leaving from hotel at 9am, Car 2 from venue at 9:30am"
                        />
                      </div>
                      <InlineActions
                        onSave={() => saveGroup(DEPARTURE_KEYS, { departure_time: normalizeTime })}
                        onCancel={cancelInline}
                      />
                    </div>
                  );
                }

                if (empty) {
                  return (
                    <>
                      <EmptyFieldPrompt label="departure" onClick={startEdit} />
                      {recommendedDeparture && !driveCardDismissed && !suggestionDismissed && (
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs gap-1.5"
                            onClick={() => updateMutation.mutate({ departure_time: recommendedDeparture } as any)}
                            disabled={updateMutation.isPending}
                          >
                            <Clock className="h-3 w-3" />
                            Use {recommendedDeparture}
                            <span className="text-muted-foreground">· load-in − drive − 45 min</span>
                          </Button>
                          <button
                            type="button"
                            onClick={() => {
                              if (id) localStorage.setItem(`departure-suggestion-dismissed-${id}`, "true");
                              setSuggestionDismissed(true);
                            }}
                            className="shrink-0 h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent [transition:color_150ms_var(--ease-out),background-color_150ms_var(--ease-out)]"
                            aria-label="Dismiss departure suggestion"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </>
                  );
                }

                return (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={startEdit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); startEdit(); }
                    }}
                    className="w-full text-left space-y-2 card-pressable cursor-pointer"
                  >
                    <FieldRow label="Time" value={show.departure_time} mono />
                    <FieldRow label="Notes" value={show.departure_notes} />
                  </div>
                );
              })()}
            </FieldGroup>
            </div>

            <Separator />

            {/* Schedule — full width */}
            <div ref={scheduleRef}>
              <FieldGroup title="Schedule" incomplete={!editingSchedule && scheduleEntries.length === 0}>
                {editingSchedule ? (
                  <ScheduleEditor
                    initial={scheduleEntries.map((e) => ({ time: e.time, label: e.label, is_band: e.is_band }))}
                    onSave={async (rows) => {
                      try {
                        await supabase.from("schedule_entries").delete().eq("show_id", id!);
                        if (rows.length > 0) {
                          const inserts = rows.map((r, i) => ({
                            show_id: id!,
                            time: r.time,
                            label: r.label,
                            is_band: r.is_band,
                            sort_order: i,
                          }));
                          const { error } = await supabase.from("schedule_entries").insert(inserts);
                          if (error) throw error;
                        }
                        queryClient.invalidateQueries({ queryKey: ["show", id] });
                        queryClient.invalidateQueries({ queryKey: ["shows"] });
                        queryClient.invalidateQueries({ queryKey: ["schedule-counts"] });
                        setEditingSchedule(false);
                        toast.success("Schedule updated");
                      } catch {
                        toast.error("Failed to save schedule");
                      }
                    }}
                    onCancel={() => setEditingSchedule(false)}
                    saving={false}
                  />
                ) : scheduleEntries.length > 0 ? (
                  <button onClick={() => setEditingSchedule(true)} className="w-full text-left card-pressable">
                    <Card className="p-3">
                      {scheduleEntries.map((entry, i) => (
                        <div
                          key={entry.id}
                          className={cn(
                            "grid grid-cols-[70px_1fr] gap-3 items-center py-1.5 px-1",
                            i < scheduleEntries.length - 1 && "border-b border-border/60",
                          )}
                        >
                          <span className="font-mono text-sm shrink-0 whitespace-nowrap text-muted-foreground">
                            {entry.time}
                          </span>
                          <span className="text-sm text-foreground inline-flex items-center gap-1.5">
                            {entry.is_band && <Mic className="h-3 w-3 text-muted-foreground shrink-0" />}
                            {entry.label}
                          </span>
                        </div>
                      ))}
                    </Card>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      scheduleRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                      setEditingSchedule(true);
                    }}
                    className="w-full rounded-[10px] border border-dashed border-border px-4 py-5 flex items-center gap-2.5 text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors"
                  >
                    <Plus className="h-4 w-4 shrink-0" />
                    <span className="text-sm">Add schedule items (load-in, doors, set…)</span>
                  </button>
                )}
                {editField("set_length", "Set Length", { alwaysShow: true })}
              </FieldGroup>
            </div>

            {/* Arrival — full width, below schedule */}
            <FieldGroup title="Arrival" incomplete={!show.load_in_details && !show.parking_notes}>
              {(() => {
                const ARRIVAL_KEYS: (keyof Show)[] = ["load_in_details", "parking_notes"];
                const isEditing = inlineField === "arrival_group";
                const empty = !show.load_in_details && !show.parking_notes;
                const startEdit = () => startGroupEdit("arrival_group", ARRIVAL_KEYS);

                if (isEditing) {
                  return (
                    <div ref={inlineRef} className="space-y-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Load In</Label>
                        <Textarea
                          value={groupForm.load_in_details ?? ""}
                          onChange={(e) => setGroupForm(p => ({ ...p, load_in_details: e.target.value }))}
                          className="text-sm min-h-[44px]"
                          autoFocus
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Parking</Label>
                        <Textarea
                          value={groupForm.parking_notes ?? ""}
                          onChange={(e) => setGroupForm(p => ({ ...p, parking_notes: e.target.value }))}
                          className="text-sm min-h-[44px]"
                        />
                      </div>
                      <InlineActions onSave={() => saveGroup(ARRIVAL_KEYS)} onCancel={cancelInline} />
                    </div>
                  );
                }

                if (empty) {
                  return <EmptyFieldPrompt label="arrival (load in / parking)" onClick={startEdit} />;
                }

                return (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={startEdit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); startEdit(); }
                    }}
                    className="w-full text-left space-y-2 card-pressable cursor-pointer"
                  >
                    <FieldRow label="Load In" value={show.load_in_details} />
                    <FieldRow label="Parking" value={show.parking_notes} />
                  </div>
                );
              })()}
            </FieldGroup>

            <Separator />

            {/* At The Venue + Accommodations — paired two-column */}
            <FieldGroup
              title="At The Venue"
              collapsible
              defaultOpen={!!(show.green_room_info || show.wifi_network || show.wifi_password || show.hospitality)}
            >
              {(() => {
                const VENUE_KEYS: (keyof Show)[] = ["green_room_info", "wifi_network", "wifi_password", "hospitality"];
                const isEditing = inlineField === "venue_group";
                const empty = !show.green_room_info && !show.wifi_network && !show.wifi_password && !show.hospitality;
                const startEdit = () => startGroupEdit("venue_group", VENUE_KEYS);

                if (isEditing) {
                  return (
                    <div ref={inlineRef} className="space-y-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Green Room</Label>
                        <Textarea
                          value={groupForm.green_room_info ?? ""}
                          onChange={(e) => setGroupForm(p => ({ ...p, green_room_info: e.target.value }))}
                          className="text-sm min-h-[44px]"
                          autoFocus
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">WiFi Network</Label>
                          <Input
                            value={groupForm.wifi_network ?? ""}
                            onChange={(e) => setGroupForm(p => ({ ...p, wifi_network: e.target.value }))}
                            className="text-sm h-9 font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">WiFi Password</Label>
                          <Input
                            value={groupForm.wifi_password ?? ""}
                            onChange={(e) => setGroupForm(p => ({ ...p, wifi_password: e.target.value }))}
                            className="text-sm h-9 font-mono"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Hospitality</Label>
                        <Textarea
                          value={groupForm.hospitality ?? ""}
                          onChange={(e) => setGroupForm(p => ({ ...p, hospitality: e.target.value }))}
                          className="text-sm min-h-[44px]"
                        />
                      </div>
                      <InlineActions onSave={() => saveGroup(VENUE_KEYS)} onCancel={cancelInline} />
                    </div>
                  );
                }

                if (empty) {
                  return <EmptyFieldPrompt label="venue details" onClick={startEdit} />;
                }

                return (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={startEdit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); startEdit(); }
                    }}
                    className="w-full text-left space-y-2 card-pressable cursor-pointer"
                  >
                    <FieldRow label="Green Room" value={show.green_room_info} />
                    {(show.wifi_network || show.wifi_password) ? (
                      <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
                        <span className="text-sm text-muted-foreground sm:shrink-0 sm:w-32">WiFi</span>
                        <span className="text-sm text-foreground font-mono text-[13px]">
                          {show.wifi_network || "—"} <span className="text-muted-foreground/60 px-1">/</span> {show.wifi_password || "—"}
                        </span>
                      </div>
                    ) : null}
                    <FieldRow label="Hospitality" value={show.hospitality} />
                  </div>
                );
              })()}
            </FieldGroup>

            <Separator />

            <FieldGroup
              title="Accommodations"
              collapsible
              defaultOpen={!!(show.hotel_name || show.hotel_address || show.hotel_confirmation || show.hotel_checkin || show.hotel_checkout)}
            >
              {(() => {
                const hotelEmpty = !show.hotel_name && !show.hotel_address && !show.hotel_confirmation && !show.hotel_checkin && !show.hotel_checkout;
                const isHotelInline = inlineField === "hotel_group";
                const HOTEL_KEYS: (keyof Show)[] = ["hotel_name", "hotel_address", "hotel_confirmation", "hotel_checkin", "hotel_checkout"];
                const startHotelEdit = () => startGroupEdit("hotel_group", HOTEL_KEYS);

                if (isHotelInline) {
                  return (
                    <div ref={inlineRef} className="space-y-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Name</Label>
                        <Input value={groupForm.hotel_name ?? ""} onChange={(e) => setGroupForm(p => ({ ...p, hotel_name: e.target.value }))} className="text-sm h-9" autoFocus />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Address</Label>
                        <Input value={groupForm.hotel_address ?? ""} onChange={(e) => setGroupForm(p => ({ ...p, hotel_address: e.target.value }))} className="text-sm h-9" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Confirmation #</Label>
                        <Input value={groupForm.hotel_confirmation ?? ""} onChange={(e) => setGroupForm(p => ({ ...p, hotel_confirmation: e.target.value }))} className="text-sm h-9 font-mono" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Check In</Label>
                          <Input value={groupForm.hotel_checkin ?? ""} onChange={(e) => setGroupForm(p => ({ ...p, hotel_checkin: e.target.value }))} className="text-sm h-9 font-mono" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Check Out</Label>
                          <Input value={groupForm.hotel_checkout ?? ""} onChange={(e) => setGroupForm(p => ({ ...p, hotel_checkout: e.target.value }))} className="text-sm h-9 font-mono" />
                        </div>
                      </div>
                      <InlineActions onSave={() => saveGroup(HOTEL_KEYS)} onCancel={cancelInline} />
                    </div>
                  );
                }

                if (hotelEmpty) {
                  return <EmptyFieldPrompt label="accommodations" onClick={startHotelEdit} />;
                }

                return (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={startHotelEdit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        startHotelEdit();
                      }
                    }}
                    className="w-full text-left space-y-3 card-pressable cursor-pointer"
                  >
                    <FieldRow label="Name" value={show.hotel_name} />
                    {show.hotel_address ? (
                      <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
                        <span className="text-sm text-muted-foreground sm:shrink-0 sm:w-32">Address</span>
                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(show.hotel_address)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-sm text-foreground inline-flex items-start gap-1 hover:underline hover:text-foreground/80 transition-colors"
                        >
                          <MapPin className="h-3 w-3 shrink-0 mt-1" />
                          <span>{show.hotel_address.replace(/,?\s*United States$/i, "")}</span>
                        </a>
                      </div>
                    ) : null}
                    <FieldRow label="Confirmation #" value={show.hotel_confirmation} mono />
                    {(show.hotel_checkin || show.hotel_checkout) ? (
                      <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
                        <span className="text-sm text-muted-foreground sm:shrink-0 sm:w-32">Check In / Out</span>
                        <span className="text-sm text-foreground font-mono text-[13px]">
                          {show.hotel_checkin || "—"} <span className="text-muted-foreground/60 px-1">→</span> {show.hotel_checkout || "—"}
                        </span>
                      </div>
                    ) : null}
                  </div>
                );
              })()}
            </FieldGroup>

            <Separator />

            <FieldGroup title="Backline" collapsible defaultOpen={!!show.backline_provided}>
              {editField("backline_provided", "Backline", { multiline: true, alwaysShow: true, labelHidden: true, placeholder: "Tap to add backline notes" })}
            </FieldGroup>

            <Separator />

            {/* Guest List */}
            <FieldGroup
              title="Guest List"
              collapsible
              defaultOpen={!!(show.guest_list_details || show.artist_comps)}
              incomplete={!!show.artist_comps && !show.guest_list_details && inlineField !== "guest_list_details"}
            >
              {renderGuestList()}
              <div className="pt-1">
                <CopyGuestLinkButton showId={id!} linkType="guestlist" />
              </div>
            </FieldGroup>

            <Separator />

            <EmailAttachments showId={show.id} />

            {/* Notes — collapsed by default on fresh shows */}
            <FieldGroup title="Notes" collapsible defaultOpen={!!show.additional_info}>
              {editField("additional_info", "Notes", { multiline: true, alwaysShow: true, labelHidden: true, placeholder: "Tap to add notes" })}
            </FieldGroup>
          </div>
          )}
        </TabsContent>

        <TabsContent value="deal">
          <div className="space-y-6 sm:space-y-8">
            {/* Deal — stat tiles for the four primary numerics (click to inline-edit); backend deal + comps below */}
            <FieldGroup title="Deal" incomplete={!show.guarantee && !show.backend_deal && !show.ticket_price && !show.venue_capacity && !show.walkout_potential && !show.artist_comps}>
              {(() => {
                const tiles: Array<{ key: keyof Show; label: string; icon: typeof DollarSign; tone: "blue" | "green" | "yellow"; currency?: boolean; placeholder?: string }> = [
                  { key: "guarantee", label: "Guarantee", icon: DollarSign, tone: "green", currency: true },
                  { key: "ticket_price", label: "Ticket Price", icon: Ticket, tone: "blue", currency: true, placeholder: "e.g. $20 or $18/$20/$25" },
                  { key: "venue_capacity", label: "Capacity", icon: Users, tone: "blue" },
                  { key: "walkout_potential", label: "Walkout Potential", icon: TrendingUp, tone: "yellow", currency: true },
                ];
                const anyEditing = tiles.some(({ key }) => inlineField === key);
                if (anyEditing) {
                  // Single editing field spans full width; other fields continue as tiles below it would crowd the edit — keep it focused.
                  const editing = tiles.find(({ key }) => inlineField === key)!;
                  return (
                    <div>
                      {editField(editing.key, editing.label, { mono: true, alwaysShow: true, currency: editing.currency, placeholder: editing.placeholder })}
                    </div>
                  );
                }
                return (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {tiles.map(({ key, label, icon, tone, currency }) => {
                      const raw = (show as any)[key];
                      if (!raw) {
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => startInlineEdit(key as string)}
                            className="rounded-[10px] border border-dashed border-border px-4 py-3.5 text-left hover:border-foreground/30 transition-colors"
                          >
                            <span className="text-sm italic text-muted-foreground/60">Tap to add {label.toLowerCase()}</span>
                          </button>
                        );
                      }
                      return (
                        <StatTile
                          key={key}
                          icon={icon}
                          tone={tone}
                          label={label}
                          value={currency ? formatCurrency(String(raw)) : String(raw)}
                          onClick={() => startInlineEdit(key as string)}
                        />
                      );
                    })}
                  </div>
                );
              })()}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                {/* Backend Deal — spans full width when editing */}
                <div className={cn(inlineField === "backend_deal" && "sm:col-span-2")}>
                  {(() => {
                    if (inlineField === "backend_deal") {
                      const hasTier = backendDealForm.showTierRow;
                      return (
                        <div ref={inlineRef} className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Backend Deal</Label>

                          {/* Row 1: percentage + GBOR/NBOR + vs/plus */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <Input
                                type="number"
                                min={1}
                                max={100}
                                step={0.5}
                                value={backendDealForm.pct}
                                onChange={(e) => setBackendDealForm(p => ({ ...p, pct: e.target.value }))}
                                className="text-sm h-9 w-20 font-mono text-right ring-1 ring-ring/40"
                                placeholder="70"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") { e.preventDefault(); saveBackendDeal(); }
                                  if (e.key === "Escape") { e.preventDefault(); cancelInline(); }
                                }}
                              />
                              <span className="text-sm text-muted-foreground">% of</span>
                            </div>
                            <div className="flex rounded-md bg-muted p-0.5 text-sm gap-0.5">
                              {(["GBOR", "NBOR"] as const).map((opt) => (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => setBackendDealForm(p => ({ ...p, basis: opt }))}
                                  className={cn(
                                    "px-3 py-1 rounded-sm font-medium [transition:background-color_150ms_var(--ease-out),color_150ms_var(--ease-out)]",
                                    backendDealForm.basis === opt
                                      ? "bg-background text-foreground shadow-sm"
                                      : "text-muted-foreground hover:text-foreground"
                                  )}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                            <div className="flex rounded-md bg-muted p-0.5 text-sm gap-0.5">
                              {(["vs", "plus"] as const).map((opt) => (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => setBackendDealForm(p => ({ ...p, dealType: opt }))}
                                  className={cn(
                                    "px-3 py-1 rounded-sm font-medium [transition:background-color_150ms_var(--ease-out),color_150ms_var(--ease-out)]",
                                    backendDealForm.dealType === opt
                                      ? "bg-background text-foreground shadow-sm"
                                      : "text-muted-foreground hover:text-foreground"
                                  )}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Row 2: optional escalating tier */}
                          {hasTier ? (
                            <div className="flex items-center gap-1.5 flex-wrap text-sm text-muted-foreground">
                              <span>then</span>
                              <Input
                                type="number"
                                min={1}
                                max={100}
                                step={0.5}
                                value={backendDealForm.tier2Pct}
                                onChange={(e) => setBackendDealForm(p => ({ ...p, tier2Pct: e.target.value }))}
                                className="text-sm h-8 w-16 font-mono text-right"
                                placeholder="75"
                              />
                              <span>% above</span>
                              <Input
                                type="number"
                                min={1}
                                step={1}
                                value={backendDealForm.tier2Threshold}
                                onChange={(e) => setBackendDealForm(p => ({ ...p, tier2Threshold: e.target.value }))}
                                className="text-sm h-8 w-24 font-mono text-right"
                                placeholder="200"
                              />
                              <span>tickets</span>
                              <button
                                type="button"
                                onClick={() => setBackendDealForm(p => ({ ...p, tier2Pct: "", tier2Threshold: "", showTierRow: false }))}
                                className="text-xs text-muted-foreground hover:text-destructive ml-1"
                              >
                                Remove
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setBackendDealForm(p => ({ ...p, showTierRow: true }))}
                              className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                            >
                              + Add escalating tier
                            </button>
                          )}

                          <InlineActions onSave={saveBackendDeal} onCancel={cancelInline} />
                        </div>
                      );
                    }
                    if (show.backend_deal) {
                      return (
                        <button onClick={startBackendDealEdit} className="w-full text-left group">
                          <FieldRow label="Backend Deal" value={show.backend_deal} />
                        </button>
                      );
                    }
                    return <EmptyFieldPrompt label="backend deal" onClick={startBackendDealEdit} />;
                  })()}
                </div>
                <div>{editField("artist_comps", "Artist Comps", { alwaysShow: true })}</div>
              </div>
            </FieldGroup>

            {/* Revenue Simulator */}
            {(() => {
              const wp = parseDollar(show.walkout_potential);
              const tp = parseDollar(show.ticket_price);
              const g = parseDollar(show.guarantee) ?? 0;
              // Strip commas only (not dots), so parseInt naturally truncates at the decimal point
              // e.g. "430.0" → parseInt → 430, not 4300
              const cap = show.venue_capacity ? parseInt(show.venue_capacity.replace(/,/g, ""), 10) : null;
              const validCap = cap != null && !isNaN(cap) ? cap : null;
              const canSimulate = wp !== null || (tp != null && tp > 0 && validCap != null);
              if (g === 0 && !canSimulate) return null;
              return (
                <>
                  <Separator />
                  <FieldGroup title="Revenue Simulator">
                    {canSimulate ? (
                      <RevenueSimulator
                        guarantee={g}
                        walkoutPotential={wp ?? 0}
                        venueCapacity={validCap}
                        ticketPrice={tp}
                        backendDeal={show.backend_deal}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Add a <span className="font-medium text-foreground">walkout potential</span> or both <span className="font-medium text-foreground">ticket price</span> and <span className="font-medium text-foreground">capacity</span> to simulate projected revenue.
                      </p>
                    )}
                  </FieldGroup>
                </>
              );
            })()}

            {/* Settlement Results — shown when settled */}
            {(show as any).is_settled && (
              <>
                <Separator />
                <FieldGroup title="Settlement Results">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Actual Walkout</p>
                      <p className="text-lg font-semibold font-mono text-[hsl(var(--success))]">
                        {(show as any).actual_walkout || "—"}
                      </p>
                      {show.walkout_potential && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Projected: {show.walkout_potential}
                        </p>
                      )}
                    </div>
                    {(show as any).actual_tickets_sold && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Actual Tickets Sold</p>
                        <p className="text-lg font-semibold font-mono">
                          {(show as any).actual_tickets_sold}
                        </p>
                        {show.venue_capacity && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Capacity: {show.venue_capacity}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  {(show as any).settlement_notes && (
                    <div className="mt-3">
                      <p className="text-xs text-muted-foreground mb-0.5">Notes</p>
                      <p className="text-sm whitespace-pre-wrap">{(show as any).settlement_notes}</p>
                    </div>
                  )}
                </FieldGroup>
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Settle Show Modal */}
      <Dialog open={settleOpen} onOpenChange={setSettleOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Settle Show</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="actual_tickets_sold">Actual Tickets Sold</Label>
              <Input
                id="actual_tickets_sold"
                value={settleForm.actual_tickets_sold}
                onChange={(e) => setSettleForm((p) => ({ ...p, actual_tickets_sold: e.target.value }))}
                placeholder={show.venue_capacity ? `Capacity: ${show.venue_capacity}` : "e.g. 450"}
                className="h-11 sm:h-9"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="actual_walkout">Final Walkout Amount</Label>
              <Input
                id="actual_walkout"
                value={settleForm.actual_walkout}
                onChange={(e) => setSettleForm((p) => ({ ...p, actual_walkout: e.target.value }))}
                placeholder={show.walkout_potential ? `Projected: ${show.walkout_potential}` : "e.g. $4,200"}
                className="h-11 sm:h-9 font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settlement_notes">Notes</Label>
              <Textarea
                id="settlement_notes"
                value={settleForm.settlement_notes}
                onChange={(e) => setSettleForm((p) => ({ ...p, settlement_notes: e.target.value }))}
                placeholder="Any notes about the settlement…"
                className="min-h-[80px]"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="ghost" className="flex-1 h-11 sm:h-9" onClick={() => setSettleOpen(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1 h-11 sm:h-9 bg-[hsl(var(--success))] hover:bg-[hsl(var(--success)/0.9)] text-[hsl(var(--success-foreground))]"
                onClick={() => settleMutation.mutate(settleForm)}
                disabled={settleMutation.isPending}
              >
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                {settleMutation.isPending ? "Settling…" : "Settle Show"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Show confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this show?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <span className="font-medium text-foreground">{show.venue_name}</span> and
              its schedule. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate()}
            >
              Delete show
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear settlement confirmation */}
      <AlertDialog open={clearSettleOpen} onOpenChange={setClearSettleOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear settlement data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the actual walkout, ticket count and settlement notes. You can re-settle the show
              anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => unsettleMutation.mutate()}>
              Clear settlement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
