import { useMemo, useState } from "react";
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
  ChevronDown,
  TrendingUp,
  DollarSign,
  CheckCircle2,
  Info,
  Mic,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn, formatCityState } from "@/lib/utils";
import { to12Hour, to24Hour } from "@/lib/timeFormat";
import { isLoadInLabel, isDoorsLabel } from "@/lib/scheduleMatch";
import CreateShowDialog from "@/components/CreateShowDialog";
import BulkUploadDialog from "@/components/BulkUploadDialog";
import TourPicker from "@/components/TourPicker";
import { useTeam } from "@/components/TeamProvider";
import { useAuth } from "@/components/AuthProvider";
import { parseDollar } from "@/components/RevenueSimulator";
import SectionLabel from "@/components/SectionLabel";
import ShowCard from "@/components/ShowCard";
import StatusDot from "@/components/StatusDot";
import StatusLegend from "@/components/StatusLegend";
import type { Show, Tour } from "@/lib/types";

type Scope = "tour" | "standalone" | "upcoming";
type ShowWithTour = Show & { tours?: { id: string; name: string } | null };
type TourWithShows = Tour & { shows: Show[] };

type DashCards =
  | {
      kind: "pastTour";
      totalShows: number;
      totalEarned: number;
      totalGuarantee: number;
    }
  | {
      kind: "progressRevenue";
      progressLabel: "Tour Progress" | "Recent Progress";
      scopeKind: "tour" | "standalone" | "all";
      scopeSubtitle: string | null;
      scopeSubtitleHref: string | null;
      advanced: { n: number; total: number };
      settled: { n: number; total: number; earned: number };
      earnedIncome: number;
      settledCount: number;
      guaranteedRemaining: number;
      upside: number;
      isTourScope: boolean;
      noUpcoming: boolean;
      noRecent: boolean;
    };

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

const SETTLED_WINDOW_MONTHS = 12;

const UPSIDE_TOOLTIP =
  "Projected earnings at 70% sell-through of walkout potential across upcoming shows.";

function projectedUpside(shows: Show[]): number {
  return shows.reduce((acc, s) => {
    if (s.is_settled) return acc;
    if (!isUpcomingDate(s.date)) return acc;
    const walkout = parseDollar(s.walkout_potential) ?? 0;
    return acc + walkout * 0.7;
  }, 0);
}

