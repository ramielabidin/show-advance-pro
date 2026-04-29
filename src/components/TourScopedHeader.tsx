import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Edit, MoreHorizontal, Plus, Save, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import CreateShowDialog from "@/components/CreateShowDialog";
import BulkUploadDialog from "@/components/BulkUploadDialog";
import { useTeam } from "@/components/TeamProvider";
import { formatCityState } from "@/lib/utils";
import { toast } from "sonner";
import type { Show, Tour } from "@/lib/types";

interface TourScopedHeaderProps {
  tour: Tour;
  tourShows: Show[];
  onTourDeleted: () => void;
}

export default function TourScopedHeader({ tour, tourShows, onTourDeleted }: TourScopedHeaderProps) {
  const queryClient = useQueryClient();
  const { isArtist } = useTeam();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<{ name: string; notes: string; startDate: string; endDate: string }>({
    name: tour.name,
    notes: tour.notes ?? "",
    startDate: "",
    endDate: "",
  });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [linkingOpen, setLinkingOpen] = useState(false);
  const [selectedShowId, setSelectedShowId] = useState("");

  const sortedShows = [...tourShows].sort((a, b) => a.date.localeCompare(b.date));
  const computedStart = sortedShows[0]?.date ?? null;
  const computedEnd = sortedShows[sortedShows.length - 1]?.date ?? null;
  // Explicit tour.start_date / end_date override the computed show range.
  const start = tour.start_date ?? computedStart;
  const end = tour.end_date ?? computedEnd;
  const settledCount = tourShows.filter((s) => s.is_settled).length;

  const { data: standaloneShows = [] } = useQuery({
    queryKey: ["standalone-shows"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shows")
        .select("*")
        .is("tour_id", null)
        .order("date");
      if (error) throw error;
      return data as Show[];
    },
    enabled: linkingOpen,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: { name: string; notes: string; startDate: string; endDate: string }) => {
      if (updates.startDate && updates.endDate && updates.startDate > updates.endDate) {
        throw new Error("Start date must be on or before end date.");
      }
      const { error } = await supabase
        .from("tours")
        .update({
          name: updates.name,
          notes: updates.notes || null,
          start_date: updates.startDate || null,
          end_date: updates.endDate || null,
        })
        .eq("id", tour.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tours"] });
      queryClient.invalidateQueries({ queryKey: ["tour", tour.id] });
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      setEditing(false);
      toast.success("Tour updated");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to update tour"),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await supabase.from("shows").update({ tour_id: null }).eq("tour_id", tour.id);
      const { error } = await supabase.from("tours").delete().eq("id", tour.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tours"] });
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      toast.success("Tour deleted");
      onTourDeleted();
    },
    onError: (err: Error) => toast.error(err.message || "Failed to delete tour"),
  });

  const linkShowMutation = useMutation({
    mutationFn: async (showId: string) => {
      const { error } = await supabase.from("shows").update({ tour_id: tour.id }).eq("id", showId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      queryClient.invalidateQueries({ queryKey: ["tours"] });
      queryClient.invalidateQueries({ queryKey: ["standalone-shows"] });
      setSelectedShowId("");
      setLinkingOpen(false);
      toast.success("Show added to tour");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to add show"),
  });

  const startEdit = () => {
    setForm({
      name: tour.name,
      notes: tour.notes ?? "",
      startDate: tour.start_date ?? "",
      endDate: tour.end_date ?? "",
    });
    setEditing(true);
  };

  return (
    <div className="mb-6">
      <div className="flex items-start sm:items-center justify-between gap-4 mb-2">
        <div className="min-w-0 flex-1">
          {editing ? (
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="font-display text-3xl md:text-4xl tracking-[-0.02em] h-12 sm:h-14"
            />
          ) : (
            <h1 className="font-display text-3xl md:text-4xl tracking-[-0.02em] leading-[1.1] text-foreground break-words">
              {tour.name}
            </h1>
          )}
          {start && (
            <p className="text-muted-foreground text-sm mt-1">
              {end && start !== end
                ? <>{format(parseISO(start), "MMM d")} – {format(parseISO(end), "MMM d, yyyy")}</>
                : <>{format(parseISO(start), "MMM d, yyyy")}</>}
            </p>
          )}
          {tourShows.length > 0 && (
            <p className="text-muted-foreground text-sm mt-0.5">
              {settledCount} of {tourShows.length} complete
            </p>
          )}
        </div>
        {!isArtist && (
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {editing ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(false)}
                  className="h-11 sm:h-9"
                >
                  <X className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Cancel</span>
                </Button>
                <Button
                  size="sm"
                  onClick={() => updateMutation.mutate(form)}
                  disabled={!form.name.trim() || updateMutation.isPending}
                  className="h-11 sm:h-9"
                >
                  <Save className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Save</span>
                </Button>
              </>
            ) : (
              <>
                <CreateShowDialog defaultTourId={tour.id} />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-9 sm:w-9">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={startEdit}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit tour
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setLinkingOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Link existing show
                    </DropdownMenuItem>
                    <BulkImportMenuItem tourId={tour.id} />
                    <DropdownMenuItem
                      onSelect={() => setDeleteConfirmOpen(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete tour
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        )}
      </div>

      {editing && (
        <div className="space-y-3 mb-3 rounded-lg border bg-card p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="tour-start-date">Start date</Label>
              <Input
                id="tour-start-date"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                placeholder={computedStart ?? ""}
              />
              <p className="text-[11px] text-muted-foreground">
                {computedStart
                  ? `Leave empty to use first show (${format(parseISO(computedStart), "MMM d, yyyy")}).`
                  : "Leave empty to auto-set when shows are added."}
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="tour-end-date">End date</Label>
              <Input
                id="tour-end-date"
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                placeholder={computedEnd ?? ""}
              />
              <p className="text-[11px] text-muted-foreground">
                {computedEnd
                  ? `Leave empty to use last show (${format(parseISO(computedEnd), "MMM d, yyyy")}).`
                  : "Leave empty to auto-set when shows are added."}
              </p>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="tour-notes">Notes</Label>
            <Textarea
              id="tour-notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Internal notes for this tour…"
            />
          </div>
        </div>
      )}

      {!editing && tour.notes && (
        <p className="text-sm text-muted-foreground mt-2">{tour.notes}</p>
      )}

      {linkingOpen && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-3 p-3 rounded-lg border bg-card">
          <Select value={selectedShowId} onValueChange={setSelectedShowId}>
            <SelectTrigger className="flex-1 h-11 sm:h-9">
              <SelectValue placeholder="Select a standalone show…" />
            </SelectTrigger>
            <SelectContent>
              {standaloneShows.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.venue_name} — {formatCityState(s.city)} ({format(parseISO(s.date), "MMM d")})
                </SelectItem>
              ))}
              {standaloneShows.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  No standalone shows available
                </div>
              )}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="h-9 flex-1 sm:flex-none"
              disabled={!selectedShowId || linkShowMutation.isPending}
              onClick={() => linkShowMutation.mutate(selectedShowId)}
            >
              Add
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-9"
              onClick={() => {
                setLinkingOpen(false);
                setSelectedShowId("");
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this tour?</AlertDialogTitle>
            <AlertDialogDescription>
              Shows in this tour will become standalone. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                deleteMutation.mutate();
                setDeleteConfirmOpen(false);
              }}
            >
              Delete tour
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BulkImportMenuItem({ tourId }: { tourId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <DropdownMenuItem onSelect={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-2" />
        Import CSV to tour
      </DropdownMenuItem>
      <BulkUploadDialog defaultTourId={tourId} externalOpen={open} onExternalOpenChange={setOpen} />
    </>
  );
}
