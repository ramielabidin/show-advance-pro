import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import {
  format,
  parseISO,
  isPast,
  isToday,
  differenceInCalendarDays,
  subMonths,
} from "date-fns";
import {
  Calendar,
  MapPin,
  ChevronRight,
  TrendingUp,
  DollarSign,
  CheckCircle2,
  Circle,
  Music,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn, formatCityState } from "@/lib/utils";
import CreateShowDialog from "@/components/CreateShowDialog";
import BulkUploadDialog from "@/components/BulkUploadDialog";
import TourPicker from "@/components/TourPicker";
import { parseDollar } from "@/components/RevenueSimulator";
import type { Show, Tour } from "@/lib/types";

type Scope = "tour" | "standalone" | "upcoming";
type ShowWithTour = Show & { tours?: { id: string; name: string } | null };
type TourWithShows = Tour & { shows: Show[] };

function isUpcomingDate(date: string): boolean {
  const d = parseISO(date);
  return isToday(d) || !isPast(d);
}

function parseScope(raw: string | null): Scope | null {
  if (raw === "tour" || raw === "standalone" || raw === "upcoming") return raw;
  return null;
}

function autoPickedTourId(tours: TourWithShows[]): string | null {
  let best: { id: string; earliest: number } | null = null;
  for (const t of tours) {
    const upcoming = (t.shows ?? [])
      .filter((s) => isUpcomingDate(s.date))
      .map((s) => parseISO(s.date).getTime());
    if (upcoming.length === 0) continue;
    const earliest = Math.min(...upcoming);
    if (!best || earliest < best.earliest) best = { id: t.id, earliest };
  }
  return best?.id ?? null;
}

function fmtMoney(val: number): string {
  return val ? `$${val.toLocaleString()}` : "—";
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 border-b border-border/60 pb-2">
      <span className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">{children}</span>
    </div>
  );
}

