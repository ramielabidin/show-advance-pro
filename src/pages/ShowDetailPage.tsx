import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Trash2, Save, X, Loader2, MapPin, MoreHorizontal, Send, CheckCircle2, FileUp, Upload } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
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
import FieldGroup from "@/components/FieldGroup";
import FieldRow from "@/components/FieldRow";
import SlackPushDialog from "@/components/SlackPushDialog";
import EmailBandDialog from "@/components/EmailBandDialog";
import ParseAdvanceForShowDialog from "@/components/ParseAdvanceForShowDialog";
import ExportPdfDialog from "@/components/ExportPdfDialog";
import GuestListEditor, { GuestListView, parseGuestList, guestTotal } from "@/components/GuestListEditor";
import ScheduleEditor, { type ScheduleRow } from "@/components/ScheduleEditor";
import EmptyFieldPrompt from "@/components/EmptyFieldPrompt";
import { toast } from "sonner";
import { cn, formatCityState } from "@/lib/utils";
import { normalizeTime } from "@/lib/timeFormat";
import type { Show } from "@/lib/types";
import RevenueSimulator, { parseDollar } from "@/components/RevenueSimulator";

export default function ShowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Inline edit: which field key is currently being edited (null = none)
  const [inlineField, setInlineField] = useState<string | null>(null);
  const [inlineValue, setInlineValue] = useState<string>("");
  const inlineRef = useRef<HTMLDivElement>(null);
  const inlineTimeFormat = useRef(false);
  const scheduleRef = useRef<HTMLDivElement>(null);

  const [lookingUpAddress, setLookingUpAddress] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(false);

  // Settle modal state
  const [settleOpen, setSettleOpen] = useState(false);
  const [settleForm, setSettleForm] = useState({
    actual_tickets_sold: "",
    actual_walkout: "",
    settlement_notes: "",
  });

  // Hotel group form state
  const [hotelForm, setHotelForm] = useState<Record<string, string>>({});

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
  const startInlineEdit = (key: string, opts?: { timeFormat?: boolean }) => {
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
  const editField = (key: keyof Show, label: string, opts?: { mono?: boolean; multiline?: boolean; alwaysShow?: boolean; timeFormat?: boolean; placeholder?: string }) => {
    // Inline editing for this specific field
    if (inlineField === key) {
      return (
        <div ref={inlineRef} className="space-y-1">
          <Label className="text-xs text-muted-foreground">{label}</Label>
          {opts?.multiline ? (
            <Textarea
              value={inlineValue}
              onChange={(e) => setInlineValue(e.target.value)}
              className="text-sm min-h-[44px]"
              autoFocus
              placeholder={opts?.placeholder}
            />
          ) : (
            <Input
              value={inlineValue}
              onChange={(e) => setInlineValue(e.target.value)}
              className={cn("text-sm h-11 sm:h-9", opts?.mono && "font-mono")}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") saveInline();
                if (e.key === "Escape") cancelInline();
              }}
              onBlur={opts?.timeFormat ? () => {
                const n = normalizeTime(inlineValue);
                if (n !== inlineValue) setInlineValue(n);
              } : undefined}
            />
          )}
          <InlineActions onSave={saveInline} onCancel={cancelInline} />
        </div>
      );
    }

    // View mode
    const value = (show as any)[key];
    if (!value && opts?.alwaysShow) {
      return <EmptyFieldPrompt label={label} onClick={() => startInlineEdit(key)} />;
    }
    if (!value) return null;

    // Clickable value to enter inline edit
    return (
      <button
        onClick={() => startInlineEdit(key)}
        className="w-full text-left group"
      >
        <FieldRow label={label} value={value} mono={opts?.mono} />
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

    return <EmptyFieldPrompt label="guest list" onClick={() => startInlineEdit("guest_list_details")} />;
  };

  return (
    <div className="animate-fade-in max-w-3xl">
      {/* Header */}
      <div className="mb-5 space-y-1.5 sm:space-y-2">
        {/* Back arrow */}
        <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7 -ml-1" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>

        {/* Tour badge */}
        {(show as any).tours?.name && (
          <Link to={`/tours/${(show as any).tours.id}`}>
            <Badge variant="secondary" className="text-[10px] uppercase tracking-widest font-medium px-2 py-0 h-5 hover:bg-secondary/80 transition-colors">
              {(show as any).tours.name}
            </Badge>
          </Link>
        )}

        {/* Settled badge */}
        {(show as any).is_settled && (
          <Badge className="text-[10px] uppercase tracking-widest font-medium px-2 py-0 h-5 bg-[hsl(var(--primary))] text-primary-foreground gap-1 ml-1">
            <CheckCircle2 className="h-2.5 w-2.5" />
            Settled
          </Badge>
        )}

        {/* Venue name */}
        <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight leading-tight">{show.venue_name}</h1>

        {/* Metadata — date · address */}
        <p className="text-xs sm:text-sm text-muted-foreground flex flex-wrap items-center gap-x-1.5">
          <span>{format(parseISO(show.date), "EEEE, MMMM d, yyyy")}</span>
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
                    const { error: updateError } = await supabase
                      .from("shows")
                      .update({ venue_address: cleanAddress })
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
          <div className="hidden md:flex items-center gap-4">
            {/* Primary: Send Advance actions */}
            <div className="flex items-center gap-1.5">
              <SlackPushDialog showId={id!} show={show as Show} />
              <EmailBandDialog show={show as Show} />
              <ExportPdfDialog show={show as Show} />
            </div>

            {/* Secondary: Import */}
            <ParseAdvanceForShowDialog
              showId={id!}
              currentShow={show as Show}
              onUpdated={() => {
                queryClient.invalidateQueries({ queryKey: ["show", id] });
                queryClient.invalidateQueries({ queryKey: ["shows"] });
              }}
              trigger={
                <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1">
                  <Upload className="h-3.5 w-3.5" />
                  Import Advance
                </Button>
              }
            />

            <Separator orientation="vertical" className="h-5" />

            {/* Settle Show — visually distinct */}
            {(show as any).is_settled ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-[hsl(142,71%,45%)] hover:text-[hsl(142,71%,35%)] hover:bg-[hsl(142,71%,45%,0.1)]"
                onClick={() => { if (confirm("Clear settlement data?")) unsettleMutation.mutate(); }}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Settled
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-8 text-xs bg-[hsl(142,71%,45%)] hover:bg-[hsl(142,71%,35%)] text-white"
                onClick={() => {
                  setSettleForm({ actual_tickets_sold: "", actual_walkout: "", settlement_notes: "" });
                  setSettleOpen(true);
                }}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Settle Show
              </Button>
            )}

            <Separator orientation="vertical" className="h-5" />

            {/* Utility: Delete in overflow */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => { if (confirm("Delete this show?")) deleteMutation.mutate(); }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Show
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Mobile */}
          <div className="flex md:hidden items-center gap-1">
            {/* Primary send actions */}
            <SlackPushDialog
              showId={id!}
              show={show as Show}
              trigger={
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                  <Send className="h-3.5 w-3.5" />
                </Button>
              }
            />
            <EmailBandDialog show={show as Show} trigger={
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                <FileUp className="h-3.5 w-3.5" />
              </Button>
            } />

            <Separator orientation="vertical" className="h-4 mx-0.5" />

            {/* Settle */}
            {(show as any).is_settled ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[10px] text-[hsl(142,71%,45%)] hover:text-[hsl(142,71%,35%)] px-2"
                onClick={() => { if (confirm("Clear settlement data?")) unsettleMutation.mutate(); }}
              >
                <CheckCircle2 className="h-3 w-3 mr-0.5" /> Settled
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-7 text-[10px] bg-[hsl(142,71%,45%)] hover:bg-[hsl(142,71%,35%)] text-white px-2"
                onClick={() => {
                  setSettleForm({ actual_tickets_sold: "", actual_walkout: "", settlement_notes: "" });
                  setSettleOpen(true);
                }}
              >
                <CheckCircle2 className="h-3 w-3 mr-0.5" /> Settle
              </Button>
            )}

            {/* Overflow: PDF, Import, Delete */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <ExportPdfDialog show={show as Show} trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Export PDF</DropdownMenuItem>} />
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
                  onClick={() => {
                    if (confirm("Delete this show?")) deleteMutation.mutate();
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Show
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {!show.is_reviewed && (
        <div className="rounded-lg border border-badge-new/30 bg-badge-new/5 p-3 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <p className="text-sm text-badge-new font-medium">
            New show created from advance email — review the details below.
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

      <div className="space-y-6 sm:space-y-8">
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
            <button onClick={() => setEditingSchedule(true)} className="w-full text-left">
              <div className="space-y-1">
                {scheduleEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 sm:gap-4 rounded px-2 sm:px-3 py-1.5"
                  >
                    <span className="font-mono text-sm w-14 sm:w-16 shrink-0 text-muted-foreground">
                      {entry.time}
                    </span>
                    <span className="text-sm text-foreground">{entry.label}</span>
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
          {(inlineField === "curfew" || show.curfew) ? editField("curfew", "Curfew") : null}
          {(inlineField === "changeover_time" || show.changeover_time) ? editField("changeover_time", "Changeover Time") : null}
        </FieldGroup>
        </div>

        <Separator />

        {/* Departure */}
        <FieldGroup title="Departure" incomplete={!show.departure_time && !show.departure_location}>
          {editField("departure_time", "Departure Time", { mono: true, alwaysShow: true, timeFormat: true })}
          {editField("departure_location", "Departure Notes", { multiline: true, alwaysShow: true, placeholder: "e.g. Car 1 leaving from hotel at 9am, Car 2 from venue at 9:30am" })}
        </FieldGroup>

        <Separator />

        {/* Day of Show Contact */}
        <FieldGroup title="Day of Show Contact" incomplete={!show.dos_contact_name && !show.dos_contact_phone}>
          {editField("dos_contact_name", "Name", { alwaysShow: true })}
          {editField("dos_contact_phone", "Phone", { mono: true, alwaysShow: true })}
        </FieldGroup>

        <Separator />

        {/* Venue Details */}
        <FieldGroup title="Venue Details" className="[&>div]:space-y-5" incomplete={!show.load_in_details && !show.parking_notes && !show.backline_provided}>
          {editField("load_in_details", "Load In", { multiline: true, alwaysShow: true })}
          {editField("parking_notes", "Parking", { multiline: true, alwaysShow: true })}
          {editField("backline_provided", "Backline", { multiline: true, alwaysShow: true })}
        </FieldGroup>

        <Separator />

        {/* At The Venue */}
        <FieldGroup title="At The Venue">
          {editField("green_room_info", "Green Room", { multiline: true, alwaysShow: true })}
          {editField("wifi_network", "WiFi Network", { mono: true, alwaysShow: true })}
          {editField("wifi_password", "WiFi Password", { mono: true, alwaysShow: true })}
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
              <button onClick={startHotelEdit} className="w-full text-left space-y-3">
                <FieldRow label="Name" value={show.hotel_name} />
                <FieldRow label="Address" value={show.hotel_address} />
                <FieldRow label="Confirmation #" value={show.hotel_confirmation} mono />
                <FieldRow label="Check In" value={show.hotel_checkin} mono />
                <FieldRow label="Check Out" value={show.hotel_checkout} mono />
              </button>
            );
          })()}
        </FieldGroup>

        {/* Travel */}
        {(inlineField === "travel_notes" || show.travel_notes) && (
          <>
            <Separator />
            <FieldGroup title="Travel">
              {editField("travel_notes", "Notes", { multiline: true })}
            </FieldGroup>
          </>
        )}

        {/* Deal — two-column grid for financial fields */}
        {(show.guarantee || show.backend_deal || show.ticket_price || show.venue_capacity || show.walkout_potential || show.hospitality || show.artist_comps) && (
          <>
            <Separator />
            <FieldGroup title="Deal">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <div>{editField("guarantee", "Guarantee", { mono: true, alwaysShow: true })}</div>
                <div>{editField("ticket_price", "Ticket Price", { mono: true, alwaysShow: true })}</div>
                <div>{editField("venue_capacity", "Capacity", { alwaysShow: true })}</div>
                <div>{editField("walkout_potential", "Walkout Potential", { mono: true, alwaysShow: true })}</div>
              </div>
              {editField("backend_deal", "Backend Deal")}
              {editField("hospitality", "Hospitality", { multiline: true })}
              {editField("artist_comps", "Artist Comps")}
            </FieldGroup>
          </>
        )}

        {/* Revenue Simulator */}
        {(() => {
          const wp = parseDollar(show.walkout_potential);
          const tp = parseDollar(show.ticket_price);
          const g = parseDollar(show.guarantee) ?? 0;
          const cap = show.venue_capacity ? parseInt(show.venue_capacity.replace(/[^0-9]/g, ""), 10) : null;
          const validCap = cap != null && !isNaN(cap) ? cap : null;
          if (wp === null && !(tp != null && tp > 0 && validCap != null)) return null;
          return (
            <>
              <Separator />
              <FieldGroup title="Revenue Simulator">
                <RevenueSimulator
                  guarantee={g}
                  walkoutPotential={wp ?? 0}
                  venueCapacity={validCap}
                  ticketPrice={tp}
                  backendDeal={show.backend_deal}
                />
              </FieldGroup>
            </>
          );
        })()}

        {/* Additional Info */}
        {(inlineField === "additional_info" || show.additional_info) && (
          <>
            <Separator />
            <FieldGroup title="Additional Info">
              {editField("additional_info", "Details", { multiline: true })}
            </FieldGroup>
          </>
        )}

        {/* Settlement Results — shown when settled */}
        {(show as any).is_settled && (
          <>
            <Separator />
            <FieldGroup title="Settlement Results">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Actual Walkout</p>
                  <p className="text-lg font-semibold font-mono text-[hsl(142,71%,45%)]">
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
                className="flex-1 h-11 sm:h-9 bg-[hsl(142,71%,45%)] hover:bg-[hsl(142,71%,35%)] text-white"
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
    </div>
  );
}
