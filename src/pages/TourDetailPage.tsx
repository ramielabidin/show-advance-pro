import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Edit, Trash2, Save, X, Plus, Calendar } from "lucide-react";
import BulkUploadDialog from "@/components/BulkUploadDialog";
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
import ShowCard from "@/components/ShowCard";
import CreateShowDialog from "@/components/CreateShowDialog";
import { toast } from "sonner";
import EmptyState from "@/components/EmptyState";
import TourRevenueSimulator from "@/components/TourRevenueSimulator";

export default function TourDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [addingShow, setAddingShow] = useState(false);
  const [selectedShowId, setSelectedShowId] = useState("");

  const { data: tour, isLoading } = useQuery({
    queryKey: ["tour", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tours")
        .select("*, shows(*)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: standaloneShows = [] } = useQuery({
    queryKey: ["standalone-shows"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shows")
        .select("*")
        .is("tour_id", null)
        .order("date");
      if (error) throw error;
      return data;
    },
    enabled: addingShow,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: any) => {
      const { shows, ...tourUpdates } = updates;
      const { error } = await supabase.from("tours").update(tourUpdates).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tour", id] });
      queryClient.invalidateQueries({ queryKey: ["tours"] });
      setEditing(false);
      toast.success("Tour updated");
    },
    onError: () => toast.error("Failed to update tour"),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await supabase.from("shows").update({ tour_id: null }).eq("tour_id", id!);
      const { error } = await supabase.from("tours").delete().eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tours"] });
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      navigate("/tours");
      toast.success("Tour deleted");
    },
  });

  const addShowMutation = useMutation({
    mutationFn: async (showId: string) => {
      const { error } = await supabase.from("shows").update({ tour_id: id }).eq("id", showId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tour", id] });
      queryClient.invalidateQueries({ queryKey: ["standalone-shows"] });
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      setSelectedShowId("");
      setAddingShow(false);
      toast.success("Show added to tour");
    },
  });

  const removeShowMutation = useMutation({
    mutationFn: async (showId: string) => {
      const { error } = await supabase.from("shows").update({ tour_id: null }).eq("id", showId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tour", id] });
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      toast.success("Show removed from tour");
    },
  });

  if (isLoading) {
    return <div className="space-y-4 animate-pulse"><div className="h-8 w-48 bg-muted rounded" /><div className="h-64 bg-muted rounded-lg" /></div>;
  }

  if (!tour) {
    return <div className="text-center py-20 text-muted-foreground">Tour not found</div>;
  }

  const shows = ((tour as any).shows as any[]) ?? [];
  const sortedShows = [...shows].sort((a, b) => a.date.localeCompare(b.date));

  const startEdit = () => {
    setForm({ name: tour.name, start_date: tour.start_date ?? "", end_date: tour.end_date ?? "", notes: tour.notes ?? "" });
    setEditing(true);
  };

  return (
    <div className="animate-fade-in max-w-3xl">
      <div className="flex items-start sm:items-center gap-2 sm:gap-3 mb-6">
        <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9" onClick={() => navigate("/tours")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          {editing ? (
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="text-base sm:text-lg font-display h-11 sm:h-9" />
          ) : (
            <h1 className="text-xl sm:text-2xl tracking-tight truncate">{tour.name}</h1>
          )}
          {tour.start_date && tour.end_date && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              {format(parseISO(tour.start_date), "MMM d")} – {format(parseISO(tour.end_date), "MMM d, yyyy")} · {shows.length} show{shows.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {editing ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)} className="h-9">
                <X className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Cancel</span>
              </Button>
              <Button size="sm" onClick={() => updateMutation.mutate(form)} disabled={updateMutation.isPending} className="h-9">
                <Save className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Save</span>
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={startEdit} className="h-9">
                <Edit className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Edit</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive h-9"
                onClick={() => {
                  if (confirm("Delete this tour? Shows will become standalone.")) deleteMutation.mutate();
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {editing && (
        <div className="space-y-4 mb-8 rounded-lg border bg-card p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="h-11 sm:h-9" />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="h-11 sm:h-9" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
      )}

      {!editing && tour.notes && (
        <p className="text-sm text-muted-foreground mb-6">{tour.notes}</p>
      )}

      {!editing && sortedShows.length > 0 && (
        <div className="mb-6">
          <TourRevenueSimulator shows={sortedShows} />
        </div>
      )}

      <Separator className="mb-6" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Shows</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <CreateShowDialog defaultTourId={id} />
          <BulkUploadDialog defaultTourId={id} />
          <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={() => setAddingShow(!addingShow)}>
            <Plus className="h-4 w-4" />
            Link Existing
          </Button>
        </div>
      </div>

      {addingShow && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-4 p-3 rounded-lg border bg-card">
          <Select value={selectedShowId} onValueChange={setSelectedShowId}>
            <SelectTrigger className="flex-1 h-11 sm:h-9">
              <SelectValue placeholder="Select a standalone show…" />
            </SelectTrigger>
            <SelectContent>
              {standaloneShows.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.venue_name} — {s.city} ({format(parseISO(s.date), "MMM d")})
                </SelectItem>
              ))}
              {standaloneShows.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">No standalone shows available</div>
              )}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Button size="sm" className="h-9 flex-1 sm:flex-none" disabled={!selectedShowId || addShowMutation.isPending} onClick={() => addShowMutation.mutate(selectedShowId)}>
              Add
            </Button>
            <Button size="sm" variant="ghost" className="h-9" onClick={() => setAddingShow(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {sortedShows.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No shows in this tour"
          description="Add existing standalone shows or create new ones and assign them here."
        />
      ) : (
        <div className="space-y-2">
          {sortedShows.map((show) => (
            <div key={show.id} className="group relative">
              <ShowCard show={show} />
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  removeShowMutation.mutate(show.id);
                }}
                className="absolute right-2 sm:right-12 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-muted-foreground hover:text-destructive bg-card/80 px-2 py-1 rounded"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
