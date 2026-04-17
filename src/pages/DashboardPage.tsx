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
    <div className="mb-3 border-b border-border/60 pb-2">
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

  const nextTour = useMemo(() => {
    if (!nextShow || !nextShow.tour_id) return null;
    return tours.find((t) => t.id === nextShow.tour_id) ?? null;
  }, [tours, nextShow]);

  const tourStats = useMemo(() => {
    if (!nextTour || !nextTour.shows) {
      return { totalShows: 0, settledCount: 0, actualIncome: 0, guaranteedRemaining: 0 };
    }

    const tourShows = nextTour.shows;
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
  }, [nextTour]);

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
      value: tourStats.totalShows,
      icon: Calendar,
      iconStyle: { backgroundColor: "var(--pastel-blue-bg)", color: "var(--pastel-blue-fg)" },
    },
    {
      label: "Shows Settled",
      value: `${tourStats.settledCount}/${tourStats.totalShows}`,
      icon: CheckCircle2,
      iconStyle: { backgroundColor: "var(--pastel-green-bg)", color: "var(--pastel-green-fg)" },
    },
    {
      label: "Actual Income",
      value: tourStats.actualIncome ? `$${tourStats.actualIncome.toLocaleString()}` : "—",
      icon: DollarSign,
      iconStyle: { backgroundColor: "var(--pastel-green-bg)", color: "var(--pastel-green-fg)" },
    },
    {
      label: "Guaranteed Remaining",
      value: tourStats.guaranteedRemaining ? `$${tourStats.guaranteedRemaining.toLocaleString()}` : "—",
      icon: TrendingUp,
      iconStyle: { backgroundColor: "var(--pastel-yellow-bg)", color: "var(--pastel-yellow-fg)" },
    },
  ];

  return (
    <div className="animate-fade-in space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-0.5">{greeting}</p>
          <h1 className="text-2xl sm:text-3xl tracking-tight">Dashboard</h1>
          {nextTour && (
            <Link
              to={`/shows?view=tour&tourId=${nextTour.id}`}
              className="text-sm text-muted-foreground hover:text-foreground [transition:color_150ms_var(--ease-out)] mt-0.5 inline-block"
            >
              {nextTour.name}
            </Link>
          )}
        </div>
        <CreateShowDialog />
      </div>

      {/* Active Tour Stats */}
      {nextTour && (
        <div>
          <SectionLabel>Active Tour</SectionLabel>
          <div className="stagger-list grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            {statCards.map((card, i) => (
              <StatCard
                key={card.label}
                label={card.label}
                value={card.value}
                icon={card.icon}
                iconStyle={card.iconStyle}
                index={i}
              />
            ))}
          </div>
        </div>
      )}

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

                const dotStyle: React.CSSProperties =
                  advancedCount === 2
                    ? { backgroundColor: "var(--pastel-green-fg)" }
                    : isWithin7
                      ? { backgroundColor: "var(--pastel-red-fg)" }
                      : { backgroundColor: "var(--pastel-yellow-fg)" };

                const dateChipStyle: React.CSSProperties | undefined =
                  isWithin7 && advancedCount < 2
                    ? { backgroundColor: "var(--pastel-red-bg)", color: "var(--pastel-red-fg)" }
                    : undefined;

                return (
                  <Link
                    key={show.id}
                    to={`/shows/${show.id}`}
                    className="stagger-item flex items-center gap-3 rounded-md px-2 py-2 hover:bg-accent group card-pressable [transition:background-color_150ms_var(--ease-out),transform_160ms_var(--ease-out)]"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <span
                      className={cn(
                        "text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 w-14 text-center",
                        !dateChipStyle && "bg-muted text-muted-foreground",
                      )}
                      style={dateChipStyle}
                    >
                      {format(parseISO(show.date), "MMM d")}
                    </span>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-sm font-medium text-foreground truncate">{show.venue_name}</span>
                      <span className="text-xs text-muted-foreground truncate">{formatCityState(show.city)}</span>
                    </div>
                    <span className="h-2 w-2 rounded-full shrink-0" style={dotStyle} />
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0 [transition:opacity_150ms_var(--ease-out)]" />
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
                <Link key={tour.id} to={`/shows?view=tour&tourId=${tour.id}`} className="w-full block card-pressable">
                  <div className="rounded-lg border bg-card text-card-foreground w-full hover:border-foreground/20 [transition:border-color_160ms_var(--ease-out),box-shadow_200ms_var(--ease-out)]">
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
  iconStyle,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  iconStyle: React.CSSProperties;
  index: number;
}) {
  return (
    <Card className="overflow-hidden shadow-none">
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center gap-2 mb-2">
          <div
            className="h-6 w-6 rounded-md flex items-center justify-center shrink-0"
            style={iconStyle}
          >
            <Icon className="h-3.5 w-3.5" />
          </div>
          <span className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium leading-tight">{label}</span>
        </div>
        <p className="text-3xl font-display text-foreground leading-none tracking-[-0.03em]">{value}</p>
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
      <Card className="overflow-hidden hover:border-foreground/20 [transition:border-color_160ms_var(--ease-out),box-shadow_200ms_var(--ease-out)]">
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-start gap-4 sm:gap-5">
            {/* Calendar stub */}
            <div className="shrink-0 flex flex-col items-center justify-center rounded-xl border border-border bg-muted/50 w-14 h-[4.5rem] select-none">
              <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold leading-none mb-0.5">
                {format(date, "MMM")}
              </span>
              <span className="text-3xl font-display text-foreground leading-none tracking-[-0.03em]">{format(date, "d")}</span>
              <span className="text-[9px] text-muted-foreground mt-0.5">{format(date, "EEE")}</span>
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <h2 className="text-xl sm:text-2xl font-display text-foreground truncate tracking-[-0.02em]">{show.venue_name}</h2>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{formatCityState(show.city)}</span>
              </div>
              <span
                className={cn(
                  "inline-block mt-2 text-[10px] uppercase tracking-widest font-medium px-2 py-0.5 rounded-full",
                  !isUrgent && "bg-secondary text-muted-foreground",
                )}
                style={
                  isUrgent
                    ? { backgroundColor: "var(--pastel-yellow-bg)", color: "var(--pastel-yellow-fg)" }
                    : undefined
                }
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