export default function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedScope = parseScope(searchParams.get("scope"));
  const requestedTourId = searchParams.get("tourId");

  const { data: shows = [], isLoading: showsLoading } = useQuery<ShowWithTour[]>({
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

  const { data: tours = [] } = useQuery<TourWithShows[]>({
    queryKey: ["tours", "with-shows"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tours")
        .select("*, shows(*)")
        .order("start_date", { ascending: true });
      if (error) throw error;
      return data as TourWithShows[];
    },
  });

  const today = new Date();
  const hour = today.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const autoTourId = useMemo(() => autoPickedTourId(tours), [tours]);

  // Resolve scope + active tour from URL with fallbacks.
  const { scope, activeTourId } = useMemo(() => {
    const validRequestedTourId =
      requestedTourId && tours.some((t) => t.id === requestedTourId) ? requestedTourId : null;

    if (tours.length === 0) {
      return { scope: "upcoming" as Scope, activeTourId: null as string | null };
    }
    if (requestedScope === "standalone" || requestedScope === "upcoming") {
      return { scope: requestedScope, activeTourId: null };
    }
    if (requestedScope === "tour") {
      const id = validRequestedTourId ?? autoTourId;
      if (id) return { scope: "tour" as Scope, activeTourId: id };
      return { scope: "upcoming" as Scope, activeTourId: null };
    }
    // No scope param — default to active tour or upcoming.
    if (autoTourId) return { scope: "tour" as Scope, activeTourId: autoTourId };
    return { scope: "upcoming" as Scope, activeTourId: null };
  }, [requestedScope, requestedTourId, tours, autoTourId]);

  const activeTour = useMemo(
    () => (activeTourId ? tours.find((t) => t.id === activeTourId) ?? null : null),
    [activeTourId, tours],
  );

  const isPastTour =
    !!activeTour &&
    (activeTour.shows ?? []).length > 0 &&
    (activeTour.shows ?? []).every((s) => {
      const d = parseISO(s.date);
      return isPast(d) && !isToday(d);
    });

  const setScopeTour = (id: string | null) => {
    if (!id) return;
    const params = new URLSearchParams();
    params.set("scope", "tour");
    params.set("tourId", id);
    setSearchParams(params, { replace: true });
  };
  const setScopeStandalone = () => {
    const params = new URLSearchParams();
    params.set("scope", "standalone");
    setSearchParams(params, { replace: true });
  };
  const setScopeUpcoming = () => {
    const params = new URLSearchParams();
    params.set("scope", "upcoming");
    setSearchParams(params, { replace: true });
  };
  const clearTourScope = () => {
    if (autoTourId) setScopeTour(autoTourId);
    else setScopeUpcoming();
  };

  // --- Derived datasets per scope ---
  const allUpcoming = useMemo(
    () => shows.filter((s) => isUpcomingDate(s.date)),
    [shows],
  );

  const tourShows = useMemo(
    () => (activeTour ? [...(activeTour.shows ?? [])].sort((a, b) => a.date.localeCompare(b.date)) : []),
    [activeTour],
  );

  const standaloneShows = useMemo(() => shows.filter((s) => !s.tour_id), [shows]);
  const standaloneUpcoming = useMemo(
    () => standaloneShows.filter((s) => isUpcomingDate(s.date)),
    [standaloneShows],
  );

  const toursWithUpcoming = useMemo(
    () =>
      tours.filter((t) =>
        (t.shows ?? []).some((s) => isUpcomingDate(s.date)),
      ),
    [tours],
  );

  // --- Stat cards per scope ---
  const statCards = useMemo(() => {
    const now = new Date();
    if (scope === "tour" && activeTour) {
      const total = tourShows.length;
      const settled = tourShows.filter((s) => s.is_settled);
      const settledCount = settled.length;
      const actualIncome = settled.reduce((acc, s) => {
        const v = parseDollar(s.actual_walkout);
        return acc + (v ?? 0);
      }, 0);

      const baseCards: StatCardData[] = [
        {
          label: "Shows This Tour",
          value: total,
          icon: Calendar,
          iconStyle: { backgroundColor: "var(--pastel-blue-bg)", color: "var(--pastel-blue-fg)" },
        },
        {
          label: "Shows Settled",
          value: `${settledCount}/${total}`,
          icon: CheckCircle2,
          iconStyle: { backgroundColor: "var(--pastel-green-bg)", color: "var(--pastel-green-fg)" },
        },
        {
          label: "Actual Income",
          value: fmtMoney(actualIncome),
          icon: DollarSign,
          iconStyle: { backgroundColor: "var(--pastel-green-bg)", color: "var(--pastel-green-fg)" },
        },
      ];

      if (isPastTour) {
        const totalGuarantee = tourShows.reduce((acc, s) => {
          const v = parseDollar(s.guarantee);
          return acc + (v ?? 0);
        }, 0);
        return [
          ...baseCards,
          {
            label: "Total Guarantee",
            value: fmtMoney(totalGuarantee),
            icon: TrendingUp,
            iconStyle: { backgroundColor: "var(--pastel-yellow-bg)", color: "var(--pastel-yellow-fg)" },
          },
        ];
      }

      const guaranteedRemaining = tourShows.reduce((acc, s) => {
        if (s.is_settled) return acc;
        if (!isUpcomingDate(s.date)) return acc;
        const v = parseDollar(s.guarantee);
        return acc + (v ?? 0);
      }, 0);
      return [
        ...baseCards,
        {
          label: "Guaranteed Remaining",
          value: fmtMoney(guaranteedRemaining),
          icon: TrendingUp,
          iconStyle: { backgroundColor: "var(--pastel-yellow-bg)", color: "var(--pastel-yellow-fg)" },
        },
      ];
    }

    if (scope === "standalone") {
      const cutoff = subMonths(now, 12);
      const recentSettled = standaloneShows.filter((s) => {
        if (!s.is_settled) return false;
        const d = parseISO(s.date);
        return d >= cutoff;
      });
      const settledCount = recentSettled.length;
      const actualIncome = recentSettled.reduce((acc, s) => {
        const v = parseDollar(s.actual_walkout);
        return acc + (v ?? 0);
      }, 0);
      const guaranteedRemaining = standaloneUpcoming.reduce((acc, s) => {
        if (s.is_settled) return acc;
        const v = parseDollar(s.guarantee);
        return acc + (v ?? 0);
      }, 0);
      return [
        {
          label: "Upcoming Standalones",
          value: standaloneUpcoming.length,
          icon: Calendar,
          iconStyle: { backgroundColor: "var(--pastel-blue-bg)", color: "var(--pastel-blue-fg)" },
        },
        {
          label: "Settled (12 mo)",
          value: settledCount,
          icon: CheckCircle2,
          iconStyle: { backgroundColor: "var(--pastel-green-bg)", color: "var(--pastel-green-fg)" },
        },
        {
          label: "Actual Income",
          value: fmtMoney(actualIncome),
          icon: DollarSign,
          iconStyle: { backgroundColor: "var(--pastel-green-bg)", color: "var(--pastel-green-fg)" },
        },
        {
          label: "Guaranteed Remaining",
          value: fmtMoney(guaranteedRemaining),
          icon: TrendingUp,
          iconStyle: { backgroundColor: "var(--pastel-yellow-bg)", color: "var(--pastel-yellow-fg)" },
        },
      ];
    }

    // scope === "upcoming"
    const distinctTourIds = new Set<string>();
    const cutoff = subMonths(now, 12);
    const recentSettled = shows.filter((s) => {
      if (!s.is_settled) return false;
      const d = parseISO(s.date);
      return d >= cutoff;
    });
    const actualIncome = recentSettled.reduce((acc, s) => {
      const v = parseDollar(s.actual_walkout);
      return acc + (v ?? 0);
    }, 0);
    let guaranteedRemaining = 0;
    allUpcoming.forEach((s) => {
      if (s.tour_id) distinctTourIds.add(s.tour_id);
      if (!s.is_settled) {
        const v = parseDollar(s.guarantee);
        if (v != null) guaranteedRemaining += v;
      }
    });
    return [
      {
        label: "Upcoming Shows",
        value: allUpcoming.length,
        icon: Calendar,
        iconStyle: { backgroundColor: "var(--pastel-blue-bg)", color: "var(--pastel-blue-fg)" },
      },
      {
        label: "Tours Active",
        value: distinctTourIds.size,
        icon: Music,
        iconStyle: { backgroundColor: "var(--pastel-blue-bg)", color: "var(--pastel-blue-fg)" },
      },
      {
        label: "Actual Income",
        value: fmtMoney(actualIncome),
        icon: DollarSign,
        iconStyle: { backgroundColor: "var(--pastel-green-bg)", color: "var(--pastel-green-fg)" },
      },
      {
        label: "Guaranteed Remaining",
        value: fmtMoney(guaranteedRemaining),
        icon: TrendingUp,
        iconStyle: { backgroundColor: "var(--pastel-yellow-bg)", color: "var(--pastel-yellow-fg)" },
      },
    ];
  }, [scope, activeTour, isPastTour, tourShows, standaloneShows, standaloneUpcoming, allUpcoming, shows]);

  // --- Featured show + list per scope ---
  const featured = useMemo(() => {
    if (scope === "tour") {
      if (!activeTour) return null;
      if (isPastTour) {
        const last = tourShows[tourShows.length - 1];
        return last ? { show: last, mode: "final" as const } : null;
      }
      const next = tourShows.find((s) => isUpcomingDate(s.date));
      return next ? { show: next, mode: "next" as const } : null;
    }
    if (scope === "standalone") {
      const next = standaloneUpcoming[0];
      return next ? { show: next, mode: "next" as const } : null;
    }
    const next = allUpcoming[0];
    return next ? { show: next, mode: "next" as const } : null;
  }, [scope, activeTour, isPastTour, tourShows, standaloneUpcoming, allUpcoming]);

  const listShows = useMemo(() => {
    if (scope === "tour") {
      if (!activeTour) return [];
      if (isPastTour) return tourShows;
      const upcoming = tourShows.filter((s) => isUpcomingDate(s.date));
      // Drop the featured "next show" so it isn't shown twice.
      return upcoming.slice(1, 8);
    }
    if (scope === "standalone") {
      return standaloneUpcoming.slice(1, 8);
    }
    return allUpcoming.slice(1, 8);
  }, [scope, activeTour, isPastTour, tourShows, standaloneUpcoming, allUpcoming]);

  const listSectionLabel = scope === "tour" && isPastTour ? "Shows" : "Upcoming Shows";
  const showTourChip = scope === "upcoming";

  const viewAllHref = useMemo(() => {
    if (scope === "tour" && activeTourId) return `/shows?view=tour&tourId=${activeTourId}`;
    if (scope === "standalone") return "/shows?view=standalone";
    return "/shows";
  }, [scope, activeTourId]);

  if (showsLoading) {
    return (
      <div className="animate-fade-in space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  // Empty state — user has no shows at all.
  if (shows.length === 0) {
    return (
      <div className="animate-fade-in space-y-6 sm:space-y-8">
        <div className="flex items-center md:items-start justify-between gap-3 md:gap-4">
          <div className="min-w-0">
            <span className="md:hidden font-display text-xl tracking-tight text-foreground">Advance</span>
            <div className="hidden md:block">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-0.5">{greeting}</p>
              <h1 className="text-2xl sm:text-3xl tracking-tight">Dashboard</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <BulkUploadDialog />
            <CreateShowDialog />
          </div>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No shows yet — add your first one to get started.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const subline =
    scope === "tour" && activeTour ? (
      <Link
        to={`/shows?view=tour&tourId=${activeTour.id}`}
        className="text-sm text-muted-foreground hover:text-foreground [transition:color_150ms_var(--ease-out)] mt-0.5 inline-block truncate max-w-full"
      >
        {activeTour.name}
      </Link>
    ) : scope === "standalone" ? (
      <p className="text-sm text-muted-foreground mt-0.5">Standalone shows</p>
    ) : (
      <p className="text-sm text-muted-foreground mt-0.5">All upcoming work</p>
    );

  // The scope key drives section keys so React replays the stagger animation
  // when the user switches scopes.
  const scopeKey = scope === "tour" ? `tour:${activeTourId}` : scope;

  return (
    <div className="animate-fade-in space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex items-center md:items-start justify-between gap-3 md:gap-4">
        <div className="min-w-0">
          <span className="md:hidden font-display text-xl tracking-tight text-foreground">Advance</span>
          <div className="hidden md:block">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-0.5">{greeting}</p>
            <h1 className="text-2xl sm:text-3xl tracking-tight">Dashboard</h1>
            {subline}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <BulkUploadDialog />
          <CreateShowDialog />
        </div>
      </div>

      {/* Scope selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium mr-1">
          View
        </span>
        <TourPicker
          selectedTourId={scope === "tour" ? activeTourId : null}
          selectedTourName={scope === "tour" ? activeTour?.name ?? null : null}
          onSelect={(id) => setScopeTour(id)}
          onClear={clearTourScope}
          disabled={tours.length === 0}
          emptyLabel="No tours"
          showClear={false}
          fixedLabel="Tour"
        />
        <ScopePill
          label="Standalone"
          active={scope === "standalone"}
          onClick={setScopeStandalone}
        />
        <ScopePill
          label="All Upcoming"
          active={scope === "upcoming"}
          onClick={setScopeUpcoming}
        />
      </div>

      {/* Stat cards */}
      <div key={`stats:${scopeKey}`}>
        <div className="stagger-list grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          {statCards.map((card) => (
            <StatCard
              key={card.label}
              label={card.label}
              value={card.value}
              icon={card.icon}
              iconStyle={card.iconStyle}
            />
          ))}
        </div>
      </div>

      {/* Featured show */}
      {featured && (
        <div key={`featured:${scopeKey}`}>
          <SectionLabel>
            {featured.mode === "final"
              ? "Final Show"
              : scope === "standalone"
                ? "Next Standalone"
                : "Next Show"}
          </SectionLabel>
          <FeaturedShowCard
            show={featured.show}
            mode={featured.mode}
          />
        </div>
      )}

      {/* List */}
      {listShows.length > 0 && (
        <div key={`list:${scopeKey}`}>
          <SectionLabel>{listSectionLabel}</SectionLabel>
          <Card>
            <CardContent className="pt-4 space-y-1">
              {listShows.map((show, i) => {
                const daysAway = differenceInCalendarDays(parseISO(show.date), today);
                const isAdvanced = !!(show as any).advanced_at;
                const isPastShow = daysAway < 0;
                const isWithin7 = daysAway >= 0 && daysAway < 7;

                const dotStyle: React.CSSProperties = isPastShow
                  ? { backgroundColor: "var(--pastel-green-fg)" }
                  : isAdvanced
                    ? { backgroundColor: "var(--pastel-green-fg)" }
                    : isWithin7
                      ? { backgroundColor: "var(--pastel-red-fg)" }
                      : { backgroundColor: "var(--pastel-yellow-fg)" };

                const dateChipStyle: React.CSSProperties | undefined =
                  isWithin7 && !isAdvanced && !isPastShow
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
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium text-foreground truncate">{show.venue_name}</span>
                        {showTourChip && show.tour_id && show.tours?.name && (
                          <span
                            className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium shrink-0 max-w-[200px] truncate"
                            style={{ backgroundColor: "var(--pastel-blue-bg)", color: "var(--pastel-blue-fg)" }}
                          >
                            {show.tours.name}
                          </span>
                        )}
                        {showTourChip && !show.tour_id && (
                          <span className="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shrink-0">
                            Standalone
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground truncate">{formatCityState(show.city)}</span>
                    </div>
                    <span className="h-2 w-2 rounded-full shrink-0" style={dotStyle} />
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0 [transition:opacity_150ms_var(--ease-out)]" />
                  </Link>
                );
              })}
              <Link
                to={viewAllHref}
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
              const advanced = (tour.shows ?? []).filter((s) => !!(s as any).advanced_at).length;
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

interface StatCardData {
  label: string;
  value: string | number;
  icon: React.ElementType;
  iconStyle: React.CSSProperties;
}

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

function ScopePill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
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

function FeaturedShowCard({
  show,
  mode,
}: {
  show: Show;
  mode: "next" | "final";
}) {
  const date = parseISO(show.date);
  const daysAway = differenceInCalendarDays(date, new Date());
  const isAdvanced = !!(show as any).advanced_at;

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
  const showFinalDate = mode === "final";

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
              {showFinalDate ? (
                <span className="inline-block mt-2 text-[10px] uppercase tracking-widest font-medium px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                  {format(date, "MMM d, yyyy")}
                </span>
              ) : (
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
              )}
            </div>

            {/* Advance status */}
            <div className="text-right shrink-0">
              <span
                className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-medium px-2 py-1 rounded-full"
                style={
                  isAdvanced
                    ? { backgroundColor: "var(--pastel-green-bg)", color: "var(--pastel-green-fg)" }
                    : { backgroundColor: "var(--pastel-yellow-bg)", color: "var(--pastel-yellow-fg)" }
                }
              >
                {isAdvanced ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
                {isAdvanced ? "Advanced" : "Not Advanced"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
