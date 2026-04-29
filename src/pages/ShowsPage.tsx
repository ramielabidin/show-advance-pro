import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { isPast, isToday, parseISO } from "date-fns";
import { Calendar, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ShowCard from "@/components/ShowCard";
import CreateShowDialog from "@/components/CreateShowDialog";
import BulkUploadDialog from "@/components/BulkUploadDialog";
import EmptyState from "@/components/EmptyState";
import PageTitle from "@/components/PageTitle";
import TourPicker from "@/components/TourPicker";
import TourScopedHeader from "@/components/TourScopedHeader";
import TourRevenueSimulator from "@/components/TourRevenueSimulator";
import { Input } from "@/components/ui/input";
import { useTeam } from "@/components/TeamProvider";
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

const PAGE_SIZE = 8;

function parseView(raw: string | null): View {
  if (raw === "tour" || raw === "standalone") return raw;
  return "all";
}

export default function ShowsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = parseView(searchParams.get("view"));
  const tourId = searchParams.get("tourId");
  const searchQuery = searchParams.get("q") ?? "";

  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingRemoveFromTourId, setPendingRemoveFromTourId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { isArtist } = useTeam();

  const location = useLocation();
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const state = location.state as { focusSearch?: boolean } | null;
    if (state?.focusSearch) {
      searchInputRef.current?.focus();
      // Clear the state so a refresh doesn't re-focus.
      navigate(location.pathname + location.search, { replace: true, state: null });
    }
  }, [location, navigate]);

  const setSearchQuery = (next: string) => {
    const params = new URLSearchParams(searchParams);
    if (next) params.set("q", next);
    else params.delete("q");
    setSearchParams(params, { replace: true });
  };

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

  const deleteWithUndo = (id: string) => {
    const snapshot = queryClient
      .getQueryData<ShowWithTour[]>(["shows"])
      ?.find((s) => s.id === id);
    if (!snapshot) return;

    queryClient.setQueryData<ShowWithTour[]>(["shows"], (old) =>
      old ? old.filter((s) => s.id !== id) : [],
    );

    const restore = () => {
      queryClient.setQueryData<ShowWithTour[]>(["shows"], (old) => {
        const base = old ?? [];
        if (base.some((s) => s.id === snapshot.id)) return base;
        return [...base, snapshot].sort((a, b) => a.date.localeCompare(b.date));
      });
    };

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (cancelled) return;
      const { error } = await supabase.from("shows").delete().eq("id", id);
      if (error) {
        toast.error("Couldn't delete: " + error.message);
        restore();
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      queryClient.invalidateQueries({ queryKey: ["tours"] });
    }, 5000);

    toast("Show deleted", {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => {
          cancelled = true;
          window.clearTimeout(timer);
          restore();
        },
      },
    });
  };

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

  const tabbed = tab === "upcoming" ? upcoming : past;

  const trimmedQuery = searchQuery.trim();
  const displayed = useMemo(() => {
    const q = trimmedQuery.toLowerCase();
    if (!q) return tabbed;
    return tabbed.filter(
      (s) =>
        s.venue_name?.toLowerCase().includes(q) ||
        s.city?.toLowerCase().includes(q),
    );
  }, [tabbed, trimmedQuery]);

  const isTourScoped = view === "tour" && !!tourId && !!tour;
  const isTourPickerEmpty = view === "tour" && !tourId;

  const selectedTourName = tour?.name ?? null;

  const chipFor = (show: ShowWithTour): "tour" | "standalone" | "none" => {
    if (view === "tour" || view === "standalone") return "none";
    if (show.tour_id && show.tours?.name) return "tour";
    return "standalone";
  };

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const visibleDisplayed = useMemo(
    () => displayed.slice(0, visibleCount),
    [displayed, visibleCount],
  );
  const hasMore = visibleCount < displayed.length;

  // Reset the visible window when the filter set changes so the user starts
  // at the top of the new result set rather than scrolled into nothing.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [tab, view, tourId, trimmedQuery]);

  useEffect(() => {
    if (!hasMore) return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((c) => Math.min(c + PAGE_SIZE, displayed.length));
        }
      },
      { rootMargin: "0px", threshold: 0.6 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, displayed.length]);

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
          <PageTitle subline={`${upcoming.length} upcoming · ${past.length} past`}>
            All shows
          </PageTitle>
          {!isArtist && (
            <div className="flex items-center gap-2 shrink-0">
              <BulkUploadDialog triggerClassName="h-9" iconOnlyMobile />
              <CreateShowDialog triggerClassName="h-9" iconOnlyMobile />
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div className="mb-4 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={searchInputRef}
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search venue or city"
            aria-label="Search shows"
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent [transition:color_150ms_var(--ease-out),background-color_150ms_var(--ease-out)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Upcoming/past tabs + view pills */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
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

        <div className="flex-1" />

        <div className="flex items-center gap-2 flex-wrap">
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
      </div>

      {/* Tour financials panel — admin only */}
      {!isArtist && isTourScoped && tour && filtered.length > 0 && (
        <div className="mb-5">
          <TourRevenueSimulator tourId={tour.id} shows={filtered} />
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
            trimmedQuery ? (
              <EmptyState
                icon={Search}
                title="No matching shows"
                description={`Nothing matched “${trimmedQuery}”. Try another venue or city.`}
              />
            ) : (
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
                  ? isArtist
                    ? "Shows will appear here once your team adds them."
                    : isTourScoped
                      ? "Add a show to this tour to get started."
                      : "Add a show manually or paste an advance email to get started."
                  : "Past shows will appear here after their date passes."
              }
              action={
                tab === "upcoming" && !isArtist
                  ? isTourScoped
                    ? <CreateShowDialog defaultTourId={tourId!} />
                    : <CreateShowDialog />
                  : undefined
              }
            />
            )
          ) : (
            <div className="space-y-2">
              {visibleDisplayed.map((show, i) => (
                <div
                  key={show.id}
                  className="stagger-item"
                  style={{ animationDelay: `${(i % PAGE_SIZE) * 40}ms` }}
                >
                  <ShowCard
                    show={show}
                    chip={chipFor(show)}
                    onDelete={() => setPendingDeleteId(show.id)}
                    onRemoveFromTour={
                      isTourScoped ? () => setPendingRemoveFromTourId(show.id) : undefined
                    }
                  />
                </div>
              ))}
              {hasMore && <div ref={sentinelRef} aria-hidden className="h-12" />}
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
                if (pendingDeleteId) deleteWithUndo(pendingDeleteId);
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
