import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { isPast, isToday, parseISO } from "date-fns";
import { Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ShowCard from "@/components/ShowCard";
import CreateShowDialog from "@/components/CreateShowDialog";
import PasteAdvanceDialog from "@/components/PasteAdvanceDialog";
import BulkUploadDialog from "@/components/BulkUploadDialog";
import EmptyState from "@/components/EmptyState";
import TourPicker from "@/components/TourPicker";
import TourScopedHeader from "@/components/TourScopedHeader";
import TourRevenueSimulator from "@/components/TourRevenueSimulator";
import { cn } from "@/lib/utils";
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
import type { Show, Tour } from "@/lib/types";

type View = "all" | "tour" | "standalone";
type ShowWithTour = Show & { tours?: { id: string; name: string } | null };

function parseView(raw: string | null): View {
  if (raw === "tour" || raw === "standalone") return raw;
  return "all";
}

export default function ShowsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = parseView(searchParams.get("view"));
  const tourId = searchParams.get("tourId");

  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingRemoveFromTourId, setPendingRemoveFromTourId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const setView = (next: View) => {
    const params = new URLSearchParams(searchParams);
    if (next === "all") {
      params.delete("view");
      params.delete("tourId");
    } else {
      params.set("view", next);
      if (next !== "tour") params.delete("tourId");
    }
    setSearchParams(params, { replace: true });
  };

  const setTourId = (next: string | null) => {
    const params = new URLSearchParams(searchParams);
    params.set("view", "tour");
    if (next) params.set("tourId", next);
    else params.delete("tourId");
    setSearchParams(params, { replace: true });
  };

  const clearTour = () => {
    const params = new URLSearchParams(searchParams);
    params.delete("view");
    params.delete("tourId");
    setSearchParams(params, { replace: true });
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shows").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Show deleted");
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      queryClient.invalidateQueries({ queryKey: ["schedule-info"] });
      queryClient.invalidateQueries({ queryKey: ["tours"] });
    },
    onError: (err: Error) => {
      toast.error("Failed to delete show: " + err.message);
    },
  });

  const removeFromTourMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shows").update({ tour_id: null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Show removed from tour");
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      queryClient.invalidateQueries({ queryKey: ["tours"] });
    },
    onError: (err: Error) => {
      toast.error("Failed to remove show: " + err.message);
    },
  });

  const { data: shows = [], isLoading } = useQuery<ShowWithTour[]>({
    queryKey: ["shows"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shows")
        .select("*, tours(id, name)")
        .order("date", { ascending: true });
      if (error) throw error;
      return data as ShowWithTour[];
    },
  });

  const { data: scheduleMap = {} } = useQuery({
    queryKey: ["schedule-info"],
    queryFn: async () => {
      const { data, error } = await supabase.from("schedule_entries").select("show_id, label");
      if (error) throw error;
      const map: Record<string, { hasSchedule: boolean; hasLoadIn: boolean }> = {};
      data.forEach((e) => {
        if (!map[e.show_id]) map[e.show_id] = { hasSchedule: false, hasLoadIn: false };
        map[e.show_id].hasSchedule = true;
        if (e.label.toLowerCase().includes("load")) map[e.show_id].hasLoadIn = true;
      });
      return map;
    },
  });

  const { data: tour } = useQuery<Tour | null>({
    queryKey: ["tour", tourId],
    queryFn: async () => {
      if (!tourId) return null;
      const { data, error } = await supabase
        .from("tours")
        .select("*")
        .eq("id", tourId)
        .maybeSingle();
      if (error) throw error;
      return data as Tour | null;
    },
    enabled: !!tourId,
  });

  const filtered = useMemo(() => {
    if (view === "tour") {
      if (!tourId) return [];
      return shows.filter((s) => s.tour_id === tourId);
    }
    if (view === "standalone") {
      return shows.filter((s) => !s.tour_id);
    }
    return shows;
  }, [shows, view, tourId]);

  const upcoming = filtered.filter(
    (s) => !isPast(parseISO(s.date)) || isToday(parseISO(s.date))
  );
  const past = filtered
    .filter((s) => isPast(parseISO(s.date)) && !isToday(parseISO(s.date)))
    .slice()
    .reverse();

  const displayed = tab === "upcoming" ? upcoming : past;

  const isTourScoped = view === "tour" && !!tourId && !!tour;
  const isTourPickerEmpty = view === "tour" && !tourId;

  const selectedTourName = tour?.name ?? null;

  const chipFor = (show: ShowWithTour): "tour" | "standalone" | "none" => {
    if (view === "tour" || view === "standalone") return "none";
    if (show.tour_id && show.tours?.name) return "tour";
    return "standalone";
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      {isTourScoped && tour ? (
        <TourScopedHeader
          tour={tour}
          tourShows={filtered}
          onTourDeleted={() => {
            const params = new URLSearchParams();
            setSearchParams(params, { replace: true });
          }}
        />
      ) : (
        <div className="flex items-start sm:items-center justify-between mb-6 sm:mb-8 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl tracking-tight">Shows</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {upcoming.length} upcoming · {past.length} past
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-2">
              <BulkUploadDialog />
              <PasteAdvanceDialog />
            </div>
            <CreateShowDialog />
          </div>
        </div>
      )}

      {/* View toggle + upcoming/past tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
            View
          </span>
          <ViewPill label="All" active={view === "all"} onClick={() => setView("all")} />
          <TourPicker
            selectedTourId={view === "tour" ? tourId : null}
            selectedTourName={view === "tour" ? selectedTourName : null}
            onSelect={(id) => setTourId(id)}
            onClear={clearTour}
            onOpen={() => {
              if (view !== "tour") setView("tour");
            }}
          />
          <ViewPill
            label="Standalone"
            active={view === "standalone"}
            onClick={() => setView("standalone")}
          />
        </div>

        <div className="flex items-center gap-1 rounded-md border p-0.5 bg-card">
          {(["upcoming", "past"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-[5px] capitalize transition-colors",
                tab === t
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Tour financials panel */}
      {isTourScoped && filtered.length > 0 && (
        <div className="mb-5">
          <TourRevenueSimulator shows={filtered} />
        </div>
      )}

      {/* Tour picker empty state */}
      {isTourPickerEmpty && (
        <EmptyState
          icon={Calendar}
          title="Pick a tour"
          description="Select a tour to see its shows and financials, or create a new one."
        />
      )}

      {/* List */}
      {!isTourPickerEmpty && (
        <>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : displayed.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title={
                tab === "upcoming"
                  ? isTourScoped
                    ? "No upcoming shows in this tour"
                    : view === "standalone"
                      ? "No upcoming standalone shows"
                      : "No upcoming shows"
                  : isTourScoped
                    ? "No past shows in this tour"
                    : view === "standalone"
                      ? "No past standalone shows"
                      : "No past shows"
              }
              description={
                tab === "upcoming"
                  ? isTourScoped
                    ? "Add a show to this tour to get started."
                    : "Add a show manually or paste an advance email to get started."
                  : "Past shows will appear here after their date passes."
              }
              action={
                tab === "upcoming"
                  ? isTourScoped
                    ? <CreateShowDialog defaultTourId={tourId!} />
                    : <CreateShowDialog />
                  : undefined
              }
            />
          ) : (
            <div className="space-y-2 stagger-list">
              {displayed.map((show) => (
                <ShowCard
                  key={show.id}
                  show={show}
                  hasLoadIn={!!scheduleMap[show.id]?.hasLoadIn}
                  hasDosContact={!!show.dos_contact_name}
                  chip={chipFor(show)}
                  onDelete={() => setPendingDeleteId(show.id)}
                  onRemoveFromTour={
                    isTourScoped ? () => setPendingRemoveFromTourId(show.id) : undefined
                  }
                />
              ))}
            </div>
          )}
        </>
      )}

      <AlertDialog open={!!pendingDeleteId} onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this show?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the show and all associated schedule entries. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingDeleteId) deleteMutation.mutate(pendingDeleteId);
                setPendingDeleteId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!pendingRemoveFromTourId}
        onOpenChange={(open) => { if (!open) setPendingRemoveFromTourId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove show from tour?</AlertDialogTitle>
            <AlertDialogDescription>
              The show will become standalone but won't be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingRemoveFromTourId) removeFromTourMutation.mutate(pendingRemoveFromTourId);
                setPendingRemoveFromTourId(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ViewPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center h-9 px-3 rounded-md border text-sm font-medium transition-colors",
        active
          ? "bg-foreground text-background border-foreground"
          : "bg-background text-foreground border-input hover:bg-accent",
      )}
    >
      {label}
    </button>
  );
}
