import { useParams, useNavigate, useLocation, useSearchParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Trash2, Save, X, Loader2, MapPin, CheckCircle2, Clock, Sparkles, Check, Share2, Car, FileText, MoreHorizontal, ChevronDown, Pencil } from "lucide-react";
import CopyButton from "@/components/ui/CopyButton";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
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
  DropdownMenuSeparator,
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
import ShowAttachments from "@/components/ShowAttachments";
import ExportPdfDialog from "@/components/ExportPdfDialog";
import SetListEditor from "@/components/SetListEditor";
import CopyGuestLinkButton from "@/components/CopyGuestLinkButton";
import { useGuestLink } from "@/hooks/useGuestLink";
import GuestListEditor, { GuestCount, guestTotal, parseGuestList } from "@/components/GuestListEditor";
import ScheduleEditor from "@/components/ScheduleEditor";
import ContactsEditor, { type ContactRow } from "@/components/ContactsEditor";
import EmptyFieldPrompt from "@/components/EmptyFieldPrompt";
import InlineEditable, { InlineField } from "@/components/InlineEditable";
import { toast } from "sonner";
import { cn, formatCityState, normalizePhone } from "@/lib/utils";
import { normalizeTime } from "@/lib/timeFormat";
import { isLoadInLabel } from "@/lib/scheduleMatch";
import TimeInput from "@/components/TimeInput";
import type { Show } from "@/lib/types";
import RevenueSimulator, { parseDollar } from "@/components/RevenueSimulator";
import { useGroupEditor } from "@/pages/show-detail/useGroupEditor";

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

// Strip country + city/state tail from a Google-formatted address so the
// mobile header can show just the street line beneath the city row.
function streetFromAddress(addr: string): string {
  const cleaned = addr.replace(/,?\s*United States$/i, "").trim();
  const firstComma = cleaned.indexOf(",");
  return firstComma > 0 ? cleaned.slice(0, firstComma).trim() : cleaned;
}

interface ShareMenuContentProps {
  show: Show;
  showId: string;
  onOpenDelete: () => void;
}

function ShareMenuContent({ show, showId, onOpenDelete }: ShareMenuContentProps) {
  const { copyOrCreate: copyMagicLink, isPending: isCopyPending } = useGuestLink(showId, "daysheet");
  return (
    <>
      <EmailBandDialog show={show} trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Email day sheet</DropdownMenuItem>} />
      <SlackPushDialog showId={showId} show={show} trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Send to Slack</DropdownMenuItem>} />
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onSelect={(e) => {
          e.preventDefault();
          copyMagicLink();
        }}
        disabled={isCopyPending}
      >
        <Sparkles className="h-3.5 w-3.5 mr-2" /> Copy magic link
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        className="text-destructive focus:text-destructive"
        onClick={onOpenDelete}
      >
        <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete show
      </DropdownMenuItem>
    </>
  );
}

interface HeaderActionsProps {
  show: Show;
  showId: string;
  onOpenSettle: () => void;
  onOpenClearSettle: () => void;
  onOpenDelete: () => void;
  onParseUpdated: () => void;
}

function HeaderActions({
  show,
  showId,
  onOpenSettle,
  onOpenClearSettle,
  onOpenDelete,
  onParseUpdated,
}: HeaderActionsProps) {
  const { copyOrCreate: copyMagicLink, isPending: isCopyPending } = useGuestLink(showId, "daysheet");
  const isSettled = !!show.is_settled;

  return (
    <>
      {/* Mobile: full-width Settle + overflow menu holding everything else */}
      <div className="sm:hidden flex items-center gap-2 mt-3.5">
        {isSettled ? (
          <Button
            type="button"
            variant="outline"
            disabled
            className="flex-1 h-10 rounded-md gap-1.5 text-sm font-medium opacity-100"
            style={{ color: "var(--pastel-green-fg)" }}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Settled</span>
          </Button>
        ) : (
          <Button
            type="button"
            onClick={onOpenSettle}
            className="flex-1 h-10 rounded-md gap-1.5 text-sm font-medium bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] hover:bg-[hsl(var(--success))]/90"
          >
            <CheckCircle2 className="h-[15px] w-[15px]" />
            <span>Settle show</span>
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-md text-muted-foreground"
              aria-label="More actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <ParseAdvanceForShowDialog
              showId={showId}
              currentShow={show}
              onUpdated={onParseUpdated}
              trigger={
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <FileText className="h-3.5 w-3.5 mr-2" /> Import advance
                </DropdownMenuItem>
              }
            />
            <EmailBandDialog show={show} trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Email day sheet</DropdownMenuItem>} />
            <SlackPushDialog showId={showId} show={show} trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Send to Slack</DropdownMenuItem>} />
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                copyMagicLink();
              }}
              disabled={isCopyPending}
            >
              <Sparkles className="h-3.5 w-3.5 mr-2" /> Copy magic link
            </DropdownMenuItem>
            {isSettled && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onOpenClearSettle}>Clear settlement…</DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={onOpenDelete}
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete show
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Desktop: full Settle / Import / Share row */}
      <div className="hidden sm:flex items-center gap-2 shrink-0">
        {isSettled ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="h-10 rounded-md gap-1.5 text-[13.5px] font-medium"
                style={{ color: "var(--pastel-green-fg)" }}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Settled</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onOpenClearSettle}>Clear settlement…</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            type="button"
            onClick={onOpenSettle}
            className="h-10 rounded-md gap-1.5 text-[13.5px] font-medium bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] hover:bg-[hsl(var(--success))]/90"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Settle show</span>
          </Button>
        )}

        <ParseAdvanceForShowDialog
          showId={showId}
          currentShow={show}
          onUpdated={onParseUpdated}
          trigger={
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-md gap-1.5 text-[13.5px] font-medium"
              aria-label="Import advance"
              title="Import advance"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Import</span>
            </Button>
          }
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" className="h-10 rounded-md gap-1.5 text-[13.5px] font-medium">
              <Share2 className="h-3.5 w-3.5" />
              <span>Share</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <ShareMenuContent show={show} showId={showId} onOpenDelete={onOpenDelete} />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}

