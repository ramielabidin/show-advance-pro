import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Edit, Trash2, Save, X, Loader2, MapPin } from "lucide-react";
import { useState } from "react";
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
import FieldGroup from "@/components/FieldGroup";
import FieldRow from "@/components/FieldRow";
import SlackPushDialog from "@/components/SlackPushDialog";
import EmailBandDialog from "@/components/EmailBandDialog";
import ParseAdvanceForShowDialog from "@/components/ParseAdvanceForShowDialog";
import ExportPdfDialog from "@/components/ExportPdfDialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Show } from "@/lib/types";
import RevenueSimulator, { parseDollar } from "@/components/RevenueSimulator";
import EmptyFieldPrompt from "@/components/EmptyFieldPrompt";

export default function ShowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Show>>({});
  const [lookingUpAddress, setLookingUpAddress] = useState(false);

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

  if (isLoading) {
    return <div className="space-y-4 animate-pulse"><div className="h-8 w-48 bg-muted rounded" /><div className="h-64 bg-muted rounded-lg" /></div>;
  }

  if (!show) {
    return <div className="text-center py-20 text-muted-foreground">Show not found</div>;
  }

  const startEdit = () => {
    setForm({ ...show });
    setEditing(true);
  };

  const handleSave = () => {
    updateMutation.mutate(form);
  };

  const f = (key: keyof Show) => editing ? (form as any)[key] ?? "" : (show as any)[key];
  const setF = (key: keyof Show, value: string) => setForm((p) => ({ ...p, [key]: value }));

  const scheduleEntries = show.schedule_entries?.sort((a, b) => a.sort_order - b.sort_order) ?? [];

  const editField = (key: keyof Show, label: string, opts?: { mono?: boolean; multiline?: boolean; alwaysShow?: boolean }) => {
    if (editing) {
      return (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{label}</Label>
          {opts?.multiline ? (
            <Textarea value={f(key) ?? ""} onChange={(e) => setF(key, e.target.value)} className="text-sm" />
          ) : (
            <Input value={f(key) ?? ""} onChange={(e) => setF(key, e.target.value)} className={cn("text-sm", opts?.mono && "font-mono")} />
          )}
        </div>
      );
    }
    const value = (show as any)[key];
    if (!value && opts?.alwaysShow) {
      return <EmptyFieldPrompt label={label} onClick={startEdit} />;
    }
    return <FieldRow label={label} value={value} mono={opts?.mono} />;
  };

  return (
    <div className="animate-fade-in max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          {editing ? (
            <div className="flex gap-2">
              <Input value={f("venue_name")} onChange={(e) => setF("venue_name", e.target.value)} className="text-lg font-display" />
            </div>
          ) : (
            <h1 className="text-2xl tracking-tight">{show.venue_name}</h1>
          )}
          {editing ? (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-muted-foreground">{show.city} · {format(parseISO(show.date), "EEEE, MMMM d, yyyy")} ·</span>
              <Select
                value={f("tour_id") ?? "none"}
                onValueChange={(v) => setF("tour_id" as keyof Show, v === "none" ? "" : v)}
              >
                <SelectTrigger className="text-sm h-7 w-auto">
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
          ) : (
            <p className="text-sm text-muted-foreground mt-0.5">
              {show.city} · {format(parseISO(show.date), "EEEE, MMMM d, yyyy")}
              {(show as any).tours && (
                <>
                  {" · "}
                  <Link to={`/tours/${(show as any).tours.id}`} className="text-foreground hover:underline">
                    {(show as any).tours.name}
                  </Link>
                </>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
                <Save className="h-4 w-4 mr-1" /> Save
              </Button>
            </>
          ) : (
            <>
              <SlackPushDialog showId={id!} />
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
              <Button variant="outline" size="sm" onClick={startEdit}>
                <Edit className="h-4 w-4 mr-1" /> Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  if (confirm("Delete this show?")) deleteMutation.mutate();
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {!show.is_reviewed && (
        <div className="rounded-lg border border-badge-new/30 bg-badge-new/5 p-3 mb-6 flex items-center justify-between">
          <p className="text-sm text-badge-new font-medium">
            New show created from advance email — review the details below.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => updateMutation.mutate({ is_reviewed: true } as any)}
          >
            Mark Reviewed
          </Button>
        </div>
      )}

      <div className="space-y-8">
        {/* Venue */}
        <FieldGroup title="Venue">
          {editField("venue_address", "Address")}
          {!editing && !show.venue_address && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              disabled={lookingUpAddress}
              onClick={async () => {
                setLookingUpAddress(true);
                try {
                  const { data, error } = await supabase.functions.invoke("lookup-venue-address", {
                    body: { venue_name: show.venue_name, city: show.city },
                  });
                  if (error || data?.error) throw new Error(data?.error || error.message);
                  const { error: updateError } = await supabase
                    .from("shows")
                    .update({ venue_address: data.address })
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
              {lookingUpAddress ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />}
              Lookup Address
            </Button>
          )}
          {editField("city", "City")}
        </FieldGroup>

        <Separator />

        {/* Day of Show Contact */}
        <FieldGroup title="Day of Show Contact">
          {editField("dos_contact_name", "Name", { alwaysShow: true })}
          {editField("dos_contact_phone", "Phone", { mono: true, alwaysShow: true })}
        </FieldGroup>

        <Separator />

        {/* Departure */}
        <FieldGroup title="Departure">
          {editField("departure_time", "Time", { mono: true, alwaysShow: true })}
          {editField("departure_location", "Location", { alwaysShow: true })}
        </FieldGroup>

        <Separator />

        {/* Schedule (always visible, includes set_length/curfew/changeover) */}
        <FieldGroup title="Schedule">
          {scheduleEntries.length > 0 ? (
            <div className="space-y-1">
              {scheduleEntries.map((entry) => (
                <div
                  key={entry.id}
                  className={cn(
                    "flex items-center gap-4 rounded px-3 py-1.5",
                    entry.is_band && "bg-primary/5 font-medium"
                  )}
                >
                  <span className="font-mono text-sm w-16 shrink-0 text-muted-foreground">
                    {entry.time}
                  </span>
                  <span className="text-sm text-foreground">{entry.label}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyFieldPrompt label="schedule" onClick={startEdit} />
          )}
          {editField("set_length", "Set Length", { alwaysShow: true })}
          {editField("curfew", "Curfew", { alwaysShow: true })}
          {editField("changeover_time", "Changeover Time", { alwaysShow: true })}
        </FieldGroup>

        <Separator />

        {/* Venue Details */}
        <FieldGroup title="Venue Details" className="[&>div]:space-y-5">
          {editField("parking_notes", "Parking", { multiline: true, alwaysShow: true })}
          {editField("load_in_details", "Load In", { multiline: true, alwaysShow: true })}
          {(editing || show.green_room_info) && editField("green_room_info", "Green Room", { multiline: true })}
          {(editing || show.guest_list_details) && editField("guest_list_details", "Guest List", { multiline: true })}
        </FieldGroup>

        <Separator />

        {/* WiFi */}
        <FieldGroup title="WiFi">
          {editField("wifi_network", "Network", { mono: true, alwaysShow: true })}
          {editField("wifi_password", "Password", { mono: true, alwaysShow: true })}
        </FieldGroup>

        {/* Deal */}
        {(editing || show.guarantee || show.backend_deal || show.ticket_price || show.age_restriction || show.venue_capacity || show.merch_split || show.support_pay || show.settlement_method || show.settlement_guarantee) && (
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
            </FieldGroup>
          </>
        )}

        {/* Production */}
        {(editing || show.hospitality || show.support_act || show.backline_provided || show.catering_details) && (
          <>
            <Separator />
            <FieldGroup title="Production">
              {editField("hospitality", "Hospitality", { multiline: true })}
              {editField("support_act", "Support Act")}
              {editField("backline_provided", "Backline Provided", { multiline: true })}
              {editField("catering_details", "Catering / Meals", { multiline: true })}
            </FieldGroup>
          </>
        )}

        {/* Projections + Revenue Simulator */}
        {(editing || show.walkout_potential || show.net_gross || show.artist_comps) && (
          <>
            <Separator />
            <FieldGroup title="Projections">
              {editField("walkout_potential", "Walkout Potential", { mono: true })}
              {editField("net_gross", "Net Gross", { mono: true })}
              {editField("artist_comps", "Artist Comps")}
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

        <Separator />

        {/* Hotel */}
        <FieldGroup title="Hotel">
          {editField("hotel_name", "Name", { alwaysShow: true })}
          {editField("hotel_address", "Address", { alwaysShow: true })}
          {editField("hotel_confirmation", "Confirmation #", { mono: true, alwaysShow: true })}
          {editField("hotel_checkin", "Check In", { mono: true, alwaysShow: true })}
          {editField("hotel_checkout", "Check Out", { mono: true, alwaysShow: true })}
        </FieldGroup>

        {/* Travel */}
        {(editing || show.travel_notes) && (
          <>
            <Separator />
            <FieldGroup title="Travel">
              {editField("travel_notes", "Notes", { multiline: true })}
            </FieldGroup>
          </>
        )}

        {/* Additional Info */}
        {(editing || show.additional_info) && (
          <>
            <Separator />
            <FieldGroup title="Additional Info">
              {editField("additional_info", "Details", { multiline: true })}
            </FieldGroup>
          </>
        )}
      </div>
    </div>
  );
}
