import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, Trash2, Save, X, Loader2, MapPin, MoreHorizontal, Send, CheckCircle2 } from "lucide-react";
import { useState, useRef, useCallback, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

  // Global edit mode (power-user mode)
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Show>>({});

  // Inline edit: which field key is currently being edited (null = none)
  const [inlineField, setInlineField] = useState<string | null>(null);
  const [inlineValue, setInlineValue] = useState<string>("");
  const inlineRef = useRef<HTMLDivElement>(null);
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

  const { data: toursList = [] } = useQuery({
    queryKey: ["tours"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tours").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
    enabled: editing,
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
      setEditing(false);
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

  // --- Global edit helpers ---
  const startEdit = () => {
    setInlineField(null);
    setForm({ ...show });
    setEditing(true);
    setEditingSchedule(true);
  };

  const handleSave = () => {
    updateMutation.mutate(form);
  };

  const f = (key: keyof Show) => editing ? (form as any)[key] ?? "" : (show as any)[key];
  const setF = (key: keyof Show, value: string) => setForm((p) => ({ ...p, [key]: value }));

  // --- Inline edit helpers ---
  const startInlineEdit = (key: string) => {
    if (editing) return; // Don't start inline when global edit is active
    setInlineField(key);
    setInlineValue((show as any)[key] ?? "");
  };

  const cancelInline = () => {
    setInlineField(null);
    setInlineValue("");
  };

  const saveInline = () => {
    if (!inlineField) return;
    updateMutation.mutate({ [inlineField]: inlineValue || null } as any);
  };

  // --- Hotel group inline edit ---
  const startHotelEdit = () => {
    if (editing) return;
    setInlineField("hotel_group");
    // We'll use form state for hotel group
    setForm({
      hotel_name: show.hotel_name ?? "",
      hotel_address: show.hotel_address ?? "",
      hotel_confirmation: show.hotel_confirmation ?? "",
      hotel_checkin: show.hotel_checkin ?? "",
      hotel_checkout: show.hotel_checkout ?? "",
    });
  };

  const saveHotelGroup = () => {
    updateMutation.mutate({
      hotel_name: (form.hotel_name as string) || null,
      hotel_address: (form.hotel_address as string) || null,
      hotel_confirmation: (form.hotel_confirmation as string) || null,
      hotel_checkin: (form.hotel_checkin as string) || null,
      hotel_checkout: (form.hotel_checkout as string) || null,
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

  // Renders a field that supports both global edit and inline edit
  const editField = (key: keyof Show, label: string, opts?: { mono?: boolean; multiline?: boolean; alwaysShow?: boolean; timeFormat?: boolean; placeholder?: string }) => {
    // Global edit mode — same as before
    if (editing) {
      return (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{label}</Label>
          {opts?.multiline ? (
            <Textarea value={f(key) ?? ""} onChange={(e) => setF(key, e.target.value)} className="text-sm min-h-[44px]" placeholder={opts?.placeholder} />
          ) : (
            <Input
              value={f(key) ?? ""}
              onChange={(e) => setF(key, e.target.value)}
              className={cn("text-sm h-11 sm:h-9", opts?.mono && "font-mono")}
              onBlur={opts?.timeFormat ? () => {
                const v = f(key);
                if (v) { const n = normalizeTime(v); if (n !== v) setF(key, n); }
              } : undefined}
            />
          )}
        </div>
      );
    }

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

    if (editing) {
      return (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Guest List</Label>
          <GuestListEditor
            value={f("guest_list_details")}
            capacity={show.venue_capacity}
            compsAllotment={show.artist_comps}
            onChange={(val) => setF("guest_list_details" as keyof Show, val)}
          />
        </div>
      );
    }

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
      <div className="mb-5 space-y-1 sm:space-y-2">
        {/* Row 1: Back arrow + Tour badge + venue name */}
        <div className="flex items-start gap-2">
          <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7 mt-0.5" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 space-y-0.5">
            {/* Tour category badge */}
            {!editing && (show as any).tours?.name && (
              <Link to={`/tours/${(show as any).tours.id}`}>
                <Badge variant="secondary" className="text-[10px] uppercase tracking-widest font-medium px-2 py-0 h-5 hover:bg-secondary/80 transition-colors">
                  {(show as any).tours.name}
                </Badge>
              </Link>
            )}
            {/* Settled badge */}
            {!editing && (show as any).is_settled && (
              <Badge className="text-[10px] uppercase tracking-widest font-medium px-2 py-0 h-5 bg-green-600 hover:bg-green-600 text-white gap-1">
                <CheckCircle2 className="h-2.5 w-2.5" />
                Settled
              </Badge>
            )}
            {editing ? (
              <Input value={f("venue_name")} onChange={(e) => setF("venue_name", e.target.value)} className="text-lg sm:text-2xl font-bold h-auto py-1" />
            ) : (
              <h1 className="text-lg sm:text-2xl font-display font-bold tracking-tight leading-tight">{show.venue_name}</h1>
            )}
          </div>
        </div>

        {/* Row 2: Metadata — date · city · address */}
        <div className="pl-9 sm:pl-10 space-y-0.5">
          {editing ? (
            <div className="space-y-2">
              <Input value={f("venue_address") ?? ""} onChange={(e) => setF("venue_address", e.target.value)} placeholder="Venue address" className="text-sm h-9" />
              <div className="flex items-center gap-2">
                <Input value={f("city")} onChange={(e) => setF("city", e.target.value)} placeholder="City" className="text-sm h-9 w-40" />
                <Select
                  value={f("tour_id") ?? "none"}
                  onValueChange={(v) => setF("tour_id" as keyof Show, v === "none" ? "" : v)}
                >
                  <SelectTrigger className="text-sm h-9 w-full sm:w-auto">
                    <SelectValue placeholder="Standalone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Standalone</SelectItem>
                    {toursList.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
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
          )}
        </div>

        {/* Action buttons */}
        <div className="pl-8 pt-0.5">
          {editing ? (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setEditingSchedule(false); }} className="h-7 sm:h-8 text-xs">
                <X className="h-3.5 w-3.5 mr-1" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending} className="h-7 sm:h-8 text-xs">
                <Save className="h-3.5 w-3.5 mr-1" />
                Save
              </Button>
            </div>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden md:flex items-center gap-1.5">
                <SlackPushDialog showId={id!} show={show as Show} />
                <EmailBandDialog show={show as Show} />
                <ExportPdfDialog show={show as Show} />
                <ParseAdvanceForShowDialog
                  showId={id!}
                  currentShow={show as Show}
                  onUpdated={() => {
                    queryClient.invalidateQueries({ queryKey: ["show", id] });
                    queryClient.invalidateQueries({ queryKey: ["shows"] });
                  }}
                />
                {(show as any).is_settled ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-green-600 hover:text-green-700"
                    onClick={() => { if (confirm("Clear settlement data?")) unsettleMutation.mutate(); }}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Settled
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => {
                      setSettleForm({ actual_tickets_sold: "", actual_walkout: "", settlement_notes: "" });
                      setSettleOpen(true);
                    }}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Settle Show
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={startEdit} className="h-8 text-xs">
                  <Edit className="h-3.5 w-3.5 mr-1" /> Edit All
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => {
                    if (confirm("Delete this show?")) deleteMutation.mutate();
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Mobile */}
              <div className="flex md:hidden items-center gap-1">
                <SlackPushDialog
                  showId={id!}
                  show={show as Show}
                  trigger={
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                  }
                />
                <Button variant="ghost" size="icon" onClick={startEdit} className="h-7 w-7 text-muted-foreground hover:text-foreground">
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <EmailBandDialog show={show as Show} trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Email Band</DropdownMenuItem>} />
                    <ExportPdfDialog show={show as Show} trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Export PDF</DropdownMenuItem>} />
                    <ParseAdvanceForShowDialog
                      showId={id!}
                      currentShow={show as Show}
                      onUpdated={() => {
                        queryClient.invalidateQueries({ queryKey: ["show", id] });
                        queryClient.invalidateQueries({ queryKey: ["shows"] });
                      }}
                      trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Parse Advance</DropdownMenuItem>}
                    />
                    {(show as any).is_settled ? (
                      <DropdownMenuItem
                        onClick={() => { if (confirm("Clear settlement data?")) unsettleMutation.mutate(); }}
                      >
                        Clear Settlement
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault();
                          setSettleForm({ actual_tickets_sold: "", actual_walkout: "", settlement_notes: "" });
                          setSettleOpen(true);
                        }}
                      >
                        Settle Show
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => {
                        if (confirm("Delete this show?")) deleteMutation.mutate();
                      }}
                    >
                      Delete Show
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </>
          )}
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
        <FieldGroup title="Schedule" incomplete={!editing && !editingSchedule && scheduleEntries.length === 0}>
          {editingSchedule ? (
            <ScheduleEditor
              initial={scheduleEntries.map((e) => ({ time: e.time, label: e.label, is_band: e.is_band }))}
              onSave={async (rows) => {
                try {
                  // Delete existing entries
                  await supabase.from("schedule_entries").delete().eq("show_id", id!);
                  // Insert new entries
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
          {(editing || inlineField === "curfew" || show.curfew) ? editField("curfew", "Curfew") : null}
          {(editing || inlineField === "changeover_time" || show.changeover_time) ? editField("changeover_time", "Changeover Time") : null}
        </FieldGroup>
        </div>

        <Separator />

        {/* Departure */}
        <FieldGroup title="Departure" incomplete={!editing && !show.departure_time && !show.departure_location}>
          {editField("departure_time", "Departure Time", { mono: true, alwaysShow: true, timeFormat: true })}
          {editField("departure_location", "Departure Notes", { multiline: true, alwaysShow: true, placeholder: "e.g. Car 1 leaving from Rami's at 9am, Car 2 from JT's at 9:30am" })}
        </FieldGroup>

        <Separator />

        {/* Day of Show Contact */}
        <FieldGroup title="Day of Show Contact" incomplete={!editing && !show.dos_contact_name && !show.dos_contact_phone}>
          {editField("dos_contact_name", "Name", { alwaysShow: true })}
          {editField("dos_contact_phone", "Phone", { mono: true, alwaysShow: true })}
        </FieldGroup>

        <Separator />

        {/* Venue Details */}
        <FieldGroup title="Venue Details" className="[&>div]:space-y-5" incomplete={!editing && !show.load_in_details && !show.parking_notes && !show.backline_provided}>
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

        {/* Hotel */}
        <FieldGroup title="Hotel">
          {(() => {
            const hotelEmpty = !show.hotel_name && !show.hotel_address && !show.hotel_confirmation && !show.hotel_checkin && !show.hotel_checkout;
            const isHotelInline = inlineField === "hotel_group";

            if (editing) {
              return (
                <>
                  {editField("hotel_name", "Name", { alwaysShow: true })}
                  {editField("hotel_address", "Address", { alwaysShow: true })}
                  {editField("hotel_confirmation", "Confirmation #", { mono: true, alwaysShow: true })}
                  {editField("hotel_checkin", "Check In", { mono: true, alwaysShow: true })}
                  {editField("hotel_checkout", "Check Out", { mono: true, alwaysShow: true })}
                </>
              );
            }

            if (isHotelInline) {
              return (
                <div ref={inlineRef} className="space-y-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Name</Label>
                    <Input value={form.hotel_name ?? ""} onChange={(e) => setForm(p => ({ ...p, hotel_name: e.target.value }))} className="text-sm h-9" autoFocus />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Address</Label>
                    <Input value={form.hotel_address ?? ""} onChange={(e) => setForm(p => ({ ...p, hotel_address: e.target.value }))} className="text-sm h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Confirmation #</Label>
                    <Input value={form.hotel_confirmation ?? ""} onChange={(e) => setForm(p => ({ ...p, hotel_confirmation: e.target.value }))} className="text-sm h-9 font-mono" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Check In</Label>
                    <Input value={form.hotel_checkin ?? ""} onChange={(e) => setForm(p => ({ ...p, hotel_checkin: e.target.value }))} className="text-sm h-9 font-mono" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Check Out</Label>
                    <Input value={form.hotel_checkout ?? ""} onChange={(e) => setForm(p => ({ ...p, hotel_checkout: e.target.value }))} className="text-sm h-9 font-mono" />
                  </div>
                  <InlineActions onSave={saveHotelGroup} onCancel={cancelInline} />
                </div>
              );
            }

            if (hotelEmpty) {
              return <EmptyFieldPrompt label="hotel" onClick={startHotelEdit} />;
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
        {(editing || inlineField === "travel_notes" || show.travel_notes) && (
          <>
            <Separator />
            <FieldGroup title="Travel">
              {editField("travel_notes", "Notes", { multiline: true })}
            </FieldGroup>
          </>
        )}

        {/* Deal */}
        {(editing || show.guarantee || show.backend_deal || show.ticket_price || show.age_restriction || show.venue_capacity || show.merch_split || show.support_pay || show.settlement_method || show.settlement_guarantee || show.artist_comps) && (
          <>
            <Separator />
            <FieldGroup title="Deal">
              {editField("guarantee", "Guarantee", { mono: true })}
              {editField("backend_deal", "Backend Deal")}
              {editField("ticket_price", "Ticket Price", { mono: true })}
              {editField("age_restriction", "Age Restriction")}
              {editField("venue_capacity", "Capacity")}
              {editField("merch_split", "Merch Split")}
              {editField("support_pay", "Support Pay", { mono: true })}
              {editField("settlement_method", "Settlement Method")}
              {editField("settlement_guarantee", "Settlement Guarantee", { mono: true })}
              {editField("artist_comps", "Artist Comps")}
            </FieldGroup>
          </>
        )}

        {/* Production */}
        {(editing || show.hospitality || show.support_act || show.catering_details) && (
          <>
            <Separator />
            <FieldGroup title="Production">
              {editField("hospitality", "Hospitality", { multiline: true })}
              {editField("support_act", "Support Act")}
              {editField("catering_details", "Catering / Meals", { multiline: true })}
            </FieldGroup>
          </>
        )}

        {/* Projections */}
        {(editing || show.walkout_potential || show.net_gross) && (
          <>
            <Separator />
            <FieldGroup title="Projections">
              {editField("walkout_potential", "Walkout Potential", { mono: true })}
              {editField("net_gross", "Net Gross", { mono: true })}
            </FieldGroup>
          </>
        )}

        {!editing && (() => {
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
        {(editing || inlineField === "additional_info" || show.additional_info) && (
          <>
            <Separator />
            <FieldGroup title="Additional Info">
              {editField("additional_info", "Details", { multiline: true })}
            </FieldGroup>
          </>
        )}

        {/* Settlement Results — shown when settled */}
        {!editing && (show as any).is_settled && (
          <>
            <Separator />
            <FieldGroup title="Settlement Results">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Actual vs Projected Walkout */}
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Actual Walkout</p>
                  <p className="text-lg font-semibold font-mono text-green-600">
                    {(show as any).actual_walkout || "—"}
                  </p>
                  {show.walkout_potential && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Projected: {show.walkout_potential}
                    </p>
                  )}
                </div>
                {/* Actual Tickets Sold */}
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
                className="flex-1 h-11 sm:h-9 bg-green-600 hover:bg-green-700 text-white"
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
