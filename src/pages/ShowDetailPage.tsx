import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Edit, Trash2, Save, X, Loader2, MapPin, MoreHorizontal } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
            <Textarea value={f(key) ?? ""} onChange={(e) => setF(key, e.target.value)} className="text-sm min-h-[44px]" />
          ) : (
            <Input value={f(key) ?? ""} onChange={(e) => setF(key, e.target.value)} className={cn("text-sm h-11 sm:h-9", opts?.mono && "font-mono")} />
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
      {/* Header — venue card */}
      <div className="mb-8 space-y-3">
        {/* Row 1: Back arrow + venue name */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          {editing ? (
            <Input value={f("venue_name")} onChange={(e) => setF("venue_name", e.target.value)} className="text-lg sm:text-2xl font-bold h-auto py-1" />
          ) : (
            <h1 className="text-lg sm:text-2xl font-bold tracking-tight">{show.venue_name}</h1>
          )}
        </div>

        {/* Row 2: Address or city fallback + lookup */}
        <div className="pl-10">
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
            <>
              {show.venue_address ? (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(show.venue_address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors"
                >
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {show.venue_address}
                </a>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span>{show.city}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-xs text-muted-foreground hover:text-foreground h-6 px-2"
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
                    Lookup Address
                  </Button>
                </div>
              )}

              {/* Row 3: City · Date · Tour */}
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
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
            </>
          )}
        </div>

        {/* Row 4: Action buttons */}
        <div className="pl-10">
          {editing ? (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)} className="h-8 text-xs">
                <X className="h-3.5 w-3.5 mr-1" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending} className="h-8 text-xs">
                <Save className="h-3.5 w-3.5 mr-1" />
                Save
              </Button>
            </div>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden md:flex items-center gap-1.5">
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
                <Button variant="outline" size="sm" onClick={startEdit} className="h-8 text-xs">
                  <Edit className="h-3.5 w-3.5 mr-1" /> Edit
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
              <div className="flex md:hidden items-center gap-1.5">
                <SlackPushDialog showId={id!} />
                <Button variant="outline" size="sm" onClick={startEdit} className="h-8 text-xs">
                  <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
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
        {/* Schedule */}
        <FieldGroup title="Schedule">
          {scheduleEntries.length > 0 ? (
            <div className="space-y-1">
              {scheduleEntries.map((entry) => (
                <div
                  key={entry.id}
                  className={cn(
                    "flex items-center gap-3 sm:gap-4 rounded px-2 sm:px-3 py-1.5",
                    entry.is_band && "bg-primary/5 font-medium"
                  )}
                >
                  <span className="font-mono text-sm w-14 sm:w-16 shrink-0 text-muted-foreground">
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

        {/* Departure */}
        <FieldGroup title="Departure">
          {editField("departure_time", "Departure Time", { mono: true, alwaysShow: true })}
          {editField("departure_location", "Meetup Location", { alwaysShow: true })}
        </FieldGroup>

        <Separator />

        {/* Day of Show Contact */}
        <FieldGroup title="Day of Show Contact">
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
          {editField("guest_list_details", "Guest List", { multiline: true, alwaysShow: true })}
        </FieldGroup>

        <Separator />

        {/* Hotel */}
        <FieldGroup title="Hotel">
          {!editing && !show.hotel_name && !show.hotel_address && !show.hotel_confirmation && !show.hotel_checkin && !show.hotel_checkout ? (
            <EmptyFieldPrompt label="hotel" onClick={startEdit} />
          ) : (
            <>
              {editField("hotel_name", "Name", { alwaysShow: true })}
              {editField("hotel_address", "Address", { alwaysShow: true })}
              {editField("hotel_confirmation", "Confirmation #", { mono: true, alwaysShow: true })}
              {editField("hotel_checkin", "Check In", { mono: true, alwaysShow: true })}
              {editField("hotel_checkout", "Check Out", { mono: true, alwaysShow: true })}
            </>
          )}
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