export default function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedScope = parseScope(searchParams.get("scope"));
  const requestedTourId = searchParams.get("tourId");
  const { team } = useTeam();
  const { session } = useAuth();
  const [revenueCollapsed, setRevenueCollapsed] = useState(false);

  const { data: shows = [], isLoading: showsLoading } = useQuery<ShowWithTour[]>({
    queryKey: ["shows"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shows")
        .select("*, schedule_entries(*), tours(id, name)")
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
        .select("*, shows(*, schedule_entries(*))")
        .order("start_date", { ascending: true });
      if (error) throw error;
      return data as TourWithShows[];
    },
  });

  const today = new Date();
  const hour = today.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const userFullName =
    (session?.user?.user_metadata?.full_name as string | undefined)?.trim() ||
    (session?.user?.user_metadata?.name as string | undefined)?.trim() ||
    "";
  const userFirstName = userFullName.split(/\s+/)[0] || null;
  const todayStr = format(today, "yyyy-MM-dd");

  const showToday = useMemo(
    () => shows.find((s) => s.date === todayStr && !s.is_settled) ?? null,
    [shows, todayStr],
  );

  const headerLine = showToday
    ? userFirstName
      ? `Have a great show, ${userFirstName}`
      : "Have a great show tonight"
    : userFirstName
      ? `${greeting}, ${userFirstName}`
      : greeting;

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

  // --- Per-scope dashboard card data ---
  const dashCards = useMemo<DashCards>(() => {
    const now = new Date();

    // Past tour: collapsed recap card.
    if (scope === "tour" && activeTour && isPastTour) {
      const totalEarned = tourShows.reduce((acc, s) => {
        if (!s.is_settled) return acc;
        const v = parseDollar(s.actual_walkout);
        return acc + (v ?? 0);
      }, 0);
      const totalGuarantee = tourShows.reduce((acc, s) => {
        const v = parseDollar(s.guarantee);
        return acc + (v ?? 0);
      }, 0);
      return {
        kind: "pastTour",
        totalShows: tourShows.length,
        totalEarned,
        totalGuarantee,
      };
    }

    // Active tour.
    if (scope === "tour" && activeTour) {
      const total = tourShows.length;
      const advanced = tourShows.filter((s) => !!(s as Show).advanced_at).length;
      const settledList = tourShows.filter((s) => s.is_settled);
      const settledCount = settledList.length;
      const earned = settledList.reduce((acc, s) => {
        const v = parseDollar(s.actual_walkout);
        return acc + (v ?? 0);
      }, 0);
      const guaranteedRemaining = tourShows.reduce((acc, s) => {
        if (s.is_settled) return acc;
        if (!isUpcomingDate(s.date)) return acc;
        const v = parseDollar(s.guarantee);
        return acc + (v ?? 0);
      }, 0);
      return {
        kind: "progressRevenue",
        progressLabel: "Tour Progress",
        scopeKind: "tour",
        scopeSubtitle: activeTour.name,
        scopeSubtitleHref: `/shows?view=tour&tourId=${activeTour.id}`,
        advanced: { n: advanced, total },
        settled: { n: settledCount, total, earned },
        earnedIncome: earned,
        settledCount,
        guaranteedRemaining,
        upside: projectedUpside(tourShows),
        isTourScope: true,
        noUpcoming: total === 0,
        noRecent: total === 0,
      };
    }

    const cutoff = subMonths(now, SETTLED_WINDOW_MONTHS);

    if (scope === "standalone") {
      const recentStandalone = standaloneShows.filter((s) => parseISO(s.date) >= cutoff);
      const upcomingTotal = standaloneUpcoming.length;
      const advanced = standaloneUpcoming.filter((s) => !!(s as Show).advanced_at).length;
      const recentSettled = recentStandalone.filter((s) => s.is_settled);
      const settledCount = recentSettled.length;
      const earned = recentSettled.reduce((acc, s) => {
        const v = parseDollar(s.actual_walkout);
        return acc + (v ?? 0);
      }, 0);
      const guaranteedRemaining = standaloneUpcoming.reduce((acc, s) => {
        if (s.is_settled) return acc;
        const v = parseDollar(s.guarantee);
        return acc + (v ?? 0);
      }, 0);
      return {
        kind: "progressRevenue",
        progressLabel: "Recent Progress",
        scopeKind: "standalone",
        scopeSubtitle: "Standalone shows",
        scopeSubtitleHref: "/shows?view=standalone",
        advanced: { n: advanced, total: upcomingTotal },
        settled: { n: settledCount, total: recentStandalone.length, earned },
        earnedIncome: earned,
        settledCount,
        guaranteedRemaining,
        upside: projectedUpside(standaloneUpcoming),
        isTourScope: false,
        noUpcoming: upcomingTotal === 0,
        noRecent: recentStandalone.length === 0,
      };
    }

    // scope === "upcoming" → user-facing "All Shows"
    const recentAll = shows.filter((s) => parseISO(s.date) >= cutoff);
    const upcomingTotal = allUpcoming.length;
    const advanced = allUpcoming.filter((s) => !!(s as Show).advanced_at).length;
    const recentSettled = recentAll.filter((s) => s.is_settled);
    const settledCount = recentSettled.length;
    const earned = recentSettled.reduce((acc, s) => {
      const v = parseDollar(s.actual_walkout);
      return acc + (v ?? 0);
    }, 0);
    const guaranteedRemaining = allUpcoming.reduce((acc, s) => {
      if (s.is_settled) return acc;
      const v = parseDollar(s.guarantee);
      return acc + (v ?? 0);
    }, 0);
    return {
      kind: "progressRevenue",
      progressLabel: "Recent Progress",
      scopeKind: "all",
      scopeSubtitle: "All shows · last 12 months",
      scopeSubtitleHref: "/shows",
      advanced: { n: advanced, total: upcomingTotal },
      settled: { n: settledCount, total: recentAll.length, earned },
      earnedIncome: earned,
      settledCount,
      guaranteedRemaining,
      upside: projectedUpside(allUpcoming),
      isTourScope: false,
      noUpcoming: upcomingTotal === 0,
      noRecent: recentAll.length === 0,
    };
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

  const header = (
    <div className="flex items-start justify-between gap-3 md:gap-4">
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-3xl md:text-4xl tracking-[-0.02em] leading-[1.1] text-foreground">
          {headerLine}
        </h1>
        {showToday && (
          <Link
            to={`/shows/${showToday.id}`}
            className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground [transition:color_150ms_var(--ease-out)] truncate max-w-full"
          >
            <Mic
              className="mic-glow h-3.5 w-3.5 shrink-0"
              strokeWidth={2.25}
              aria-hidden="true"
            />
            <span className="truncate">
              Tonight · {showToday.venue_name}
              {showToday.city ? `, ${formatCityState(showToday.city)}` : ""}
            </span>
          </Link>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <BulkUploadDialog triggerClassName="h-9" iconOnlyMobile />
        <CreateShowDialog triggerClassName="h-9" iconOnlyMobile />
      </div>
    </div>
  );

  // Empty state — user has no shows at all.
  if (shows.length === 0) {
    return (
      <div className="animate-fade-in space-y-6 sm:space-y-8">
        {header}
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No shows yet — add your first one to get started.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // The scope key drives section keys so React replays the stagger animation
  // when the user switches scopes.
  const scopeKey = scope === "tour" ? `tour:${activeTourId}` : scope;

  return (
    <div className="animate-fade-in space-y-6 sm:space-y-8">
      {header}

      {/* Scope selector */}
      <div className="flex items-center gap-2 flex-wrap pt-4 md:pt-6">
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
          label="All Shows"
          active={scope === "upcoming"}
          onClick={setScopeUpcoming}
        />
      </div>

      {/* Progress + Revenue cards */}
      <div key={`stats:${scopeKey}`}>
        {dashCards.kind === "pastTour" ? (
          <PastTourCard
            totalShows={dashCards.totalShows}
            totalEarned={dashCards.totalEarned}
            totalGuarantee={dashCards.totalGuarantee}
          />
        ) : revenueCollapsed ? (
          <div className="space-y-3">
            <ProgressCard data={dashCards} />
            <RevenueCard
              data={dashCards}
              collapsed
              onToggleCollapse={() => setRevenueCollapsed((c) => !c)}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
            <ProgressCard data={dashCards} className="lg:col-span-3" />
            <RevenueCard
              data={dashCards}
              collapsed={false}
              onToggleCollapse={() => setRevenueCollapsed((c) => !c)}
            />
          </div>
        )}
      </div>

      {/* Featured show */}
      {featured && (
        <div key={`featured:${scopeKey}`}>
          <SectionLabel>
            {featured.mode === "next" && featured.show.date === todayStr
              ? "Tonight"
              : featured.mode === "final"
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
          <SectionLabel
            action={
              <div className="flex items-center gap-2">
                <StatusLegend />
                <Link
                  to={viewAllHref}
                  className="text-[11px] uppercase tracking-widest font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  View all →
                </Link>
              </div>
            }
          >
            {listSectionLabel}
          </SectionLabel>
          <div className="stagger-list space-y-2">
            {listShows.map((show) => (
              <ShowCard
                key={show.id}
                show={show}
                chip={showTourChip ? (show.tour_id ? "tour" : "standalone") : "none"}
              />
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

/* --- Sub-components --- */

type ProgressRevenueData = Extract<DashCards, { kind: "progressRevenue" }>;

function ProgressCard({
  data,
  className,
}: {
  data: ProgressRevenueData;
  className?: string;
}) {
  const {
    progressLabel,
    scopeKind,
    scopeSubtitle,
    scopeSubtitleHref,
    advanced,
    settled,
    noUpcoming,
    noRecent,
  } = data;

  const advancedPct = advanced.total > 0 ? Math.round((advanced.n / advanced.total) * 100) : 0;
  const settledPct = settled.total > 0 ? Math.round((settled.n / settled.total) * 100) : 0;
  const remaining = Math.max(0, advanced.total - advanced.n);

  const advancedTooltip = noUpcoming
    ? scopeKind === "tour"
      ? "No shows in this tour"
      : scopeKind === "standalone"
        ? "No upcoming standalone shows"
        : "No upcoming shows"
    : remaining === 0
      ? "All caught up"
      : `${remaining} shows still to advance`;

  const settledTooltip = noRecent
    ? "No recent shows"
    : scopeKind === "tour"
      ? `${fmtMoney(settled.earned)} earned`
      : `${fmtMoney(settled.earned)} earned · last 12 months`;

  return (
    <Card className={cn("overflow-hidden shadow-none", className)}>
      <CardContent className="pt-3 pb-4 px-4">
        <div className="flex items-center gap-2 mb-3">
          <div
            className="h-6 w-6 rounded-md flex items-center justify-center shrink-0"
            style={{ backgroundColor: "var(--pastel-purple-bg)", color: "var(--pastel-purple-fg)" }}
          >
            <TrendingUp className="h-3.5 w-3.5" />
          </div>
          <span className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium leading-tight">
            {progressLabel}
          </span>
          {scopeSubtitle && (
            scopeSubtitleHref ? (
              <Link
                to={scopeSubtitleHref}
                className="ml-auto text-sm font-medium text-foreground hover:text-muted-foreground [transition:color_150ms_var(--ease-out)] truncate min-w-0"
              >
                {scopeSubtitle}
              </Link>
            ) : (
              <p className="ml-auto text-sm font-medium text-foreground truncate min-w-0">{scopeSubtitle}</p>
            )
          )}
        </div>

        <div className="space-y-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="space-y-1 cursor-help hover:brightness-105 [transition:filter_150ms_var(--ease-out)]">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground uppercase tracking-wide font-medium">Advanced</span>
                  <span className="text-foreground tabular-nums">
                    {advanced.n} of {advanced.total} · {advancedPct}%
                  </span>
                </div>
                <Progress
                  value={advancedPct}
                  className="h-1.5 [&>div]:bg-[var(--pastel-purple-fg)] [&>div]:[transition:transform_200ms_var(--ease-out),filter_150ms_var(--ease-out)]"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>{advancedTooltip}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="space-y-1 cursor-help hover:brightness-105 [transition:filter_150ms_var(--ease-out)]">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground uppercase tracking-wide font-medium">Settled</span>
                  <span className="text-foreground tabular-nums">
                    {settled.n} of {settled.total}
                  </span>
                </div>
                <Progress
                  value={settledPct}
                  className="h-1.5 [&>div]:bg-[var(--pastel-green-fg)] [&>div]:[transition:transform_200ms_var(--ease-out),filter_150ms_var(--ease-out)]"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>{settledTooltip}</TooltipContent>
          </Tooltip>
        </div>
      </CardContent>
    </Card>
  );
}

function RevenueCard({
  data,
  collapsed,
  onToggleCollapse,
  className,
}: {
  data: ProgressRevenueData;
  collapsed: boolean;
  onToggleCollapse: () => void;
  className?: string;
}) {
  const [mode, setMode] = useState<"earned" | "upcoming">("earned");
  const { earnedIncome, settledCount, guaranteedRemaining, upside, isTourScope } = data;

  if (collapsed) {
    return (
      <Card className={cn("overflow-hidden shadow-none", className)}>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/40 [transition:background-color_150ms_var(--ease-out)]"
          aria-label="Expand revenue card"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="h-6 w-6 rounded-md flex items-center justify-center shrink-0"
              style={{ backgroundColor: "var(--pastel-green-bg)", color: "var(--pastel-green-fg)" }}
            >
              <DollarSign className="h-3.5 w-3.5" />
            </div>
            <span className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">
              Revenue
            </span>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 -rotate-90" />
        </button>
      </Card>
    );
  }

  const earnedPrimary =
    settledCount === 0
      ? "No settled shows yet"
      : `From ${settledCount} settled shows`;
  const earnedSecondary = settledCount > 0 && !isTourScope ? "last 12 months" : null;

  const toggleButtons = (fullWidth: boolean) => (
    <div className={cn(
      "grid grid-cols-2 gap-0.5 bg-secondary border border-border/60 p-[3px] rounded-md",
      fullWidth && "w-full",
    )}>
      {(["earned", "upcoming"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => setMode(m)}
          className={cn(
            "h-7 px-2 text-xs font-medium rounded-[4px] transition-colors flex items-center justify-center",
            mode === m
              ? "bg-background text-foreground border border-border/60"
              : "text-muted-foreground",
          )}
        >
          {m === "earned" ? "Earned" : "Upcoming"}
        </button>
      ))}
    </div>
  );

  const collapseBtn = (
    <button
      type="button"
      onClick={onToggleCollapse}
      aria-label="Collapse revenue card"
      className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent [transition:background-color_150ms_var(--ease-out)]"
    >
      <ChevronDown className="h-4 w-4 rotate-180" />
    </button>
  );

  const content = (
    <div key={mode} className="animate-in fade-in-0 duration-150 min-w-0 flex-1">
      {mode === "earned" ? (
        <>
          <p className="font-display text-foreground leading-none tracking-[-0.03em] text-3xl">
            {fmtMoney(earnedIncome)}
          </p>
          <div className="text-xs text-muted-foreground mt-2 leading-snug">
            <p className="truncate">{earnedPrimary}</p>
            {earnedSecondary && <p className="truncate">{earnedSecondary}</p>}
          </div>
        </>
      ) : (
        <>
          <p className="font-display text-foreground leading-none tracking-[-0.03em] text-3xl">
            {guaranteedRemaining === 0 ? "—" : fmtMoney(guaranteedRemaining)}
          </p>
          {upside > 0 && (
            <div
              className="text-xs mt-2 flex items-center gap-1"
              style={{ color: "var(--pastel-green-fg)" }}
            >
              <span>+ {fmtMoney(upside)} upside</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex cursor-help" aria-label="Upside details">
                    <Info className="h-3 w-3" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>{UPSIDE_TOOLTIP}</TooltipContent>
              </Tooltip>
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <Card className={cn("overflow-hidden shadow-none", className)}>
      {/* Mobile: number left, toggle+collapse right */}
      <CardContent className="pt-3 pb-4 px-4 lg:hidden">
        <div className="flex items-start gap-2">
          {content}
          <div className="flex items-center gap-1 shrink-0">
            {toggleButtons(false)}
            {collapseBtn}
          </div>
        </div>
      </CardContent>

      {/* Desktop: number top, full-width toggle at bottom */}
      <CardContent className="hidden lg:flex flex-col gap-3 pt-3 pb-3 px-4 h-full">
        {content}
        <div className="flex items-center gap-1">
          {toggleButtons(true)}
          {collapseBtn}
        </div>
      </CardContent>
    </Card>
  );
}

// TODO: proper tour recap design
function PastTourCard({
  totalShows,
  totalEarned,
  totalGuarantee,
}: {
  totalShows: number;
  totalEarned: number;
  totalGuarantee: number;
}) {
  return (
    <Card className="overflow-hidden shadow-none">
      <CardContent className="pt-4 pb-4 px-4">
        <div className="flex items-center gap-2 mb-3">
          <div
            className="h-6 w-6 rounded-md flex items-center justify-center shrink-0"
            style={{ backgroundColor: "var(--pastel-green-bg)", color: "var(--pastel-green-fg)" }}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
          </div>
          <span className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium leading-tight">
            Tour Complete
          </span>
        </div>
        <p className="text-sm text-foreground">
          {totalShows} shows
          <span className="text-muted-foreground"> · </span>
          {fmtMoney(totalEarned)} earned
          <span className="text-muted-foreground"> · </span>
          {fmtMoney(totalGuarantee)} guaranteed
        </p>
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

  const entries = show.schedule_entries ?? [];
  const loadInEntry = entries
    .filter((e) => isLoadInLabel(e.label))
    .sort((a, b) => (to24Hour(a.time) ?? "").localeCompare(to24Hour(b.time) ?? ""))[0];
  const doorsEntry = entries.find((e) => isDoorsLabel(e.label));
  const bandEntry = entries.find((e) => e.is_band);

  const loadInTime = to12Hour(loadInEntry?.time);
  const doorsTime = to12Hour(doorsEntry?.time);
  const setTime = to12Hour(bandEntry?.time);

  const capRaw = show.venue_capacity;
  const capNum = capRaw ? parseInt(String(capRaw).replace(/[^\d]/g, ""), 10) : NaN;
  const capDisplay = Number.isFinite(capNum) ? capNum.toLocaleString() : null;

  const footerCells: { label: string; value: string | null }[] = [
    { label: "Load-in", value: loadInTime },
    { label: "Doors", value: doorsTime },
    { label: "Set", value: setTime },
    { label: "Capacity", value: capDisplay },
  ];
  const hasAnyFooterData = footerCells.some((c) => !!c.value);

  return (
    <Link to={`/shows/${show.id}`} className="block group card-pressable">
      <Card className="overflow-hidden hover:border-foreground/20 [transition:border-color_160ms_var(--ease-out),box-shadow_200ms_var(--ease-out)]">
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-start gap-4 sm:gap-5">
            {/* Calendar stub */}
            <div className="shrink-0 flex flex-col items-center justify-center rounded-lg border border-border bg-muted/50 w-14 h-[4.5rem] select-none">
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
                <span className="inline-flex items-center mt-2 text-[10px] uppercase tracking-widest font-medium px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                  {format(date, "MMM d, yyyy")}
                </span>
              ) : (
                <span
                  className={cn(
                    "inline-flex items-center mt-2 text-[10px] uppercase tracking-widest font-medium px-2 py-0.5 rounded-full",
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

            {/* Advance status dot */}
            <StatusDot show={show} className="mt-1.5" />
          </div>
        </CardContent>
        {hasAnyFooterData && (
          <div className="grid grid-cols-4 border-t bg-muted/40">
            {footerCells.map((cell, i) => (
              <div
                key={cell.label}
                className={cn("py-3 px-3 sm:px-4", i < 3 && "border-r")}
                style={i < 3 ? { borderRightWidth: "0.5px" } : undefined}
              >
                <div className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">
                  {cell.label}
                </div>
                <div
                  className={cn(
                    "text-sm mt-1 whitespace-nowrap",
                    cell.value ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {cell.value ?? "—"}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </Link>
  );
}
