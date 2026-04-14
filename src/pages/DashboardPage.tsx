import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  format,
  parseISO,
  isPast,
  isToday,
  differenceInCalendarDays,
} from "date-fns";
import { Calendar, MapPin, ChevronRight, TrendingUp, DollarSign, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn, formatCityState } from "@/lib/utils";
import CreateShowDialog from "@/components/CreateShowDialog";
import { parseDollar } from "@/components/RevenueSimulator";
import type { Show, Tour } from "@/lib/types";

const TOTAL_ADVANCE = 2; // venue_address + schedule

function countAdvanced(show: Show, hasSchedule: boolean): number {
  let count = 0;
  if (show.venue_address) count++;
  if (hasSchedule) count++;
  return count;
}

export default function DashboardPage() {
  const { data: shows = [], isLoading: showsLoading } = useQuery({
    queryKey: ["shows"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shows").select("*").order("date", { ascending: true });
      if (error) throw error;
      return data as Show[];
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

  const { data: tours = [] } = useQuery({
    queryKey: ["tours"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tours")
        .select("*, shows(*)")
        .order("start_date", { ascending: true });
      if (error) throw error;
      return data as (Tour & { shows: Show[] })[];
    },
  });

  const today = new Date();

  const upcoming = useMemo(() => shows.filter((s) => !isPast(parseISO(s.date)) || isToday(parseISO(s.date))), [shows]);

  const nextShow = upcoming[0] ?? null;
  const upcomingAfter = upcoming.slice(1, 8);

  // The "active" tour is the one whose soonest upcoming show comes first.
  const activeTour = useMemo(() => {
    let best: (Tour & { shows: Show[] }) | null = null;
    let bestDate: Date | null = null;
    for (const t of tours) {
      if (!t.shows || t.shows.length === 0) continue;
      const upcomingForTour = t.shows
        .filter((s) => {
          const d = parseISO(s.date);
          return isToday(d) || !isPast(d);
        })
        .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
      if (upcomingForTour.length === 0) continue;
      const earliest = parseISO(upcomingForTour[0].date);
      if (!bestDate || earliest < bestDate) {
        bestDate = earliest;
        best = t;
      }
    }
    return best;
  }, [tours]);

  // Tour-scoped stats for the active tour.
  const tourStats = useMemo(() => {
    if (!activeTour || !activeTour.shows) {
      return { totalShows: 0, settledCount: 0, actualIncome: 0, guaranteedRemaining: 0 };
    }

    const tourShows = activeTour.shows;
    const totalShows = tourShows.length;
    let settledCount = 0;
    let actualIncome = 0;
    let guaranteedRemaining = 0;

    tourShows.forEach((s) => {
      const settled = (s as any).is_settled as boolean;
      if (settled) {
        settledCount += 1;
        const val = parseDollar((s as any).actual_walkout ?? null);
        if (val != null) actualIncome += val;
      } else {
        const d = parseISO(s.date);
        if (isToday(d) || !isPast(d)) {
          const val = parseDollar((s as any).guarantee ?? null);
          if (val != null) guaranteedRemaining += val;
        }
      }
    });

    return { totalShows, settledCount, actualIncome, guaranteedRemaining };
  }, [activeTour]);

  const toursWithUpcoming = useMemo(
    () => tours.filter((t) => t.shows?.some((s) => { const d = parseISO(s.date); return isToday(d) || !isPast(d); })),
    [tours],
  );

  if (showsLoading) {
    return (
      <div className="animate-fade-in space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6 sm:space-y-8 overflow-x-hidden">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl tracking-tight">Dashboard</h1>
        </div>
        <CreateShowDialog />
      </div>

      {/* Active Tour Stats */}
      {activeTour ? (() => {
        const totalAdv = activeTour.shows?.length ?? 0;
        const advancedAdv = (activeTour.shows ?? []).filter((s) => countAdvanced(s, !!scheduleMap[s.id]?.hasSchedule) >= TOTAL_ADVANCE).length;
        const advPct = totalAdv > 0 ? (advancedAdv / totalAdv) * 100 : 0;
        return (
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-base font-medium truncate">
                  <Link to={`/tours/${activeTour.id}`} className="hover:underline">
                    {activeTour.name}
                  </Link>
                </h2>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium shrink-0">
                  Active Tour
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Progress value={advPct} className="h-1.5 w-24" />
                <span className="text-xs text-muted-foreground">
                  {advancedAdv}/{totalAdv} advanced
                </span>
              </div>
            </div>
            {activeTour.start_date && activeTour.end_date && (
              <p className="text-xs text-muted-foreground mb-3">
                {format(parseISO(activeTour.start_date), "MMM d")} –{" "}
                {format(parseISO(activeTour.end_date), "MMM d, yyyy")}
              </p>
            )}
            {!(activeTour.start_date && activeTour.end_date) && <div className="mb-3" />}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
              <StatCard label="Shows This Tour" value={tourStats.totalShows} icon={Calendar} />
              <StatCard
                label="Shows Settled"
                value={`${tourStats.settledCount}/${tourStats.totalShows}`}
                icon={CheckCircle2}
              />
              <StatCard
                label="Actual Income"
                value={tourStats.actualIncome ? `$${tourStats.actualIncome.toLocaleString()}` : "—"}
                icon={DollarSign}
              />
              <StatCard
                label="Guaranteed Remaining"
                value={tourStats.guaranteedRemaining ? `$${tourStats.guaranteedRemaining.toLocaleString()}` : "—"}
                icon={TrendingUp}
              />
            </div>
          </div>
        );
      })() : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          <StatCard label="Shows This Tour" value="—" icon={Calendar} />
          <StatCard label="Shows Settled" value="—" icon={CheckCircle2} />
          <StatCard label="Actual Income" value="—" icon={DollarSign} />
          <StatCard label="Guaranteed Remaining" value="—" icon={TrendingUp} />
        </div>
      )}

      {/* Other Tours Progress (excluding active tour) */}
      {(() => {
        const otherTours = toursWithUpcoming.filter((t) => t.id !== activeTour?.id);
        if (otherTours.length === 0) return null;
        return (
          <div>
            <h2 className="text-base font-medium mb-3">Other Tours</h2>
            <div className={cn("grid w-full gap-3", otherTours.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2")}>
              {otherTours.map((tour) => {
                const total = tour.shows?.length ?? 0;
                const advanced = (tour.shows ?? []).filter((s) => countAdvanced(s, !!scheduleMap[s.id]?.hasSchedule) >= TOTAL_ADVANCE).length;
                const pct = total > 0 ? (advanced / total) * 100 : 0;
                return (
                  <Link key={tour.id} to={`/tours/${tour.id}`} className="w-full block">
                    <div className="rounded-lg border bg-card text-card-foreground shadow-sm w-full hover:border-foreground/20 transition-colors">
                      <div className="pt-5 pb-4 px-6">
                        <p className="text-sm font-medium text-foreground truncate">{tour.name}</p>
                        {tour.start_date && tour.end_date && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {format(parseISO(tour.start_date), "MMM d")} –{" "}
                            {format(parseISO(tour.end_date), "MMM d, yyyy")}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-3">
                          <Progress value={pct} className="h-1.5 flex-1" />
                          <span className="text-xs text-muted-foreground shrink-0">
                            {advanced}/{total}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/* --- Sub-components --- */

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ElementType }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">{label}</span>
        </div>
        <p className="text-xl font-display text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

function NextShowCard({ show, hasSchedule }: { show: Show; hasSchedule: boolean }) {
  const date = parseISO(show.date);
  const daysAway = differenceInCalendarDays(date, new Date());
  const advanced = countAdvanced(show, hasSchedule);
  const pct = (advanced / TOTAL_ADVANCE) * 100;

  const daysLabel =
    daysAway <= 0
      ? "Today"
      : daysAway === 1
        ? "Tomorrow"
        : daysAway < 7
          ? `${daysAway} days away`
          : daysAway < 14
            ? "Next week"
            : `${Math.ceil(daysAway / 7)} weeks away`;

  const isUrgent = daysAway >= 0 && daysAway < 7;

  return (
    <Link to={`/shows/${show.id}`} className="block group">
      <Card className="overflow-hidden hover:border-foreground/20 transition-colors">
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-2 sm:gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-xl sm:text-2xl font-display text-foreground truncate">{show.venue_name}</h2>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{formatCityState(show.city)}</span>
              </div>
              <p className="text-sm text-foreground mt-1">{format(date, "EEEE, MMMM d, yyyy")}</p>
              <span
                className={cn(
                  "inline-block mt-2 text-xs font-medium px-2 py-0.5 rounded-full",
                  isUrgent
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    : "bg-secondary text-muted-foreground",
                )}
              >
                {daysLabel}
              </span>
            </div>

            <div className="text-right shrink-0">
              <p
                className="text-sm font-medium text-foreground"
                title="Tracked fields: Venue Address, Schedule"
              >
                {advanced}/{TOTAL_ADVANCE} advanced
              </p>
              <Progress value={pct} className="h-1.5 w-24 mt-1.5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
