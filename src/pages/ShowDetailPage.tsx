import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Trash2, Save, X, Loader2, MapPin, MoreHorizontal, Send, CheckCircle2, Circle, Clock } from "lucide-react";
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
import SlackPushDialog from "@/components/SlackPushDialog";
import EmailBandDialog from "@/components/EmailBandDialog";
import ParseAdvanceForShowDialog from "@/components/ParseAdvanceForShowDialog";
import EmailAttachments from "@/components/EmailAttachments";
import ExportPdfDialog from "@/components/ExportPdfDialog";
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

  // Settle modal state
  const [settleOpen, setSettleOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [clearSettleOpen, setClearSettleOpen] = useState(false);
  const [settleForm, setSettleForm] = useState({
    actual_tickets_sold: "",
    actual_walkout: "",
    settlement_notes: "",
  });

  // Hotel group form state
  const [hotelForm, setHotelForm] = useState<Record<string, string>>({});

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

  // --- Hotel group inline edit ---
  const startHotelEdit = () => {
    setInlineField("hotel_group");
    setHotelForm({
      hotel_name: show.hotel_name ?? "",
      hotel_address: show.hotel_address ?? "",
      hotel_confirmation: show.hotel_confirmation ?? "",
      hotel_checkin: show.hotel_checkin ?? "",
      hotel_checkout: show.hotel_checkout ?? "",
    });
  };

  const saveHotelGroup = () => {
    updateMutation.mutate({
      hotel_name: hotelForm.hotel_name || null,
      hotel_address: hotelForm.hotel_address || null,
      hotel_confirmation: hotelForm.hotel_confirmation || null,
      hotel_checkin: hotelForm.hotel_checkin || null,
      hotel_checkout: hotelForm.hotel_checkout || null,
    } as any);
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

      // Structured time picker (departure, curfew, changeover)
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
            <Textarea
              value={inlineValue}
              onChange={(e) => setInlineValue(e.target.value)}
              className="text-sm min-h-[44px] ring-1 ring-ring/40"
              autoFocus
              placeholder={opts?.placeholder}
              onBlur={handleBlurSave}
              onKeyDown={(e) => {
                if (e.key === "Escape") { e.preventDefault(); cancelInline(); }
              }}
            />
          ) : (
            <Input
              value={inlineValue}
              onChange={(e) => setInlineValue(e.target.value)}
              className={cn("text-sm h-11 sm:h-9 ring-1 ring-ring/40", opts?.mono && "font-mono")}
              placeholder={opts?.timeFormat ? "e.g. 9:00 AM or 2:30 PM" : undefined}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); handleBlurSave(); }
                if (e.key === "Escape") { e.preventDefault(); cancelInline(); }
              }}
              onBlur={handleBlurSave}
            />
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
      <Tabs value={viewTab} onValueChange={v => setViewTab(v as "show" | "deal")}>
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

        {/* Metadata — date · address */}
        <p className="text-xs sm:text-sm text-muted-foreground flex flex-wrap items-center gap-x-1.5">
          {inlineField === "date" ? (
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
              className="h-auto py-0 px-1 text-xs sm:text-sm w-auto inline-block"
            />
          ) : (
            <span
              className="cursor-pointer hover:text-foreground transition-colors"
              onClick={() => { setInlineField("date"); setInlineValue(show.date); }}
            >
              {format(parseISO(show.date), "EEEE, MMMM d, yyyy")}
            </span>
          )}
          <span className="text-border">·</span>
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
        </p>

        {/* Action buttons */}
        <div className="pt-1">
          {/* Desktop */}
          <div className="hidden md:flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
            {/* Primary CTA: Settle Show */}
            {(show as any).is_settled ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-[hsl(var(--success))] hover:text-[hsl(var(--success))] hover:bg-[hsl(var(--success)/0.1)]"
                onClick={() => setClearSettleOpen(true)}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Settled
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-8 text-xs bg-[hsl(var(--success))] hover:bg-[hsl(var(--success)/0.9)] text-[hsl(var(--success-foreground))]"
                onClick={() => {
                  setSettleForm({ actual_tickets_sold: "", actual_walkout: "", settlement_notes: "" });
                  setSettleOpen(true);
                }}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Settle Show
              </Button>
            )}

            {/* Advance toggle — secondary, yellow when needed / green when done */}
            {(show as any).advanced_at ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-[hsl(var(--success))] hover:text-[hsl(var(--success))] hover:bg-[hsl(var(--success)/0.1)]"
                onClick={() => toggleAdvancedMutation.mutate(false)}
                disabled={toggleAdvancedMutation.isPending}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Advanced
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1"
                style={{
                  color: "var(--pastel-yellow-fg)",
                  borderColor: "var(--pastel-yellow-fg)",
                }}
                onClick={() => toggleAdvancedMutation.mutate(true)}
                disabled={toggleAdvancedMutation.isPending}
              >
                <Circle className="h-3.5 w-3.5" /> Mark as advanced
              </Button>
            )}

            <Separator orientation="vertical" className="h-5" />

            {/* Share dropdown: Slack, Email, PDF */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1.5">
                  <Send className="h-3.5 w-3.5" />
                  Share
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <SlackPushDialog showId={id!} show={show as Show} trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Send to Slack</DropdownMenuItem>} />
                <EmailBandDialog show={show as Show} trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Email Band</DropdownMenuItem>} />
                <ExportPdfDialog show={show as Show} trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Export Run of Show</DropdownMenuItem>} />
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Overflow: Import, Delete */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <ParseAdvanceForShowDialog
                  showId={id!}
                  currentShow={show as Show}
                  onUpdated={() => {
                    queryClient.invalidateQueries({ queryKey: ["show", id] });
                    queryClient.invalidateQueries({ queryKey: ["shows"] });
                  }}
                  trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Import Advance</DropdownMenuItem>}
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
            <TabsList>
              <TabsTrigger value="show">Show Info</TabsTrigger>
              <TabsTrigger value="deal">Deal Info</TabsTrigger>
            </TabsList>
          </div>

          {/* Mobile */}
          <div className="flex md:hidden flex-col gap-2">
            {/* Settle Show — prominent, full-width primary action */}
            {(show as any).is_settled ? (
              <Button
                variant="outline"
                className="h-11 w-full text-sm font-medium border-[hsl(var(--success))] text-[hsl(var(--success))] hover:bg-[hsl(var(--success)/0.1)] hover:text-[hsl(var(--success))]"
                onClick={() => setClearSettleOpen(true)}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" /> Settled — Tap to Clear
              </Button>
            ) : (
              <Button
                className="h-11 w-full text-base font-medium bg-[hsl(var(--success))] hover:bg-[hsl(var(--success)/0.9)] text-[hsl(var(--success-foreground))]"
                onClick={() => {
                  setSettleForm({ actual_tickets_sold: "", actual_walkout: "", settlement_notes: "" });
                  setSettleOpen(true);
                }}
              >
                <CheckCircle2 className="h-5 w-5 mr-2" /> Settle Show
              </Button>
            )}

            {/* Advance toggle — secondary */}
            {(show as any).advanced_at ? (
              <Button
                variant="outline"
                className="h-11 w-full text-sm font-medium border-[hsl(var(--success))] text-[hsl(var(--success))] hover:bg-[hsl(var(--success)/0.1)] hover:text-[hsl(var(--success))]"
                onClick={() => toggleAdvancedMutation.mutate(false)}
                disabled={toggleAdvancedMutation.isPending}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" /> Advanced — Tap to Undo
              </Button>
            ) : (
              <Button
                variant="outline"
                className="h-11 w-full text-sm font-medium gap-2"
                style={{
                  color: "var(--pastel-yellow-fg)",
                  borderColor: "var(--pastel-yellow-fg)",
                }}
                onClick={() => toggleAdvancedMutation.mutate(true)}
                disabled={toggleAdvancedMutation.isPending}
              >
                <Circle className="h-4 w-4" /> Mark as advanced
              </Button>
            )}

            {/* Secondary actions: Share + Overflow */}
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-11 flex-1 text-sm font-medium gap-2">
                    <Send className="h-4 w-4" />
                    Share
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <SlackPushDialog showId={id!} show={show as Show} trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Send to Slack</DropdownMenuItem>} />
                  <EmailBandDialog show={show as Show} trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Email Band</DropdownMenuItem>} />
                  <ExportPdfDialog show={show as Show} trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Export Run of Show</DropdownMenuItem>} />
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Overflow: Import, Delete */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-11 w-11 text-muted-foreground hover:text-foreground shrink-0">
                    <MoreHorizontal className="h-5 w-5" />
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
                    trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Import Advance</DropdownMenuItem>}
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
            <TabsList className="w-full">
              <TabsTrigger value="show" className="flex-1">Show Info</TabsTrigger>
              <TabsTrigger value="deal" className="flex-1">Deal Info</TabsTrigger>
            </TabsList>
          </div>
        </div>
      </div>

      {!show.is_reviewed && (
        <div className="border-l-2 border-badge-new pl-3 pr-1 py-2 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <p className="text-sm text-foreground">
            <span className="text-badge-new font-medium">New show</span>
            <span className="text-muted-foreground"> created from advance email — review the details below.</span>
          </p>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={() => updateMutation.mutate({ is_reviewed: true } as any)}
          >
            Mark Reviewed
          </Button>
        </div>
      )}

      <TabsContent value="show">
          <div className="space-y-6 sm:space-y-8">
            {/* Departure — first chronologically */}
            <FieldGroup title="Departure" incomplete={!show.departure_time && !show.departure_notes}>
              {driveTimeLabel && departureOrigin && !driveCardDismissed && (
                <div className="flex items-start gap-4 rounded-md border bg-muted/30 px-4 py-3">
                  <Clock className="h-4 w-4 mt-1 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-2xl text-foreground leading-none tracking-[-0.02em]">
                      {driveTimeLabel}
                    </div>
                    <div className="mt-1 text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
                      from {departureOrigin.label}
                      {driveTime?.distance_text && (
                        <span className="text-border mx-1.5">·</span>
                      )}
                      {driveTime?.distance_text && (
                        <span className="font-mono normal-case tracking-normal">
                          {driveTime.distance_text}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (id) localStorage.setItem(`drive-card-dismissed-${id}`, "true");
                      setDriveCardDismissed(true);
                    }}
                    className="shrink-0 h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent [transition:color_150ms_var(--ease-out),background-color_150ms_var(--ease-out)]"
                    aria-label="Dismiss drive time suggestion"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              {editField("departure_time", "Departure Time", { alwaysShow: true, structuredTime: true })}
              {recommendedDeparture && inlineField !== "departure_time" && show.departure_time !== recommendedDeparture && !driveCardDismissed && (
                <div className="-mt-2">
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
                </div>
              )}
              {editField("departure_notes", "Departure Notes", { multiline: true, alwaysShow: true, placeholder: "e.g. Car 1 leaving from hotel at 9am, Car 2 from venue at 9:30am" })}
            </FieldGroup>

            <Separator />

            {/* Schedule + Day-of Logistics — two-column layout */}
            <div className="grid grid-cols-1 md:grid-cols-[3fr_auto_2fr] gap-x-6 gap-y-6">
              {/* Schedule — dominant left column */}
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
                    <div className="space-y-1">
                      {scheduleEntries.map((entry) => (
                        <div
                          key={entry.id}
                          className="flex items-baseline gap-3 sm:gap-4 rounded px-2 sm:px-3 py-2"
                        >
                          <span className="font-mono text-base shrink-0 whitespace-nowrap text-muted-foreground">
                            {entry.time}
                          </span>
                          <span className="text-base text-foreground">{entry.label}</span>
                        </div>
                      ))}
                    </div>
                  </button>
                ) : (
                  <EmptyFieldPrompt label="schedule" onClick={() => {
                    scheduleRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    setEditingSchedule(true);
                  }} />
                )}
                {editField("set_length", "Set Length", { alwaysShow: true })}
                {(inlineField === "curfew" || show.curfew) ? editField("curfew", "Curfew", { structuredTime: true, hideTbd: true }) : null}
                {(inlineField === "changeover_time" || show.changeover_time) ? editField("changeover_time", "Changeover Time", { structuredTime: true }) : null}
              </FieldGroup>
              </div>

              {/* Vertical divider (desktop only) */}
              <Separator orientation="vertical" className="hidden md:block h-auto" />

              {/* Right column: Day of Show Contact + Load In + Parking */}
              <div className="space-y-6">
                <FieldGroup title="Day of Show Contact" incomplete={!show.dos_contact_name && !show.dos_contact_phone} contentClassName="space-y-2">
                  {editField("dos_contact_name", "Name", { alwaysShow: true, compact: true })}
                  {editField("dos_contact_phone", "Phone", { mono: true, alwaysShow: true, phoneFormat: true, compact: true })}
                </FieldGroup>

                <FieldGroup title="Load In" incomplete={!show.load_in_details}>
                  {editField("load_in_details", "Load In", { multiline: true, alwaysShow: true, labelHidden: true })}
                </FieldGroup>

                <FieldGroup title="Parking" incomplete={!show.parking_notes}>
                  {editField("parking_notes", "Parking", { multiline: true, alwaysShow: true, labelHidden: true })}
                </FieldGroup>
              </div>
            </div>

            <Separator />

            {/* Backline */}
            <FieldGroup title="Backline" incomplete={!show.backline_provided}>
              {editField("backline_provided", "Backline", { multiline: true, alwaysShow: true, labelHidden: true })}
            </FieldGroup>

            <Separator />

            {/* At The Venue */}
            <FieldGroup title="At The Venue">
              {editField("green_room_info", "Green Room", { multiline: true, alwaysShow: true })}
              {editField("hospitality", "Hospitality", { multiline: true })}
              {editField("wifi_network", "WiFi Network", { mono: true, alwaysShow: true })}
              {editField("wifi_password", "WiFi Password", { mono: true, alwaysShow: true })}
            </FieldGroup>

            <Separator />

            {/* Guest List */}
            <FieldGroup title="Guest List" incomplete={!!show.artist_comps && !show.guest_list_details && inlineField !== "guest_list_details"}>
              {renderGuestList()}
            </FieldGroup>

            <Separator />

            {/* Accommodations (formerly Hotel) */}
            <FieldGroup title="Accommodations">
              {(() => {
                const hotelEmpty = !show.hotel_name && !show.hotel_address && !show.hotel_confirmation && !show.hotel_checkin && !show.hotel_checkout;
                const isHotelInline = inlineField === "hotel_group";

                if (isHotelInline) {
                  return (
                    <div ref={inlineRef} className="space-y-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Name</Label>
                        <Input value={hotelForm.hotel_name ?? ""} onChange={(e) => setHotelForm(p => ({ ...p, hotel_name: e.target.value }))} className="text-sm h-9" autoFocus />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Address</Label>
                        <Input value={hotelForm.hotel_address ?? ""} onChange={(e) => setHotelForm(p => ({ ...p, hotel_address: e.target.value }))} className="text-sm h-9" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Confirmation #</Label>
                        <Input value={hotelForm.hotel_confirmation ?? ""} onChange={(e) => setHotelForm(p => ({ ...p, hotel_confirmation: e.target.value }))} className="text-sm h-9 font-mono" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Check In</Label>
                        <Input value={hotelForm.hotel_checkin ?? ""} onChange={(e) => setHotelForm(p => ({ ...p, hotel_checkin: e.target.value }))} className="text-sm h-9 font-mono" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Check Out</Label>
                        <Input value={hotelForm.hotel_checkout ?? ""} onChange={(e) => setHotelForm(p => ({ ...p, hotel_checkout: e.target.value }))} className="text-sm h-9 font-mono" />
                      </div>
                      <InlineActions onSave={saveHotelGroup} onCancel={cancelInline} />
                    </div>
                  );
                }

                if (hotelEmpty) {
                  return <EmptyFieldPrompt label="accommodations" onClick={startHotelEdit} />;
                }

                return (
                  <button onClick={startHotelEdit} className="w-full text-left space-y-3 card-pressable">
                    <FieldRow label="Name" value={show.hotel_name} />
                    <FieldRow label="Address" value={show.hotel_address} />
                    <FieldRow label="Confirmation #" value={show.hotel_confirmation} mono />
                    <FieldRow label="Check In" value={show.hotel_checkin} mono />
                    <FieldRow label="Check Out" value={show.hotel_checkout} mono />
                  </button>
                );
              })()}
            </FieldGroup>


            <Separator />

            <EmailAttachments showId={show.id} />

            {/* Additional Info — always visible at bottom */}
            <FieldGroup title="Additional Info">
              {editField("additional_info", "Details", { multiline: true, alwaysShow: true })}
            </FieldGroup>
          </div>
        </TabsContent>

        <TabsContent value="deal">
          <div className="space-y-6 sm:space-y-8">
            {/* Deal — balanced 3×2 grid */}
            <FieldGroup title="Deal" incomplete={!show.guarantee && !show.backend_deal && !show.ticket_price && !show.venue_capacity && !show.walkout_potential && !show.artist_comps}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <div>{editField("guarantee", "Guarantee", { mono: true, alwaysShow: true, currency: true })}</div>
                <div>{editField("ticket_price", "Ticket Price", { mono: true, alwaysShow: true, currency: true, placeholder: "e.g. $20 or $18/$20/$25" })}</div>
                <div>{editField("venue_capacity", "Capacity", { alwaysShow: true })}</div>
                <div>{editField("walkout_potential", "Walkout Potential", { mono: true, alwaysShow: true, currency: true })}</div>
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
