import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Edit, Trash2, Save, X, Send, Loader2 } from "lucide-react";
import { useState } from "react";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import FieldGroup from "@/components/FieldGroup";
import FieldRow from "@/components/FieldRow";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Show } from "@/lib/types";

function SlackPushButton({ showId }: { showId: string }) {
  const [pushing, setPushing] = useState(false);
  const handlePush = async () => {
    setPushing(true);
    try {
      const { data, error } = await supabase.functions.invoke("push-slack-daysheet", {
        body: { showId },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast.success("Day sheet pushed to Slack!");
    } catch (err: any) {
      toast.error(err.message || "Failed to push to Slack");
    } finally {
      setPushing(false);
    }
  };
  return (
    <Button variant="outline" size="sm" onClick={handlePush} disabled={pushing} className="gap-1.5">
      {pushing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      Slack
    </Button>
  );
}

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

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Show>) => {
      const { schedule_entries, show_party_members, tours, ...showUpdates } = updates as any;
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
            {(show as any).tours && (
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
              <SlackPushButton showId={id!} />
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
        <FieldGroup title="Venue">
          {editField("venue_address", "Address")}
          {editField("city", "City")}
        </FieldGroup>

        <Separator />

        <FieldGroup title="Day of Show Contact">
          {editField("dos_contact_name", "Name")}
          {editField("dos_contact_phone", "Phone", { mono: true })}
        </FieldGroup>

        <Separator />

        <FieldGroup title="Departure">
          {editField("departure_time", "Time", { mono: true })}
          {editField("departure_location", "Location")}
        </FieldGroup>

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

        <Separator />

        <FieldGroup title="Venue Details">
          {editField("parking_notes", "Parking", { multiline: true })}
          {editField("load_in_details", "Load In", { multiline: true })}
          {editField("green_room_info", "Green Room", { multiline: true })}
          {editField("guest_list_details", "Guest List", { multiline: true })}
        </FieldGroup>

        <Separator />

        <FieldGroup title="WiFi">
          {editField("wifi_network", "Network", { mono: true })}
          {editField("wifi_password", "Password", { mono: true })}
        </FieldGroup>

        <Separator />

        <FieldGroup title="Settlement">
          {editField("settlement_method", "Method")}
          {editField("settlement_guarantee", "Guarantee", { mono: true })}
        </FieldGroup>

        <Separator />

        <FieldGroup title="Hotel">
          {editField("hotel_name", "Name")}
          {editField("hotel_address", "Address")}
          {editField("hotel_confirmation", "Confirmation #", { mono: true })}
          {editField("hotel_checkin", "Check In", { mono: true })}
          {editField("hotel_checkout", "Check Out", { mono: true })}
        </FieldGroup>

        <Separator />

        <FieldGroup title="Travel">
          {editField("travel_notes", "Notes", { multiline: true })}
        </FieldGroup>

        {(show.additional_info || editing) && (
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
