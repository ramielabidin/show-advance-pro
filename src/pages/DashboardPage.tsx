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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-0.5 h-3.5 rounded-full bg-foreground/25" />
      <span className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">{children}</span>
    </div>
  );
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
  const hour = today.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const upcoming = useMemo(() => shows.filter((s) => !isPast(parseISO(s.date)) || isToday(parseISO(s.date))), [shows]);

  const nextShow = upcoming[0] ?? null;
  const upcomingAfter = upcoming.slice(1, 8);

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

  const statCards = [
    {
      label: "Shows This Tour",
      value: activeTour ? tourStats.totalShows : "—",
      icon: Calendar,
      iconClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      borderClass: "border-l-blue-500/50",
    },
    {
      label: "Shows Settled",
      value: activeTour ? `${tourStats.settledCount}/${tourStats.totalShows}` : "—",
      icon: CheckCircle2,
      iconClass: "bg-green-500/10 text-green-600 dark:text-green-400",
      borderClass: "border-l-green-500/50",
    },
    {
      label: "Actual Income",
      value: activeTour && tourStats.actualIncome ? `$${tourStats.actualIncome.toLocaleString()}` : "—",
      icon: DollarSign,
      iconClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      borderClass: "border-l-emerald-500/50",
    },
    {
      label: "Guaranteed Remaining",
      value: activeTour && tourStats.guaranteedRemaining ? `$${tourStats.guaranteedRemaining.toLocaleString()}` : "—",
      icon: TrendingUp,
      iconClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      borderClass: "border-l-amber-500/50",
    },
  ];

  return (
    <div className="animate-fade-in space-y-6 sm:space-y-8 overflow-x-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-0.5">{greeting}</p>
          <h1 className="text-2xl sm:text-3xl tracking-tight">Dashboard</h1>
          {activeTour && (
            <Link
              to={`/tours/${activeTour.id}`}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors mt-0.5 inline-block"
            >
              {activeTour.name}
            </Link>
          )}
        </div>
        <CreateShowDialog />
      </div>

      {/* Active Tour Stats */}
      <div>
        <SectionLabel>{activeTour ? "Active Tour" : "Tour Stats"}</SectionLabel>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          {statCards.map((card, i) => (
            <StatCard
              key={card.label}
              label={card.label}
              value={card.value}
              icon={card.icon}
              iconClass={card.iconClass}
              borderClass={card.borderClass}
              index={i}
            />
          ))}
        </div>
      </div>

      {/* Next Show */}
      {nextShow ? (
        <div>
          <SectionLabel>Next Show</SectionLabel>
          <NextShowCard show={nextShow} hasSchedule={!!scheduleMap[nextShow.id]?.hasSchedule} />
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No upcoming shows</p>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Shows */}
      {upcomingAfter.length > 0 && (
        <div>
          <SectionLabel>Upcoming Shows</SectionLabel>
          <Card>
            <CardContent className="pt-4 space-y-1">
              {upcomingAfter.map((show, i) => {
                const daysAway = differenceInCalendarDays(parseISO(show.date), today);
                const info = scheduleMap[show.id];
                const hasLoadIn = !!info?.hasLoadIn;
                const hasDosContact = !!show.dos_contact_name;
                const advancedCount = (hasLoadIn ? 1 : 0) + (hasDosContact ? 1 : 0);
                const isWithin7 = daysAway >= 0 && daysAway < 7;

                const dotColor =
                  advancedCount === 2
                    ? "bg-green-500"
                    : isWithin7
                      ? "bg-red-500"
                      : "bg-amber-400";

                return (
                  <Link
                    key={show.id}
                    to={`/shows/${show.id}`}
                    className="stagger-item flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-accent group"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <span
                      className={cn(
                        "text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 w-14 text-center",
                        isWithin7 && advancedCount < 2
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {format(parseISO(show.date), "MMM d")}
                    </span>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-sm font-medium text-foreground truncate">{show.venue_name}</span>
                      <span className="text-xs text-muted-foreground truncate">{formatCityState(show.city)}</span>
                    </div>
                    <span className={cn("h-2 w-2 rounded-full shrink-0", dotColor)} />
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </Link>
                );
              })}
              <Link
                to="/shows"
                className="block text-xs text-muted-foreground hover:text-foreground pt-2 text-center transition-colors"
              >
                View all shows →
              </Link>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tour Progress */}
      {toursWithUpcoming.length > 0 && (
        <div>
          <SectionLabel>Tour Progress</SectionLabel>
          <div
            className={cn("grid w-full gap-3", toursWithUpcoming.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2")}
          >
            {toursWithUpcoming.map((tour) => {
              const total = tour.shows?.length ?? 0;
              const advanced = (tour.shows ?? []).filter((s) => countAdvanced(s, !!scheduleMap[s.id]?.hasSchedule) >= TOTAL_ADVANCE).length;
              const pct = total > 0 ? (advanced / total) * 100 : 0;
              return (
                <Link key={tour.id} to={`/tours/${tour.id}`} className="w-full block card-pressable">
                  <div className="rounded-lg border bg-card text-card-foreground shadow-sm w-full hover:border-foreground/20 hover:shadow-md transition-all duration-150">
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
                          {advanced}/{total} · {Math.round(pct)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* --- Sub-components --- */

function StatCard({
  label,
  value,
  icon: Icon,
  iconClass,
  borderClass,
  index,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  iconClass: string;
  borderClass: string;
  index: number;
}) {
  return (
    <Card className={cn("border-l-2 overflow-hidden", borderClass)}>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center gap-2 mb-2">
          <div className={cn("h-6 w-6 rounded-md flex items-center justify-center shrink-0", iconClass)}>
            <Icon className="h-3.5 w-3.5" />
          </div>
          <span className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium leading-tight">{label}</span>
        </div>
        <p className="text-2xl font-display text-foreground">{value}</p>
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
    <Link to={`/shows/${show.id}`} className="block group card-pressable">
      <Card className="overflow-hidden hover:border-foreground/20 hover:shadow-md transition-all duration-150">
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-start gap-4 sm:gap-5">
            {/* Calendar stub */}
            <div className="shrink-0 flex flex-col items-center justify-center rounded-xl border-2 border-border bg-muted/50 w-14 h-[4.5rem] select-none">
              <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold leading-none mb-0.5">
                {format(date, "MMM")}
              </span>
              <span className="text-3xl font-display text-foreground leading-none">{format(date, "d")}</span>
              <span className="text-[9px] text-muted-foreground mt-0.5">{format(date, "EEE")}</span>
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <h2 className="text-xl sm:text-2xl font-display text-foreground truncate">{show.venue_name}</h2>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{formatCityState(show.city)}</span>
              </div>
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

            {/* Advance progress */}
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
