import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Edit, Trash2, Save, X, Loader2 } from "lucide-react";
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
import ParseAdvanceForShowDialog from "@/components/ParseAdvanceForShowDialog";
import ExportPdfDialog from "@/components/ExportPdfDialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Show } from "@/lib/types";

export default function ShowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Show>>({});

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

  const editField = (key: keyof Show, label: string, opts?: { mono?: boolean; multiline?: boolean }) => {
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
    return <FieldRow label={label} value={(show as any)[key]} mono={opts?.mono} />;
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
          <p className="text-sm text-muted-foreground mt-0.5">
            {show.city} · {format(parseISO(show.date), "EEEE, MMMM d, yyyy")}
            {!editing && (show as any).tours && (
              <>
                {" · "}
                <Link to={`/tours/${(show as any).tours.id}`} className="text-foreground hover:underline">
                  {(show as any).tours.name}
                </Link>
              </>
            )}
          </p>
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
        <FieldGroup title="Tour">
          {editing ? (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tour</Label>
              <Select
                value={f("tour_id") ?? "none"}
                onValueChange={(v) => setF("tour_id" as keyof Show, v === "none" ? "" : v)}
              >
                <SelectTrigger className="text-sm">
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
            <FieldRow
              label="Tour"
              value={(show as any).tours?.name ?? "Standalone"}
            />
          )}
        </FieldGroup>

        <Separator />

        <FieldGroup title="Venue">
          {editField("venue_address", "Address")}
          {editField("city", "City")}
        </FieldGroup>

        {(editing || show.dos_contact_name || show.dos_contact_phone) && (
          <>
            <Separator />
            <FieldGroup title="Day of Show Contact">
              {editField("dos_contact_name", "Name")}
              {editField("dos_contact_phone", "Phone", { mono: true })}
            </FieldGroup>
          </>
        )}

        {(editing || show.departure_time || show.departure_location) && (
          <>
            <Separator />
            <FieldGroup title="Departure">
              {editField("departure_time", "Time", { mono: true })}
              {editField("departure_location", "Location")}
            </FieldGroup>
          </>
        )}

        {scheduleEntries.length > 0 && (
          <>
            <Separator />
            <FieldGroup title="Schedule">
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
            </FieldGroup>
          </>
        )}

        {(editing || show.set_length || show.curfew || show.changeover_time || show.backline_provided || show.catering_details) && (
          <>
            <Separator />
            <FieldGroup title="Band / Performance">
              {editField("set_length", "Set Length")}
              {editField("curfew", "Curfew")}
              {editField("changeover_time", "Changeover Time")}
              {editField("backline_provided", "Backline Provided", { multiline: true })}
              {editField("catering_details", "Catering / Meals", { multiline: true })}
            </FieldGroup>
          </>
        )}

        {(editing || show.venue_capacity || show.ticket_price || show.age_restriction) && (
          <>
            <Separator />
            <FieldGroup title="Venue Info">
              {editField("venue_capacity", "Capacity")}
              {editField("ticket_price", "Ticket Price", { mono: true })}
              {editField("age_restriction", "Age Restriction")}
            </FieldGroup>
          </>
        )}

        {(editing || show.guarantee || show.backend_deal) && (
          <>
            <Separator />
            <FieldGroup title="Deal Terms">
              {editField("guarantee", "Guarantee", { mono: true })}
              {editField("backend_deal", "Backend Deal")}
            </FieldGroup>
          </>
        )}

        {(editing || show.hospitality || show.support_act || show.support_pay || show.merch_split) && (
          <>
            <Separator />
            <FieldGroup title="Production & Logistics">
              {editField("hospitality", "Hospitality", { multiline: true })}
              {editField("support_act", "Support Act")}
              {editField("support_pay", "Support Pay", { mono: true })}
              {editField("merch_split", "Merch Split")}
            </FieldGroup>
          </>
        )}

        {(editing || show.walkout_potential || show.net_gross || show.artist_comps) && (
          <>
            <Separator />
            <FieldGroup title="Projections & Comps">
              {editField("walkout_potential", "Walkout Potential", { mono: true })}
              {editField("net_gross", "Net Gross", { mono: true })}
              {editField("artist_comps", "Artist Comps")}
            </FieldGroup>
          </>
        )}

        {(editing || show.parking_notes || show.load_in_details || show.green_room_info || show.guest_list_details) && (
          <>
            <Separator />
            <FieldGroup title="Venue Details" className="[&>div]:space-y-5">
              {editField("parking_notes", "Parking", { multiline: true })}
              {editField("load_in_details", "Load In", { multiline: true })}
              {editField("green_room_info", "Green Room", { multiline: true })}
              {editField("guest_list_details", "Guest List", { multiline: true })}
            </FieldGroup>
          </>
        )}

        {(editing || show.wifi_network || show.wifi_password) && (
          <>
            <Separator />
            <FieldGroup title="WiFi">
              {editField("wifi_network", "Network", { mono: true })}
              {editField("wifi_password", "Password", { mono: true })}
            </FieldGroup>
          </>
        )}

        {(editing || show.settlement_method || show.settlement_guarantee) && (
          <>
            <Separator />
            <FieldGroup title="Settlement">
              {editField("settlement_method", "Method")}
              {editField("settlement_guarantee", "Guarantee", { mono: true })}
            </FieldGroup>
          </>
        )}

        {(editing || show.hotel_name || show.hotel_address || show.hotel_confirmation || show.hotel_checkin || show.hotel_checkout) && (
          <>
            <Separator />
            <FieldGroup title="Hotel">
              {editField("hotel_name", "Name")}
              {editField("hotel_address", "Address")}
              {editField("hotel_confirmation", "Confirmation #", { mono: true })}
              {editField("hotel_checkin", "Check In", { mono: true })}
              {editField("hotel_checkout", "Check Out", { mono: true })}
            </FieldGroup>
          </>
        )}

        {(editing || show.travel_notes) && (
          <>
            <Separator />
            <FieldGroup title="Travel">
              {editField("travel_notes", "Notes", { multiline: true })}
            </FieldGroup>
          </>
        )}

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