export default function ShowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { teamId } = useTeam();

  // Allow deep-linking to a specific tab (e.g. from Day of Show: tap the
  // contact card with no phone → land on Contacts tab, not Show Info).
  const [searchParams] = useSearchParams();
  const initialTab = (() => {
    const t = searchParams.get("tab");
    return t === "show" || t === "deal" || t === "contacts" || t === "set-list" ? t : "show";
  })();
  const [viewTab, setViewTab] = useState<"show" | "deal" | "contacts" | "set-list">(initialTab);

  // Allow deep-linking to a specific section within Show Info (e.g. from Day
  // of Show: tap the Guest list card → scroll to that section instead of
  // dumping the user at the top of the page). Runs once `show` data loads,
  // so the section is guaranteed to be in the DOM by then.
  const focus = searchParams.get("focus");

  // When we arrive here from the inbound-email "Review Now" flow, the
  // forwarded email body is handed off via location state. Consume it once,
  // open the Import Advance dialog with it so the AI parse runs automatically,
  // and clear history state so refreshes / back-nav don't re-trigger.
  const [inboundEmailText, setInboundEmailText] = useState<string | null>(null);
  useEffect(() => {
    const incoming = (location.state as { inboundEmailText?: string } | null)?.inboundEmailText;
    if (incoming && incoming.trim()) {
      setInboundEmailText(incoming);
      window.history.replaceState({}, "");
    }
    // Only run on initial mount for this show id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Inline edit: which field key is currently being edited (null = none)
  const [inlineField, setInlineField] = useState<string | null>(null);
  const [inlineValue, setInlineValue] = useState<string>("");
  const inlineRef = useRef<HTMLDivElement>(null);
  const inlineTimeFormat = useRef(false);
  const scheduleRef = useRef<HTMLDivElement>(null);

  const [lookingUpAddress, setLookingUpAddress] = useState(false);
  const [scheduleKey, setScheduleKey] = useState(0);
  const [suggestionDismissed, setSuggestionDismissed] = useState(() =>
    id ? localStorage.getItem(`departure-suggestion-dismissed-${id}`) === "true" : false
  );
  const [dealTabSeen, setDealTabSeen] = useState(() =>
    id ? localStorage.getItem(`deal-tab-seen-${id}`) === "true" : true
  );
  // Re-sync when navigating between shows — useState init only runs at mount,
  // and react-router reuses the component instance across :id changes.
  useEffect(() => {
    setDealTabSeen(id ? localStorage.getItem(`deal-tab-seen-${id}`) === "true" : true);
  }, [id]);

  // Settle modal state
  const [settleOpen, setSettleOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [clearSettleOpen, setClearSettleOpen] = useState(false);
  const [projectionOpen, setProjectionOpen] = useState(false);

  // Sticky collapsed header on mobile — flips on once the page header has
  // scrolled out of view, so the back nav and primary action stay reachable.
  // Callback ref (rather than useEffect on a regular ref) because the sentinel
  // only mounts after the show data has loaded, which a [id]-keyed effect misses.
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const headerObserverRef = useRef<IntersectionObserver | null>(null);
  const headerSentinelRef = useCallback((node: HTMLDivElement | null) => {
    headerObserverRef.current?.disconnect();
    headerObserverRef.current = null;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setHeaderCollapsed(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      { threshold: 0 },
    );
    observer.observe(node);
    headerObserverRef.current = observer;
  }, []);
  // When the advance hasn't been imported, the Show Info tab shows a CTA card.
  // The user can dismiss it (X or "fill in manually") to see the normal field
  // layout. Persist via localStorage so it stays gone across reloads even
  // before any schedule entries exist (e.g. user only entered backline info).
  const [importAdvanceDismissed, setImportAdvanceDismissed] = useState(() =>
    id ? localStorage.getItem(`import-advance-dismissed-${id}`) === "true" : false
  );
  const dismissImportAdvance = () => {
    if (id) localStorage.setItem(`import-advance-dismissed-${id}`, "true");
    setImportAdvanceDismissed(true);
  };
  const [settleForm, setSettleForm] = useState({
    actual_tickets_sold: "",
    actual_walkout: "",
    settlement_notes: "",
  });

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
        .select("*, schedule_entries(*), show_contacts(*), tours(*)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Scroll to a focused section once the show has loaded. The section ids
  // are added inline (e.g. id="guest-list-section"). Smooth scroll feels
  // intentional rather than jarring after the route change.
  useEffect(() => {
    if (!show || !focus) return;
    const el = document.getElementById(`${focus}-section`);
    if (!el) return;
    // requestAnimationFrame so the FieldGroup has rendered + expanded before
    // we measure the scroll target.
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [show, focus]);

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
    queryKey: ["previous-show-in-tour", show?.tour_id, show?.date, show?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shows")
        .select("id, city, venue_name, venue_address, date")
        .eq("tour_id", show!.tour_id!)
        .lt("date", show!.date)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!show && !!show.tour_id,
  });

  // Departure origin = previous show's city if ≤3 days ago (band still on road), else home base
  const departureOrigin = useMemo(() => {
    if (previousShow?.city && show?.date) {
      const dayGap = differenceInDays(parseISO(show.date), parseISO(previousShow.date));
      if (dayGap <= 3) {
        return { label: formatCityState(previousShow.city), query: previousShow.venue_address || previousShow.city };
      }
    }
    const home = appSettings?.home_base_city?.trim();
    if (home) {
      return { label: formatCityState(home), query: home };
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
      const result = data as
        | { duration_seconds: number; duration_text: string; distance_text?: string }
        | { error: string };
      if ("error" in result) throw new Error(result.error);
      return result;
    },
    enabled: !!departureOrigin && !!destinationQuery,
    staleTime: 1000 * 60 * 60, // 1 hour
    retry: false,
  });

  // Parse load-in time from schedule entries into minutes since midnight
  const loadInMinutes = useMemo(() => {
    const entries = show?.schedule_entries ?? [];
    const loadIn = entries.find((e) => isLoadInLabel(e.label));
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

  // Hide drive-time row once the band is at load-in (or noon on show day if no load-in entry)
  const shouldHideDriveTime = useMemo(() => {
    if (!show?.date) return false;
    const showDate = parseISO(show.date);
    if (loadInMinutes != null) {
      const loadInDate = new Date(showDate);
      loadInDate.setHours(Math.floor(loadInMinutes / 60), loadInMinutes % 60, 0, 0);
      return new Date() >= loadInDate;
    }
    const noon = new Date(showDate);
    noon.setHours(12, 0, 0, 0);
    return new Date() >= noon;
  }, [show?.date, loadInMinutes]);

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

  const hasDealData = !!(
    show?.guarantee ||
    show?.backend_deal ||
    show?.ticket_price ||
    show?.venue_capacity ||
    show?.walkout_potential ||
    show?.artist_comps
  );

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
    mutationFn: async (updates: Partial<Show> & { tours?: unknown }) => {
      const {
        schedule_entries: _schedule_entries,
        show_contacts: _show_contacts,
        show_party_members: _show_party_members,
        tours: _tours,
        ...showUpdates
      } = updates;
      if (showUpdates.tour_id === "" || showUpdates.tour_id === "none") showUpdates.tour_id = null;
      const { error } = await supabase.from("shows").update(showUpdates).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["show", id] });
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      setInlineField(null);
      toast.success("Show updated");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to update show: ${msg}`);
    },
  });

  // Guest list autosaves on every commit (Enter / blur / trash). Silent on
  // success — the toast firehose from updateMutation would be unbearable.
  const guestListMutation = useMutation({
    mutationFn: async (guest_list_details: string | null) => {
      const { error } = await supabase
        .from("shows")
        .update({ guest_list_details })
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["show", id] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Could not save guest list: ${msg}`);
    },
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
      }).eq("id", id!);
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
      }).eq("id", id!);
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
      }).eq("id", id!);
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

  // --- Group editors ---
  // Each of the paired-field cards below (Departure, Arrival, Venue,
  // Accommodations) delegates its edit/save/cancel state machine to
  // useGroupEditor. They all share the single `inlineField` gate, so only one
  // can be open at a time. (Contacts live in their own multi-row editor below.)
  const departureEditor = useGroupEditor({
    groupKey: "departure_group",
    keys: ["departure_time", "departure_notes"] as const,
    show,
    inlineField,
    setInlineField,
    updateMutation,
    normalizers: { departure_time: normalizeTime },
    isEmpty: s => !s.departure_time && !s.departure_notes,
  });

  const arrivalEditor = useGroupEditor({
    groupKey: "arrival_group",
    keys: ["load_in_details", "parking_notes"] as const,
    show,
    inlineField,
    setInlineField,
    updateMutation,
    isEmpty: s => !s.load_in_details && !s.parking_notes,
  });

  const venueEditor = useGroupEditor({
    groupKey: "venue_group",
    keys: ["green_room_info", "wifi_network", "wifi_password", "hospitality"] as const,
    show,
    inlineField,
    setInlineField,
    updateMutation,
    isEmpty: s => !s.green_room_info && !s.wifi_network && !s.wifi_password && !s.hospitality,
  });

  const hotelEditor = useGroupEditor({
    groupKey: "hotel_group",
    keys: ["hotel_name", "hotel_address", "hotel_confirmation", "hotel_checkin", "hotel_checkout"] as const,
    show,
    inlineField,
    setInlineField,
    updateMutation,
    isEmpty: s => !s.hotel_name && !s.hotel_address && !s.hotel_confirmation && !s.hotel_checkin && !s.hotel_checkout,
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
    setInlineValue((show[key as keyof typeof show] as string | null) ?? "");
  };

  const cancelInline = () => {
    setInlineField(null);
    setInlineValue("");
  };

  const saveInline = () => {
    if (!inlineField) return;
    const val = inlineTimeFormat.current ? normalizeTime(inlineValue) : inlineValue;
    updateMutation.mutate({ [inlineField]: val || null } as Partial<Show>);
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
      updateMutation.mutate({ backend_deal: null });
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
    updateMutation.mutate({ backend_deal: deal });
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
        updateMutation.mutate({ [inlineField]: val || null } as Partial<Show>);
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
          {!opts?.labelHidden && <Label className="text-xs text-muted-foreground">{label}</Label>}
          <InlineEditable
            value={inlineValue}
            onChange={setInlineValue}
            onSave={handleBlurSave}
            onCancel={cancelInline}
            multiline={opts?.multiline}
            mono={opts?.mono}
            placeholder={opts?.placeholder ?? (opts?.timeFormat ? "e.g. 9:00 AM or 2:30 PM" : undefined)}
            inputMode={opts?.phoneFormat ? "tel" : undefined}
            saving={updateMutation.isPending}
          />
        </div>
      );
    }

    // View mode
    const value = show[key as keyof typeof show] as string | null;
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

  const renderGuestList = () => (
    <GuestListEditor
      value={show.guest_list_details}
      capacity={show.venue_capacity}
      compsAllotment={show.artist_comps}
      onChange={(serialized) =>
        guestListMutation.mutate(serialized === "[]" ? null : serialized)
      }
    />
  );

  const openSettleModal = () => {
    setSettleForm({ actual_tickets_sold: "", actual_walkout: "", settlement_notes: "" });
    setSettleOpen(true);
  };

  const lookupAddress = async () => {
    if (!show) return;
    setLookingUpAddress(true);
    try {
      const { data, error } = await supabase.functions.invoke("lookup-venue-address", {
        body: { venue_name: show.venue_name, city: show.city },
      });
      if (error || data?.error) throw new Error(data?.error || error.message);
      const cleanAddress = (data.address as string).replace(/,?\s*United States$/, "");
      const cleanCity = show.city?.replace(/\*+$/, "").trim() ?? show.city;
      const { error: updateError } = await supabase
        .from("shows")
        .update({ venue_address: cleanAddress, city: cleanCity })
        .eq("id", show.id);
      if (updateError) throw updateError;
      queryClient.invalidateQueries({ queryKey: ["show", id] });
      toast.success("Address found and saved");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not find address";
      toast.error(msg);
    } finally {
      setLookingUpAddress(false);
    }
  };

  return (
    <div className="animate-fade-in max-w-3xl">
      {/* Mobile sticky collapsed header — overlays AppLayout's mobile chrome
          while scrolled. Slides in from above; mirrors the back-arrow + venue
          + primary action from the page header. */}
      <div
        className={cn(
          "md:hidden fixed top-0 left-0 right-0 z-[60] h-12 px-3 flex items-center gap-2 border-b bg-background/95 backdrop-blur-sm transition-transform duration-200 ease-out",
          headerCollapsed ? "translate-y-0" : "-translate-y-full",
        )}
        aria-hidden={!headerCollapsed}
      >
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 -ml-1"
          onClick={() => navigate("/")}
          tabIndex={headerCollapsed ? 0 : -1}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Link
          to="/"
          className="font-display text-lg leading-none tracking-tight text-foreground flex-1"
          tabIndex={headerCollapsed ? 0 : -1}
        >
          Advance
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary"
              className="h-8 px-3 rounded-md gap-1.5 text-xs font-medium shrink-0"
              tabIndex={headerCollapsed ? 0 : -1}
              aria-label="Share"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>Share</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <ShareMenuContent show={show as Show} showId={id!} onOpenDelete={() => setDeleteOpen(true)} />
          </DropdownMenuContent>
        </DropdownMenu>
        {show.is_settled ? (
          <Button
            variant="outline"
            disabled
            className="h-8 px-3 rounded-md gap-1.5 text-xs font-medium opacity-100 shrink-0"
            style={{ color: "var(--pastel-green-fg)" }}
            tabIndex={-1}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Settled
          </Button>
        ) : (
          <Button
            onClick={openSettleModal}
            className="h-8 px-3 rounded-md gap-1.5 text-xs font-medium bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] hover:bg-[hsl(var(--success))]/90 shrink-0"
            tabIndex={headerCollapsed ? 0 : -1}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Settle
          </Button>
        )}
      </div>

      {/* Controlled parse dialog driven by inbound-email review flow. Opens
          automatically when location state carries a forwarded email body and
          auto-invokes the AI parse so the user lands on the confirm step. */}
      <ParseAdvanceForShowDialog
        showId={id!}
        currentShow={show as Show}
        onUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ["show", id] });
          queryClient.invalidateQueries({ queryKey: ["shows"] });
        }}
        hideTrigger
        open={!!inboundEmailText}
        onOpenChange={(v) => { if (!v) setInboundEmailText(null); }}
        initialEmailText={inboundEmailText}
      />
      <Tabs
        value={viewTab}
        onValueChange={(v) => {
          const next = v as "show" | "deal" | "contacts" | "set-list";
          setViewTab(next);
          if (next === "deal" && id && !dealTabSeen) {
            localStorage.setItem(`deal-tab-seen-${id}`, "true");
            setDealTabSeen(true);
          }
        }}
      >
      {/* Header */}
      <div className="mb-5">
        {/* Not-advanced banner — silent on the happy path */}
        {!show.advanced_at && (
          <div
            className="mb-4 flex items-center gap-2.5 px-4 py-2.5 text-[12.5px] font-medium border-y sm:border sm:rounded-md -mx-4 sm:mx-0"
            style={{ background: "var(--pastel-yellow-bg)", color: "var(--pastel-yellow-fg)" }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current shrink-0" aria-hidden />
            <span>Show hasn't been advanced yet</span>
            <button
              type="button"
              onClick={() => toggleAdvancedMutation.mutate(true)}
              disabled={toggleAdvancedMutation.isPending}
              className="ml-auto underline underline-offset-2 hover:opacity-80 disabled:opacity-50"
            >
              Mark advanced
            </button>
          </div>
        )}

        {/* Back arrow */}
        <div className="flex items-center">
          <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7 -ml-1" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* Title row — eyebrow / venue / meta on the left, action buttons on the right (desktop) */}
        <div className="mt-2 sm:flex sm:items-end sm:justify-between sm:gap-6 sm:flex-wrap">
          <div className="min-w-0 sm:flex-1">
            {/* Eyebrow — combined tour + date */}
            {inlineField === "date" ? (
              <div ref={inlineRef}>
                <Input
                  type="date"
                  autoFocus
                  value={inlineValue}
                  onChange={(e) => setInlineValue(e.target.value)}
                  onBlur={() => {
                    if (inlineValue && inlineValue !== show.date) {
                      updateMutation.mutate({ date: inlineValue });
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
              <p className="mb-2 text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {show.tours?.name && (
                  <>
                    <Link
                      to={`/shows?view=tour&tourId=${show.tours.id}`}
                      className="hover:text-foreground transition-colors"
                    >
                      {show.tours.name}
                    </Link>
                    <span className="mx-1.5" aria-hidden>·</span>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => { setInlineField("date"); setInlineValue(show.date); }}
                  className="hover:text-foreground transition-colors"
                >
                  {format(parseISO(show.date), "MMM d EEE")}
                </button>
              </p>
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
                      updateMutation.mutate({ venue_name: inlineValue.trim() });
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
                  className="text-[28px] sm:text-4xl font-display font-bold tracking-[-0.02em] h-auto py-0.5 px-1 -ml-1"
                />
              </div>
            ) : (
              <div className="flex items-center gap-3 flex-wrap">
                <h1
                  className="font-display font-bold text-[28px] sm:text-4xl leading-[1.05] tracking-[-0.02em] cursor-pointer hover:text-primary/80 transition-colors"
                  onClick={() => { setInlineField("venue_name"); setInlineValue(show.venue_name); }}
                >
                  {show.venue_name}
                </h1>
                {show.advanced_at && (
                  <button
                    type="button"
                    onClick={() => toggleAdvancedMutation.mutate(false)}
                    disabled={toggleAdvancedMutation.isPending}
                    aria-label="Unmark advanced"
                    title="Click to unmark as advanced"
                    className="hidden sm:inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-none transition-opacity hover:opacity-80 disabled:opacity-50"
                    style={{ background: "var(--pastel-green-bg)", color: "var(--pastel-green-fg)" }}
                  >
                    <Check className="h-3 w-3" />
                    Advanced
                  </button>
                )}
              </div>
            )}

            {/* Address — inline editable. Used by both desktop and mobile meta rows. */}
            {inlineField === "venue_address" ? (
              <div ref={inlineRef} className="mt-2.5">
                <Input
                  autoFocus
                  value={inlineValue}
                  onChange={(e) => setInlineValue(e.target.value)}
                  onBlur={() => {
                    const next = inlineValue.trim();
                    const prev = (show.venue_address ?? "").trim();
                    if (next !== prev) {
                      updateMutation.mutate({ venue_address: next || null });
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
                  placeholder="Venue address"
                  className="text-sm h-9"
                />
              </div>
            ) : (
              <>
                {/* Desktop meta row — address · drive-time inline */}
                <div className="hidden sm:flex items-center gap-3 mt-2.5 text-sm text-muted-foreground flex-wrap">
                  {show.venue_address ? (
                    <span className="inline-flex items-center gap-1.5">
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(show.venue_address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 hover:underline hover:text-foreground transition-colors"
                      >
                        <MapPin className="h-3 w-3 shrink-0" />
                        {show.venue_address.replace(/,?\s*United States$/i, "")}
                      </a>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-muted-foreground/70 hover:text-foreground"
                        aria-label="Edit address"
                        title="Edit address"
                        onClick={() => {
                          setInlineField("venue_address");
                          setInlineValue(show.venue_address ?? "");
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span>{formatCityState(show.city)}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-xs text-muted-foreground hover:text-foreground h-5 px-1.5"
                        disabled={lookingUpAddress}
                        onClick={lookupAddress}
                      >
                        {lookingUpAddress ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                        Lookup
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground hover:text-foreground h-5 px-1.5"
                        onClick={() => {
                          setInlineField("venue_address");
                          setInlineValue("");
                        }}
                      >
                        Enter manually
                      </Button>
                    </span>
                  )}
                  {driveTimeLabel && departureOrigin && !shouldHideDriveTime && (
                    <span className="inline-flex items-center gap-1.5 flex-wrap">
                      <Car className="h-3 w-3 shrink-0" strokeWidth={1.75} />
                      <span className="font-mono text-foreground font-medium">{driveTimeLabel}</span>
                      <span>from {departureOrigin.label}</span>
                      {driveTime?.distance_text && (
                        <>
                          <span className="opacity-60">·</span>
                          <span className="font-mono">{driveTime.distance_text}</span>
                        </>
                      )}
                    </span>
                  )}
                </div>

                {/* Mobile meta — quiet city line + street address, drive-time as muted strip */}
                <div className="sm:hidden mt-1.5 text-[13px] text-muted-foreground">
                  {show.venue_address ? (
                    <div className="flex items-start gap-1.5">
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(show.venue_address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 min-w-0 hover:text-foreground transition-colors"
                      >
                        <span className="block">{formatCityState(show.city)}</span>
                        <span className="block text-[12px] text-muted-foreground/75 mt-0.5">
                          {streetFromAddress(show.venue_address)}
                        </span>
                      </a>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 text-muted-foreground/70 hover:text-foreground -mt-0.5"
                        aria-label="Edit address"
                        onClick={() => {
                          setInlineField("venue_address");
                          setInlineValue(show.venue_address ?? "");
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span>{formatCityState(show.city)}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-xs text-muted-foreground hover:text-foreground h-5 px-1.5"
                        disabled={lookingUpAddress}
                        onClick={lookupAddress}
                      >
                        {lookingUpAddress ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                        Lookup
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground hover:text-foreground h-5 px-1.5"
                        onClick={() => {
                          setInlineField("venue_address");
                          setInlineValue("");
                        }}
                      >
                        Enter manually
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
            {driveTimeLabel && departureOrigin && !shouldHideDriveTime && (
              <div
                className="sm:hidden flex items-center gap-2.5 mt-3 px-2.5 py-2 rounded-md text-[12.5px] text-muted-foreground"
                style={{ background: "hsl(var(--muted) / 0.55)" }}
              >
                <Car className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                <span className="font-mono font-medium text-foreground">{driveTimeLabel}</span>
                <span className="truncate">from {departureOrigin.label}</span>
                {driveTime?.distance_text && (
                  <span className="ml-auto font-mono font-medium shrink-0">{driveTime.distance_text}</span>
                )}
              </div>
            )}
          </div>

          <HeaderActions
            show={show as Show}
            showId={id!}
            onOpenSettle={openSettleModal}
            onOpenClearSettle={() => setClearSettleOpen(true)}
            onOpenDelete={() => setDeleteOpen(true)}
            onParseUpdated={() => {
              queryClient.invalidateQueries({ queryKey: ["show", id] });
              queryClient.invalidateQueries({ queryKey: ["shows"] });
            }}
          />
        </div>
        {/* Scroll sentinel — when this leaves the viewport above, the sticky
            collapsed header on mobile fades in. */}
        <div ref={headerSentinelRef} aria-hidden className="h-px" />

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
              {!dealTabSeen && hasDealData && (
                <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground" aria-hidden />
              )}
            </TabsTrigger>
            <TabsTrigger
              value="contacts"
              className="relative h-auto px-0 pb-2 rounded-none bg-transparent text-sm font-medium text-muted-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-foreground after:opacity-0 data-[state=active]:after:opacity-100"
            >
              Contacts
            </TabsTrigger>
            <TabsTrigger
              value="set-list"
              className="relative h-auto px-0 pb-2 rounded-none bg-transparent text-sm font-medium text-muted-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-foreground after:opacity-0 data-[state=active]:after:opacity-100"
            >
              Set List
            </TabsTrigger>
          </TabsList>
        </div>
      </div>

      <TabsContent value="show">
          {!show.advance_imported_at && !importAdvanceDismissed && scheduleEntries.length === 0 ? (
            <div className="space-y-6 sm:space-y-8">
              <div className="relative rounded-lg border border-border bg-card p-6 sm:p-8 text-center animate-fade-in">
                <button
                  type="button"
                  onClick={dismissImportAdvance}
                  className="absolute top-3 right-3 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label="Dismiss"
                >
                  <X className="h-4 w-4" />
                </button>
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
                    onClick={dismissImportAdvance}
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
            {/* Schedule — full width */}
            <div ref={scheduleRef}>
              <FieldGroup title="Schedule">
                <ScheduleEditor
                  key={scheduleKey}
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
                      setScheduleKey((k) => k + 1);
                      toast.success("Schedule updated");
                    } catch {
                      toast.error("Failed to save schedule");
                    }
                  }}
                />
                <div className="flex justify-end">
                  <ExportPdfDialog show={show} />
                </div>
              </FieldGroup>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-0.5 h-3.5 rounded-full bg-foreground/25" />
                <h3 className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                  Set Length
                </h3>
              </div>
              <div className="flex-1 min-w-0">
                {editField("set_length", "Set Length", { alwaysShow: true, labelHidden: true, placeholder: "e.g. 75 min" })}
              </div>
            </div>

            <Separator />

            <FieldGroup
              title="Departure"
              collapsible
              defaultOpen={!!show.departure_time || !!show.departure_notes || (!!recommendedDeparture && !suggestionDismissed)}
            >
              {departureEditor.isEditing ? (
                <div ref={inlineRef} className="space-y-3">
                  <div className="space-y-2">
                    <Label className="block text-xs text-muted-foreground">Time</Label>
                    <TimeInput
                      value={departureEditor.get("departure_time")}
                      onChange={(val) => departureEditor.setField("departure_time", val)}
                      autoFocus
                      hideTbd
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Notes</Label>
                    <InlineField
                      value={departureEditor.get("departure_notes")}
                      onChange={(v) => departureEditor.setField("departure_notes", v)}
                      multiline
                      placeholder="e.g. Car 1 leaving from hotel at 9am, Car 2 from venue at 9:30am"
                    />
                  </div>
                  <InlineActions onSave={departureEditor.save} onCancel={departureEditor.cancel} />
                </div>
              ) : departureEditor.empty ? (
                <>
                  <EmptyFieldPrompt label="departure" onClick={departureEditor.startEdit} />
                  {recommendedDeparture && !suggestionDismissed && (
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1.5"
                        onClick={() => updateMutation.mutate({ departure_time: recommendedDeparture })}
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
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={departureEditor.startEdit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); departureEditor.startEdit(); }
                  }}
                  className="w-full text-left space-y-2 card-pressable cursor-pointer"
                >
                  <FieldRow label="Time" value={show.departure_time} mono />
                  {show.departure_notes ? (
                    <FieldRow label="Notes" value={show.departure_notes} />
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
                      <span className="text-sm text-muted-foreground sm:w-32 sm:shrink-0">Notes</span>
                      <span className="text-sm text-muted-foreground/50">Add notes…</span>
                    </div>
                  )}
                </div>
              )}
            </FieldGroup>

            <Separator />

            {/* Arrival — full width */}
            <FieldGroup
              title="Arrival"
              collapsible
              defaultOpen={!!(show.load_in_details || show.parking_notes)}
            >
              {arrivalEditor.isEditing ? (
                <div ref={inlineRef} className="space-y-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Load In</Label>
                    <InlineField
                      value={arrivalEditor.get("load_in_details")}
                      onChange={(v) => arrivalEditor.setField("load_in_details", v)}
                      multiline
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Parking</Label>
                    <InlineField
                      value={arrivalEditor.get("parking_notes")}
                      onChange={(v) => arrivalEditor.setField("parking_notes", v)}
                      multiline
                    />
                  </div>
                  <InlineActions onSave={arrivalEditor.save} onCancel={arrivalEditor.cancel} />
                </div>
              ) : arrivalEditor.empty ? (
                <EmptyFieldPrompt label="arrival (load in / parking)" onClick={arrivalEditor.startEdit} />
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={arrivalEditor.startEdit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); arrivalEditor.startEdit(); }
                  }}
                  className="w-full text-left space-y-4 card-pressable cursor-pointer"
                >
                  <FieldRow label="Load In" value={show.load_in_details} />
                  <FieldRow label="Parking" value={show.parking_notes} />
                </div>
              )}
            </FieldGroup>

            <Separator />

            <FieldGroup
              title="At The Venue"
              collapsible
              defaultOpen={!!(show.green_room_info || show.wifi_network || show.wifi_password || show.hospitality)}
            >
              {venueEditor.isEditing ? (
                <div ref={inlineRef} className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Green Room</Label>
                    <InlineField
                      value={venueEditor.get("green_room_info")}
                      onChange={(v) => venueEditor.setField("green_room_info", v)}
                      multiline
                      autoFocus
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">WiFi Network</Label>
                      <InlineField
                        value={venueEditor.get("wifi_network")}
                        onChange={(v) => venueEditor.setField("wifi_network", v)}
                        mono
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">WiFi Password</Label>
                      <InlineField
                        value={venueEditor.get("wifi_password")}
                        onChange={(v) => venueEditor.setField("wifi_password", v)}
                        mono
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Hospitality</Label>
                    <InlineField
                      value={venueEditor.get("hospitality")}
                      onChange={(v) => venueEditor.setField("hospitality", v)}
                      multiline
                    />
                  </div>
                  <InlineActions onSave={venueEditor.save} onCancel={venueEditor.cancel} />
                </div>
              ) : venueEditor.empty ? (
                <EmptyFieldPrompt label="venue details" onClick={venueEditor.startEdit} />
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={venueEditor.startEdit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); venueEditor.startEdit(); }
                  }}
                  className="w-full text-left space-y-2 card-pressable cursor-pointer"
                >
                  <FieldRow label="Green Room" value={show.green_room_info} />
                  {(show.wifi_network || show.wifi_password) ? (
                    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
                      <span className="text-sm text-muted-foreground sm:shrink-0 sm:w-32">WiFi</span>
                      <div className="flex flex-col gap-0.5">
                        {show.wifi_network && (
                          <span className="text-sm text-foreground font-mono text-[13px]">{show.wifi_network}</span>
                        )}
                        {show.wifi_password && (
                          <div className="flex items-center gap-1">
                            <span className="text-sm text-foreground font-mono text-[13px]">{show.wifi_password}</span>
                            <CopyButton value={show.wifi_password} />
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                  <FieldRow label="Hospitality" value={show.hospitality} />
                </div>
              )}
            </FieldGroup>

            <Separator />

            <FieldGroup title="Backline" collapsible defaultOpen={!!show.backline_provided}>
              {editField("backline_provided", "Backline", { multiline: true, alwaysShow: true, labelHidden: true, placeholder: "Tap to add backline notes" })}
            </FieldGroup>

            <Separator />

            {/* Guest List */}
            <div id="guest-list-section">
              <FieldGroup
                title="Guest List"
                collapsible
                defaultOpen={!!(show.guest_list_details || show.artist_comps) || focus === "guest-list"}
                headerRight={
                  show.guest_list_details || show.artist_comps ? (
                    <GuestCount
                      total={guestTotal(parseGuestList(show.guest_list_details))}
                      compsAllotment={show.artist_comps}
                    />
                  ) : null
                }
              >
                {renderGuestList()}
                <div className="pt-1">
                  <CopyGuestLinkButton showId={id!} linkType="guestlist" />
                </div>
              </FieldGroup>
            </div>

            <Separator />

            <ShowAttachments showId={show.id} />

            <Separator />

            <FieldGroup
              title="Accommodations"
              collapsible
              defaultOpen={!!(show.hotel_name || show.hotel_address || show.hotel_confirmation || show.hotel_checkin || show.hotel_checkout)}
            >
              {hotelEditor.isEditing ? (
                <div ref={inlineRef} className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Name</Label>
                    <InlineField value={hotelEditor.get("hotel_name")} onChange={(v) => hotelEditor.setField("hotel_name", v)} autoFocus />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Address</Label>
                    <InlineField value={hotelEditor.get("hotel_address")} onChange={(v) => hotelEditor.setField("hotel_address", v)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Confirmation #</Label>
                    <InlineField value={hotelEditor.get("hotel_confirmation")} onChange={(v) => hotelEditor.setField("hotel_confirmation", v)} mono />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Check In</Label>
                      <InlineField value={hotelEditor.get("hotel_checkin")} onChange={(v) => hotelEditor.setField("hotel_checkin", v)} mono />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Check Out</Label>
                      <InlineField value={hotelEditor.get("hotel_checkout")} onChange={(v) => hotelEditor.setField("hotel_checkout", v)} mono />
                    </div>
                  </div>
                  <InlineActions onSave={hotelEditor.save} onCancel={hotelEditor.cancel} />
                </div>
              ) : hotelEditor.empty ? (
                <EmptyFieldPrompt label="accommodations" onClick={hotelEditor.startEdit} />
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={hotelEditor.startEdit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      hotelEditor.startEdit();
                    }
                  }}
                  className="w-full text-left rounded-lg border border-dashed border-foreground/20 bg-background/40 hover:bg-foreground/[0.02] transition-colors cursor-pointer"
                >
                  {(show.hotel_name || show.hotel_address) && (
                    <div className="px-4 sm:px-5 pt-4 pb-3">
                      {show.hotel_name && (
                        <div className="font-display text-xl sm:text-2xl tracking-tight leading-tight text-foreground">
                          {show.hotel_name}
                        </div>
                      )}
                      {show.hotel_address && (
                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(show.hotel_address)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className={cn(
                            "inline-flex items-start gap-1 font-mono text-[12px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4 decoration-muted-foreground/40 hover:decoration-foreground",
                            show.hotel_name && "mt-1.5"
                          )}
                        >
                          <MapPin className="h-3 w-3 shrink-0 mt-[3px]" />
                          <span>{show.hotel_address.replace(/,?\s*United States$/i, "")}</span>
                        </a>
                      )}
                    </div>
                  )}
                  {(show.hotel_confirmation || show.hotel_checkin || show.hotel_checkout) && (
                    <div
                      className={cn(
                        "px-4 sm:px-5 pb-4 pt-3 grid gap-4",
                        (show.hotel_name || show.hotel_address) && "border-t border-dashed border-foreground/15",
                        // 1, 2, or 3 columns depending on populated fields
                        [show.hotel_confirmation, show.hotel_checkin, show.hotel_checkout].filter(Boolean).length === 3
                          ? "grid-cols-3"
                          : [show.hotel_confirmation, show.hotel_checkin, show.hotel_checkout].filter(Boolean).length === 2
                            ? "grid-cols-2"
                            : "grid-cols-1"
                      )}
                    >
                      {show.hotel_confirmation && (
                        <div>
                          <div className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground">Confirmation #</div>
                          <div className="font-mono text-[13px] text-foreground mt-1 break-all">{show.hotel_confirmation}</div>
                        </div>
                      )}
                      {show.hotel_checkin && (
                        <div>
                          <div className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground">Check In</div>
                          <div className="font-mono text-[13px] text-foreground mt-1">{show.hotel_checkin}</div>
                        </div>
                      )}
                      {show.hotel_checkout && (
                        <div>
                          <div className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground">Check Out</div>
                          <div className="font-mono text-[13px] text-foreground mt-1">{show.hotel_checkout}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </FieldGroup>

            <Separator />

            {/* Notes — collapsed by default on fresh shows */}
            <FieldGroup title="Notes" collapsible defaultOpen={!!show.additional_info}>
              {editField("additional_info", "Notes", { multiline: true, alwaysShow: true, labelHidden: true, placeholder: "Tap to add notes" })}
            </FieldGroup>
          </div>
          )}
        </TabsContent>

        <TabsContent value="contacts">
          <div className="space-y-6 sm:space-y-8">
            <Card className="p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Contacts</h2>
                {(show.show_contacts?.length ?? 0) === 0 && (
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" aria-hidden />
                )}
              </div>
              <ContactsEditor
                key={(show.show_contacts ?? []).map((c) => c.id).join(",") || "empty"}
                initial={(show.show_contacts ?? [])
                  .slice()
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map<ContactRow>((c) => ({
                    id: c.id,
                    name: c.name ?? "",
                    phone: c.phone ?? "",
                    email: c.email ?? "",
                    role: c.role ?? "custom",
                    role_label: c.role_label ?? "",
                    notes: c.notes ?? "",
                  }))}
                onSave={async (rows) => {
                  try {
                    await supabase.from("show_contacts").delete().eq("show_id", id!);
                    if (rows.length > 0) {
                      const inserts = rows.map((r, i) => ({
                        show_id: id!,
                        name: r.name,
                        phone: r.phone || null,
                        email: r.email || null,
                        role: r.role,
                        role_label: r.role === "custom" ? (r.role_label || null) : null,
                        notes: r.notes || null,
                        sort_order: i,
                      }));
                      const { error } = await supabase.from("show_contacts").insert(inserts);
                      if (error) throw error;
                    }
                    queryClient.invalidateQueries({ queryKey: ["show", id] });
                    queryClient.invalidateQueries({ queryKey: ["shows"] });
                    toast.success("Contacts updated");
                  } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    toast.error(`Failed to save contacts: ${msg}`);
                  }
                }}
              />
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="set-list">
          <div className="space-y-6 sm:space-y-8">
            <Card className="p-5 sm:p-6">
              <SetListEditor show={show as Show} />
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="deal">
          {(() => {
            // Settlement hero numbers
            const soldNum = show.actual_tickets_sold
              ? parseInt(String(show.actual_tickets_sold).replace(/,/g, ""), 10)
              : null;
            const capNum = show.venue_capacity
              ? parseInt(String(show.venue_capacity).replace(/,/g, ""), 10)
              : null;
            const validSold = soldNum != null && !isNaN(soldNum) ? soldNum : null;
            const validCap = capNum != null && !isNaN(capNum) ? capNum : null;
            const capPct =
              validSold != null && validCap && validCap > 0
                ? Math.round((validSold / validCap) * 100)
                : null;
            const actualWalkoutNum = parseDollar(show.actual_walkout) ?? 0;
            const walkoutPotentialNum = parseDollar(show.walkout_potential) ?? 0;
            const selloutPct =
              walkoutPotentialNum > 0
                ? Math.round((actualWalkoutNum / walkoutPotentialNum) * 100)
                : null;
            const selloutBarPct =
              walkoutPotentialNum > 0
                ? Math.max(0, Math.min(100, (actualWalkoutNum / walkoutPotentialNum) * 100))
                : 0;

            // Revenue simulator gating
            const wp = parseDollar(show.walkout_potential);
            const tp = parseDollar(show.ticket_price);
            const g = parseDollar(show.guarantee) ?? 0;
            const canSimulate = wp !== null || (tp != null && tp > 0 && validCap != null);
            const showSimulator = !(g === 0 && !canSimulate);

            // Local helpers — ledger row + rule label
            const LedgerRule = ({
              children,
              right,
            }: {
              children: React.ReactNode;
              right?: React.ReactNode;
            }) => (
              <div className="flex items-center gap-2 pb-1.5 mb-2.5 border-b border-foreground/80">
                <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-foreground">
                  {children}
                </span>
                {right && <span className="ml-auto">{right}</span>}
              </div>
            );

            const LedgerRow = ({
              label,
              hint,
              accent,
              children,
            }: {
              label: string;
              hint?: string;
              accent?: boolean;
              children: React.ReactNode;
            }) => (
              <div className="grid grid-cols-[1fr_auto] items-baseline gap-3 py-2 border-b border-dotted border-border/80 last:border-b-0">
                <span
                  className={cn(
                    "text-[13px] leading-snug",
                    accent ? "text-foreground font-medium" : "text-muted-foreground",
                  )}
                >
                  {label}
                  {hint && (
                    <span className="ml-2 text-[11px] text-muted-foreground/70">{hint}</span>
                  )}
                </span>
                <span className="text-right tabular-nums">{children}</span>
              </div>
            );

            // Tap-to-edit value cell. The input inherits the row's mono type
            // style so the swap is visually quiet. Saves on blur or Enter,
            // cancels on Escape.
            const LedgerValue = ({
              fieldKey,
              value,
              prefix = "",
              accent = false,
              currency = false,
              inputMode = "text",
              placeholder = "—",
            }: {
              fieldKey: keyof Show;
              value: string | null | undefined;
              prefix?: string;
              accent?: boolean;
              currency?: boolean;
              inputMode?: "text" | "numeric" | "decimal";
              placeholder?: string;
            }) => {
              const isEditing = inlineField === fieldKey;
              const sizeClass = accent ? "text-[15px]" : "text-[14px]";

              if (isEditing) {
                const handleSave = () => {
                  if (!inlineField) return;
                  let val = inlineValue.trim();
                  if (currency && val) val = formatCurrency(val);
                  updateMutation.mutate({ [inlineField]: val || null } as Partial<Show>);
                };
                return (
                  <span className="inline-flex items-baseline">
                    {prefix && (
                      <span className={cn("font-mono tracking-tight text-foreground", sizeClass)}>
                        {prefix}
                      </span>
                    )}
                    <input
                      autoFocus
                      type="text"
                      inputMode={inputMode}
                      value={inlineValue}
                      onChange={(e) => setInlineValue(e.target.value)}
                      onBlur={handleSave}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSave();
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          cancelInline();
                        }
                      }}
                      className={cn(
                        "bg-transparent border-0 border-b border-dashed border-foreground/45 outline-none focus:border-foreground/70 px-0.5 py-0 text-right text-foreground font-mono tracking-tight leading-tight",
                        sizeClass,
                      )}
                      style={{
                        width: `${Math.max(2, inlineValue.length + 1)}ch`,
                        minWidth: "2ch",
                      }}
                    />
                  </span>
                );
              }

              const hasValue = value != null && String(value).trim() !== "";
              if (!hasValue) {
                return (
                  <button
                    type="button"
                    onClick={() => startInlineEdit(fieldKey as string)}
                    className={cn(
                      "font-mono tracking-tight text-muted-foreground/55 hover:text-foreground/60 transition-colors leading-tight",
                      sizeClass,
                    )}
                  >
                    {placeholder}
                  </button>
                );
              }

              const displayValue = currency ? formatCurrency(String(value)) : String(value);
              return (
                <button
                  type="button"
                  onClick={() => startInlineEdit(fieldKey as string)}
                  className={cn(
                    "font-mono tracking-tight text-foreground leading-tight inline-block border-b border-transparent hover:border-foreground/15 transition-colors",
                    accent && "font-medium",
                    sizeClass,
                  )}
                >
                  {displayValue}
                </button>
              );
            };

            return (
              <div className="space-y-7 sm:space-y-9">
                {/* Settlement editorial hero — only when settled */}
                {show.is_settled && (
                  <div>
                    <LedgerRule
                      right={
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-[1px] text-[10px] font-medium"
                          style={{
                            backgroundColor: "var(--pastel-green-bg)",
                            color: "var(--pastel-green-fg)",
                          }}
                        >
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          Settled
                        </span>
                      }
                    >
                      Settlement
                    </LedgerRule>

                    {/* Walkout — one editorial line */}
                    <div className="flex items-baseline justify-between gap-3 flex-wrap pb-2.5 border-b border-dotted border-border/80">
                      <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                        Walkout
                      </span>
                      <span className="inline-flex items-baseline gap-2.5 flex-wrap">
                        <span
                          className="font-display leading-none tracking-[-0.035em] text-[clamp(32px,6vw,40px)]"
                          style={{ color: "var(--pastel-green-fg)" }}
                        >
                          {show.actual_walkout ? formatCurrency(String(show.actual_walkout)) : "—"}
                        </span>
                        {selloutPct != null && (
                          <span className="text-[12px] font-mono text-muted-foreground tracking-tight">
                            {selloutPct}% of sellout
                          </span>
                        )}
                      </span>
                    </div>

                    {walkoutPotentialNum > 0 && (
                      <div className="pt-2.5 pb-1">
                        <div className="relative h-[3px] rounded-full bg-muted overflow-hidden">
                          <div
                            className="absolute inset-y-0 left-0 rounded-full [transition:width_240ms_var(--ease-out)]"
                            style={{
                              width: `${selloutBarPct}%`,
                              background: "var(--pastel-green-fg)",
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {(validSold != null || show.actual_tickets_sold) && (
                      <div className="flex items-baseline justify-between gap-3 py-2 border-b border-dotted border-border/80">
                        <span className="text-[13px] text-muted-foreground">Tickets sold</span>
                        <span className="font-mono text-[14px] tracking-tight tabular-nums">
                          {show.actual_tickets_sold ?? "—"}
                          {show.venue_capacity && (
                            <span className="text-muted-foreground"> / {show.venue_capacity}</span>
                          )}
                          {capPct != null && (
                            <span className="ml-2.5 text-muted-foreground text-[12px]">
                              {capPct}% capacity
                            </span>
                          )}
                        </span>
                      </div>
                    )}

                    {show.settlement_notes && (
                      <div className="pt-3">
                        <p className="text-[10px] uppercase tracking-[0.16em] font-medium text-muted-foreground mb-1.5">
                          Notes
                        </p>
                        <p className="text-sm whitespace-pre-wrap text-muted-foreground leading-relaxed">
                          {show.settlement_notes}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Deal — ledger rows */}
                <div>
                  <LedgerRule>Deal</LedgerRule>

                  <LedgerRow label="Guarantee" accent>
                    <LedgerValue
                      fieldKey="guarantee"
                      value={show.guarantee}
                      prefix="$"
                      currency
                      accent
                      inputMode="decimal"
                    />
                  </LedgerRow>

                  <LedgerRow label="Ticket price">
                    <LedgerValue
                      fieldKey="ticket_price"
                      value={show.ticket_price}
                      prefix="$"
                      currency
                      inputMode="decimal"
                    />
                  </LedgerRow>

                  <LedgerRow label="Capacity">
                    <LedgerValue
                      fieldKey="venue_capacity"
                      value={show.venue_capacity}
                      inputMode="numeric"
                    />
                  </LedgerRow>

                  {/* Backend — structured editor expands the row when editing */}
                  {inlineField === "backend_deal" ? (
                    <div
                      ref={inlineRef}
                      className="py-2.5 border-b border-dotted border-border/80 space-y-2"
                    >
                      <span className="text-[13px] text-muted-foreground">Backend</span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="number"
                            min={1}
                            max={100}
                            step={0.5}
                            value={backendDealForm.pct}
                            onChange={(e) =>
                              setBackendDealForm((p) => ({ ...p, pct: e.target.value }))
                            }
                            className="text-sm h-9 w-20 font-mono text-right ring-1 ring-ring/40"
                            placeholder="70"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                saveBackendDeal();
                              }
                              if (e.key === "Escape") {
                                e.preventDefault();
                                cancelInline();
                              }
                            }}
                          />
                          <span className="text-sm text-muted-foreground">% of</span>
                        </div>
                        <div className="flex rounded-md bg-muted p-0.5 text-sm gap-0.5">
                          {(["GBOR", "NBOR"] as const).map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setBackendDealForm((p) => ({ ...p, basis: opt }))}
                              className={cn(
                                "px-3 py-1 rounded-sm font-medium [transition:background-color_150ms_var(--ease-out),color_150ms_var(--ease-out)]",
                                backendDealForm.basis === opt
                                  ? "bg-background text-foreground shadow-sm"
                                  : "text-muted-foreground hover:text-foreground",
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
                              onClick={() =>
                                setBackendDealForm((p) => ({ ...p, dealType: opt }))
                              }
                              className={cn(
                                "px-3 py-1 rounded-sm font-medium [transition:background-color_150ms_var(--ease-out),color_150ms_var(--ease-out)]",
                                backendDealForm.dealType === opt
                                  ? "bg-background text-foreground shadow-sm"
                                  : "text-muted-foreground hover:text-foreground",
                              )}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>

                      {backendDealForm.showTierRow ? (
                        <div className="flex items-center gap-1.5 flex-wrap text-sm text-muted-foreground">
                          <span>then</span>
                          <Input
                            type="number"
                            min={1}
                            max={100}
                            step={0.5}
                            value={backendDealForm.tier2Pct}
                            onChange={(e) =>
                              setBackendDealForm((p) => ({ ...p, tier2Pct: e.target.value }))
                            }
                            className="text-sm h-8 w-16 font-mono text-right"
                            placeholder="75"
                          />
                          <span>% above</span>
                          <Input
                            type="number"
                            min={1}
                            step={1}
                            value={backendDealForm.tier2Threshold}
                            onChange={(e) =>
                              setBackendDealForm((p) => ({
                                ...p,
                                tier2Threshold: e.target.value,
                              }))
                            }
                            className="text-sm h-8 w-24 font-mono text-right"
                            placeholder="200"
                          />
                          <span>tickets</span>
                          <button
                            type="button"
                            onClick={() =>
                              setBackendDealForm((p) => ({
                                ...p,
                                tier2Pct: "",
                                tier2Threshold: "",
                                showTierRow: false,
                              }))
                            }
                            className="text-xs text-muted-foreground hover:text-destructive ml-1"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setBackendDealForm((p) => ({ ...p, showTierRow: true }))
                          }
                          className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                        >
                          + Add escalating tier
                        </button>
                      )}

                      <InlineActions onSave={saveBackendDeal} onCancel={cancelInline} />
                    </div>
                  ) : (
                    <LedgerRow label="Backend">
                      {show.backend_deal ? (
                        <button
                          type="button"
                          onClick={startBackendDealEdit}
                          className="font-mono tracking-tight text-foreground text-[14px] leading-tight inline-block border-b border-transparent hover:border-foreground/15 transition-colors"
                        >
                          {show.backend_deal}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={startBackendDealEdit}
                          className="font-mono tracking-tight text-muted-foreground/55 hover:text-foreground/60 transition-colors text-[14px] leading-tight"
                        >
                          —
                        </button>
                      )}
                    </LedgerRow>
                  )}

                  <LedgerRow label="Artist comps">
                    <LedgerValue fieldKey="artist_comps" value={show.artist_comps} />
                  </LedgerRow>

                  <LedgerRow label="Walkout potential" hint="@ sellout">
                    <LedgerValue
                      fieldKey="walkout_potential"
                      value={show.walkout_potential}
                      prefix="$"
                      currency
                      inputMode="decimal"
                    />
                  </LedgerRow>
                </div>

                {/* Revenue Simulator — collapsible, ledger rule */}
                {showSimulator && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setProjectionOpen((v) => !v)}
                      aria-expanded={projectionOpen}
                      className="w-full flex items-center gap-2 pb-1.5 mb-2.5 border-b border-foreground/80 group text-left"
                    >
                      <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-foreground">
                        Projection
                      </span>
                      <ChevronDown
                        aria-hidden
                        className={cn(
                          "ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:text-foreground/80",
                          projectionOpen && "rotate-180",
                        )}
                      />
                    </button>
                    <div
                      className={cn(
                        "grid [transition:grid-template-rows_220ms_var(--ease-out),opacity_180ms_var(--ease-out)]",
                        projectionOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                      )}
                    >
                      <div className="overflow-hidden">
                        <div className="pt-1">
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
                              Add a{" "}
                              <span className="font-medium text-foreground">walkout potential</span>{" "}
                              or both{" "}
                              <span className="font-medium text-foreground">ticket price</span> and{" "}
                              <span className="font-medium text-foreground">capacity</span> to
                              simulate projected revenue.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
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
