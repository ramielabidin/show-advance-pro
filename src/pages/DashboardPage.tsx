import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  format,
  parseISO,
  isPast,
  isToday,
  differenceInDays,
  addDays,
  startOfYear,
  endOfYear,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import {
  Calendar,
  MapPin,
  ChevronRight,
  Send,
  Pencil,
  FileText,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { Show, Tour } from "@/lib/types";

const ADVANCE_FIELDS: (keyof Show)[] = [
  "dos_contact_name",
  "departure_time",
  "load_in_details",
  "parking_notes",
  "wifi_network",
  "hotel_name",
];

function countAdvanced(show: Show, hasSchedule: boolean): number {
  let count = hasSchedule ? 1 : 0;
  ADVANCE_FIELDS.forEach((f) => {
    if (show[f]) count++;
  });
  return count;
}

const TOTAL_ADVANCE = ADVANCE_FIELDS.length + 1; // +1 for schedule

export default function DashboardPage() {
  const { data: shows = [], isLoading: showsLoading } = useQuery({
    queryKey: ["shows"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shows")
        .select("*")
        .order("date", { ascending: true });
      if (error) throw error;
      return data as Show[];
    },
  });

  const { data: scheduleMap = {} } = useQuery({
    queryKey: ["schedule-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_entries")
        .select("show_id");
      if (error) throw error;
      const map: Record<string, boolean> = {};
      data.forEach((e) => (map[e.show_id] = true));
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

  const upcoming = useMemo(
    () => shows.filter((s) => !isPast(parseISO(s.date)) || isToday(parseISO(s.date))),
    [shows]
  );

  const nextShow = upcoming[0] ?? null;
  const upcomingAfter = upcoming.slice(1, 8);

  const needsAttention = useMemo(() => {
    const cutoff = addDays(today, 30);
    return upcoming
      .filter((s) => {
        const d = parseISO(s.date);
        return d <= cutoff && !scheduleMap[s.id] && !s.dos_contact_name;
      })
      .slice(0, 5);
  }, [upcoming, scheduleMap]);

  const activeTours = useMemo(
    () =>
      tours.filter((t) => {
        if (!t.shows || t.shows.length === 0) return false;
        const hasUpcoming = t.shows.some(
          (s) => !isPast(parseISO(s.date)) || isToday(parseISO(s.date))
        );
        return hasUpcoming;
      }),
    [tours]
  );

  // Quick stats
  const stats = useMemo(() => {
    const yearStart = startOfYear(today);
    const yearEnd = endOfYear(today);
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);
    const next30 = addDays(today, 30);

    const thisYear = shows.filter((s) => {
      const d = parseISO(s.date);
      return d >= yearStart && d <= yearEnd;
    });

    const thisMonth = shows.filter((s) => {
      const d = parseISO(s.date);
      return d >= monthStart && d <= monthEnd;
    });

    let totalGuarantee = 0;
    upcoming.forEach((s) => {
      const val = parseFloat(s.guarantee?.replace(/[^0-9.-]/g, "") || "");
      if (!isNaN(val)) totalGuarantee += val;
    });

    let walkoutUpcoming = 0;
    upcoming.forEach((s) => {
      const val = parseFloat(s.walkout_potential?.replace(/[^0-9.-]/g, "") || "");
      if (!isNaN(val)) walkoutUpcoming += val;
    });

    return {
      totalThisYear: thisYear.length,
      totalGuarantee,
      walkoutUpcoming,
      showsThisMonth: thisMonth.length,
    };
  }, [shows]);

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
    <div className="animate-fade-in space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Your morning briefing</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Shows This Year" value={stats.totalThisYear} icon={Calendar} />
        <StatCard
          label="Guaranteed Upcoming"
          value={stats.totalGuarantee ? `$${stats.totalGuarantee.toLocaleString()}` : "—"}
          icon={DollarSign}
        />
        <StatCard
          label="Walkout Potential (Upcoming)"
          value={stats.walkoutUpcoming ? `$${stats.walkoutUpcoming.toLocaleString()}` : "—"}
          icon={TrendingUp}
        />
        <StatCard label="Shows This Month" value={stats.showsThisMonth} icon={BarChart3} />
      </div>

      {/* Next Show */}
      {nextShow && (
        <NextShowCard show={nextShow} hasSchedule={!!scheduleMap[nextShow.id]} />
      )}

      {!nextShow && (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No upcoming shows</p>
          </CardContent>
        </Card>
      )}

      {/* Two-column: Upcoming + Needs Attention */}
      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Upcoming Shows */}
        {upcomingAfter.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Upcoming Shows</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {upcomingAfter.map((show) => (
                <Link
                  key={show.id}
                  to={`/shows/${show.id}`}
                  className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-accent group"
                >
                  <span className="text-xs text-muted-foreground w-16 shrink-0 font-medium">
                    {format(parseISO(show.date), "MMM d")}
                  </span>
                  <span className="text-sm font-medium text-foreground truncate flex-1">
                    {show.venue_name}
                  </span>
                  <span className="text-xs text-muted-foreground truncate max-w-[80px]">
                    {show.city}
                  </span>
                  {!scheduleMap[show.id] && (
                    <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
                  )}
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </Link>
              ))}
              <Link
                to="/shows"
                className="block text-xs text-muted-foreground hover:text-foreground pt-2 text-center transition-colors"
              >
                View all shows →
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Needs Attention */}
        {needsAttention.length > 0 && (
          <Card className="border-amber-200 dark:border-amber-900/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Not Yet Advanced
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {needsAttention.map((show) => {
                const daysAway = differenceInDays(parseISO(show.date), today);
                return (
                  <Link
                    key={show.id}
                    to={`/shows/${show.id}`}
                    className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-accent group"
                  >
                    <span className="text-xs text-muted-foreground w-16 shrink-0 font-medium">
                      {format(parseISO(show.date), "MMM d")}
                    </span>
                    <span className="text-sm font-medium text-foreground truncate flex-1">
                      {show.venue_name}
                    </span>
                    <span className="text-xs text-amber-600 dark:text-amber-400 shrink-0">
                      {daysAway <= 0 ? "Today" : `${daysAway}d`}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tour Progress */}
      {activeTours.length > 0 && (
        <div>
          <h2 className="text-base font-medium mb-3">Tour Progress</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeTours.map((tour) => {
              const total = tour.shows?.length ?? 0;
              const advanced = (tour.shows ?? []).filter(
                (s) => countAdvanced(s, !!scheduleMap[s.id]) >= 4
              ).length;
              const pct = total > 0 ? (advanced / total) * 100 : 0;
              return (
                <Link key={tour.id} to={`/tours/${tour.id}`}>
                  <Card className="hover:border-foreground/20 transition-colors">
                    <CardContent className="pt-5 pb-4">
                      <p className="text-sm font-medium text-foreground truncate">
                        {tour.name}
                      </p>
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
                    </CardContent>
                  </Card>
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
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">
            {label}
          </span>
        </div>
        <p className="text-xl font-display text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

function NextShowCard({ show, hasSchedule }: { show: Show; hasSchedule: boolean }) {
  const date = parseISO(show.date);
  const daysAway = differenceInDays(date, new Date());
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
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
                Next Show
              </p>
              <h2 className="text-xl sm:text-2xl font-display text-foreground truncate">
                {show.venue_name}
              </h2>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{show.city}</span>
              </div>
              <p className="text-sm text-foreground mt-1">
                {format(date, "EEEE, MMMM d, yyyy")}
              </p>
              <span
                className={cn(
                  "inline-block mt-2 text-xs font-medium px-2 py-0.5 rounded-full",
                  isUrgent
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    : "bg-secondary text-muted-foreground"
                )}
              >
                {daysLabel}
              </span>
            </div>

            <div className="text-right shrink-0">
              <p className="text-sm font-medium text-foreground">
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
