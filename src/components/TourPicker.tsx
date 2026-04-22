import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isPast, isToday, parseISO } from "date-fns";
import { ChevronDown, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/components/TeamProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface TourPickerProps {
  selectedTourId: string | null;
  selectedTourName?: string | null;
  onSelect: (tourId: string | null) => void;
  onClear: () => void;
  onOpen?: () => void;
  disabled?: boolean;
  emptyLabel?: string;
  showClear?: boolean;
  fixedLabel?: string;
}

interface TourWithShows {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  shows: { id: string; date: string }[];
}

/**
 * Prefer the tour's explicit start_date / end_date when set, falling back
 * to the min/max of its shows. This lets tours define a date range before
 * any shows exist (or override the computed range).
 */
function formatDateRange(
  tour: { start_date: string | null; end_date: string | null },
  shows: { date: string }[]
): string | null {
  let first = tour.start_date;
  let last = tour.end_date;
  if ((!first || !last) && shows.length > 0) {
    const sorted = [...shows].sort((a, b) => a.date.localeCompare(b.date));
    first = first ?? sorted[0].date;
    last = last ?? sorted[sorted.length - 1].date;
  }
  if (!first && !last) return null;
  if (first && last && first === last) return format(parseISO(first), "MMM d, yyyy");
  if (first && last) return `${format(parseISO(first), "MMM d")} – ${format(parseISO(last), "MMM d, yyyy")}`;
  return format(parseISO((first ?? last)!), "MMM d, yyyy");
}

function hasUpcomingShow(shows: { date: string }[]): boolean {
  return shows.some((s) => {
    const d = parseISO(s.date);
    return isToday(d) || !isPast(d);
  });
}

function earliestUpcoming(shows: { date: string }[]): number {
  const upcoming = shows
    .filter((s) => {
      const d = parseISO(s.date);
      return isToday(d) || !isPast(d);
    })
    .map((s) => parseISO(s.date).getTime());
  return upcoming.length > 0 ? Math.min(...upcoming) : Infinity;
}

function latestEnd(shows: { date: string }[]): number {
  if (shows.length === 0) return 0;
  return Math.max(...shows.map((s) => parseISO(s.date).getTime()));
}

export default function TourPicker({
  selectedTourId,
  selectedTourName,
  onSelect,
  onClear,
  onOpen,
  disabled = false,
  emptyLabel = "No tours",
  showClear = true,
  fixedLabel,
}: TourPickerProps) {
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const { teamId } = useTeam();
  const queryClient = useQueryClient();

  const { data: tours = [] } = useQuery<TourWithShows[]>({
    queryKey: ["tours", "summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tours")
        .select("id, name, start_date, end_date, shows(id, date)")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data as TourWithShows[];
    },
  });

  const { active, upcoming, past } = useMemo(() => {
    const active: TourWithShows[] = [];
    const upcoming: TourWithShows[] = [];
    const past: TourWithShows[] = [];
    for (const t of tours) {
      const shows = t.shows ?? [];
      const hasUp = hasUpcomingShow(shows);
      const hasPast = shows.some((s) => {
        const d = parseISO(s.date);
        return isPast(d) && !isToday(d);
      });
      if (hasUp && hasPast) active.push(t);
      else if (hasUp) upcoming.push(t);
      else if (hasPast) past.push(t);
      else upcoming.push(t);
    }
    active.sort((a, b) => earliestUpcoming(a.shows ?? []) - earliestUpcoming(b.shows ?? []));
    upcoming.sort((a, b) => earliestUpcoming(a.shows ?? []) - earliestUpcoming(b.shows ?? []));
    past.sort((a, b) => latestEnd(b.shows ?? []) - latestEnd(a.shows ?? []));
    return { active, upcoming, past };
  }, [tours]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Name required");
      const { data, error } = await supabase
        .from("tours")
        .insert({ name: name.trim(), team_id: teamId })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (newId) => {
      queryClient.invalidateQueries({ queryKey: ["tours"] });
      setName("");
      setCreateOpen(false);
      setOpen(false);
      onSelect(newId);
      toast.success("Tour created");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to create tour"),
  });

  const triggerLabel = fixedLabel ?? selectedTourName ?? "Tour";

  if (disabled) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-input bg-background text-sm font-medium text-muted-foreground opacity-60 cursor-not-allowed"
      >
        <span className="truncate max-w-[180px]">{emptyLabel}</span>
        <ChevronDown className="h-3.5 w-3.5 opacity-50" />
      </button>
    );
  }

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) onOpen?.();
        }}
      >
        <div
          className={cn(
            "inline-flex items-center rounded-md border text-sm font-medium h-9 overflow-hidden transition-colors",
            selectedTourId
              ? "bg-foreground text-background border-foreground"
              : "bg-background text-foreground border-input hover:bg-accent",
          )}
        >
          <PopoverTrigger asChild>
            <button className="flex items-center gap-1.5 px-3 h-full">
              <span className="truncate max-w-[280px]">{triggerLabel}</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-70" />
            </button>
          </PopoverTrigger>
          {selectedTourId && showClear && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="h-full px-2 border-l border-background/20 hover:bg-background/10 transition-colors"
              aria-label="Clear tour filter"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <PopoverContent align="start" className="w-80 p-0">
          <div className="max-h-[360px] overflow-y-auto p-2">
            {active.length > 0 && (
              <div className="mb-1">
                <div className="px-2 pt-1 pb-1.5 text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
                  Active
                </div>
                {active.map((t) => (
                  <TourRow
                    key={t.id}
                    tour={t}
                    selected={t.id === selectedTourId}
                    onClick={() => {
                      onSelect(t.id);
                      setOpen(false);
                    }}
                  />
                ))}
              </div>
            )}
            {upcoming.length > 0 && (
              <div className="mb-1">
                <div className="px-2 pt-2 pb-1.5 text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
                  Upcoming
                </div>
                {upcoming.map((t) => (
                  <TourRow
                    key={t.id}
                    tour={t}
                    selected={t.id === selectedTourId}
                    onClick={() => {
                      onSelect(t.id);
                      setOpen(false);
                    }}
                  />
                ))}
              </div>
            )}
            {past.length > 0 && (
              <div className="mb-1">
                <div className="px-2 pt-2 pb-1.5 text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
                  Past
                </div>
                {past.map((t) => (
                  <TourRow
                    key={t.id}
                    tour={t}
                    selected={t.id === selectedTourId}
                    onClick={() => {
                      onSelect(t.id);
                      setOpen(false);
                    }}
                  />
                ))}
              </div>
            )}
            {tours.length === 0 && (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                No tours yet.
              </div>
            )}
          </div>
          <div className="border-t p-1">
            <button
              onClick={() => {
                setOpen(false);
                setCreateOpen(true);
              }}
              className="flex items-center gap-1.5 w-full px-2.5 py-2 rounded-md text-sm text-primary hover:bg-accent transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              New tour
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New tour</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Fall 2026 East Coast Run"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && name.trim() && !createMutation.isPending) {
                    createMutation.mutate();
                  }
                }}
                className="h-11 sm:h-9"
              />
            </div>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!name.trim() || createMutation.isPending}
              className="w-full h-11 sm:h-9"
            >
              {createMutation.isPending ? "Creating…" : "Create tour"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TourRow({
  tour,
  selected,
  onClick,
}: {
  tour: TourWithShows;
  selected: boolean;
  onClick: () => void;
}) {
  const shows = tour.shows ?? [];
  const dateRange = formatDateRange(tour, shows);
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-2.5 py-2 rounded-md hover:bg-accent transition-colors",
        selected && "bg-accent",
      )}
    >
      <div className="text-sm font-medium text-foreground truncate">{tour.name}</div>
      <div className="text-xs text-muted-foreground mt-0.5">
        {dateRange ? (
          <>
            {dateRange} · {shows.length} show{shows.length !== 1 ? "s" : ""}
          </>
        ) : (
          <>
            {shows.length} show{shows.length !== 1 ? "s" : ""}
          </>
        )}
      </div>
    </button>
  );
}
