import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format, parseISO, isPast, isToday, subDays } from "date-fns";
import { Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import CreateShowDialog from "@/components/CreateShowDialog";
import BulkUploadDialog from "@/components/BulkUploadDialog";
import SectionLabel from "@/components/SectionLabel";
import ShowCard from "@/components/ShowCard";
import StatusLegend from "@/components/StatusLegend";
import FeaturedShowCard from "@/components/FeaturedShowCard";
import DayOfShowFloatingButton from "@/components/DayOfShow/DayOfShowFloatingButton";
import { useAuth } from "@/components/AuthProvider";
import { useTeam } from "@/components/TeamProvider";
import type { Show } from "@/lib/types";

type ShowWithTour = Show & { tours?: { id: string; name: string } | null };

const PAGE_SIZE = 3;

function isUpcomingDate(date: string): boolean {
  const d = parseISO(date);
  return isToday(d) || !isPast(d);
}

export default function DashboardPage() {
  const { session } = useAuth();
  const { isArtist } = useTeam();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

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

  const today = new Date();
  const hour = today.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const userFullName =
    (session?.user?.user_metadata?.full_name as string | undefined)?.trim() ||
    (session?.user?.user_metadata?.name as string | undefined)?.trim() ||
    "";
  const userFirstName = userFullName.split(/\s+/)[0] || null;
  const todayStr = format(today, "yyyy-MM-dd");

  // "Today's show" — prioritizes unsettled show from today's date. Before 4 AM,
  // falls back to unsettled show from yesterday (load-outs and after-show wind-down
  // run late; the chip should persist past midnight until ~4 AM cliff). Always
  // prefers today's unsettled show over yesterday's, even before 4 AM, so newly
  // created shows take priority over completed ones from the previous night.
  const showToday = useMemo(() => {
    const now = new Date();
    // First priority: any unsettled show from today
    const todayShow = shows.find((s) => s.date === todayStr && !s.is_settled);
    if (todayShow) return todayShow;

    // Before 4 AM: fall back to unsettled show from yesterday (load-out window)
    if (now.getHours() < 4) {
      const yesterdayStr = format(subDays(now, 1), "yyyy-MM-dd");
      const yesterdayShow = shows.find((s) => s.date === yesterdayStr && !s.is_settled);
      if (yesterdayShow) return yesterdayShow;
    }

    return null;
  }, [shows, todayStr]);

  const headerLine = showToday
    ? userFirstName
      ? `Have a great show, ${userFirstName}`
      : "Have a great show tonight"
    : userFirstName
      ? `${greeting}, ${userFirstName}`
      : greeting;

  const upcoming = useMemo(
    () => shows.filter((s) => isUpcomingDate(s.date)),
    [shows],
  );

  // Featured: today's show if there is one, otherwise the next upcoming
  // unsettled show. No scope, no past-tour mode.
  const featured = useMemo<{ show: ShowWithTour; mode: "next" } | null>(() => {
    if (showToday) return { show: showToday as ShowWithTour, mode: "next" };
    const next = upcoming.find((s) => !s.is_settled);
    return next ? { show: next, mode: "next" } : null;
  }, [showToday, upcoming]);

  // The list excludes the featured show.
  const listShows = useMemo(() => {
    if (!featured) return upcoming;
    return upcoming.filter((s) => s.id !== featured.show.id);
  }, [upcoming, featured]);

  const visibleListShows = useMemo(
    () => listShows.slice(0, visibleCount),
    [listShows, visibleCount],
  );

  const hasMore = visibleCount < listShows.length;

  // Infinite scroll: when the sentinel intersects the viewport, reveal more.
  useEffect(() => {
    if (!hasMore) return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((c) => Math.min(c + PAGE_SIZE, listShows.length));
        }
      },
      { rootMargin: "0px", threshold: 0.6 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, listShows.length]);

  const dateEyebrow = `${format(today, "EEEE")} · ${format(today, "MMM d")}`.toUpperCase();

  const header = (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span
          className="text-[11px] uppercase font-medium leading-none truncate"
          style={{ letterSpacing: "0.18em", color: "hsl(var(--muted-foreground))" }}
        >
          {dateEyebrow}
        </span>
        {!isArtist && (
          <div className="flex items-center gap-2 shrink-0">
            <BulkUploadDialog triggerClassName="h-9" iconOnlyMobile />
            <CreateShowDialog triggerClassName="h-9" iconOnlyMobile />
          </div>
        )}
      </div>

      <h1 className="min-w-0 flex-1 font-display text-3xl md:text-4xl tracking-[-0.02em] leading-[1.1] text-foreground">
        {headerLine}
      </h1>
    </div>
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
        {showToday && <DayOfShowFloatingButton showId={showToday.id} />}
      </div>
    );
  }

  // Has shows but none upcoming — "all caught up" empty.
  const noUpcoming = upcoming.length === 0;

  return (
    <div className="animate-fade-in space-y-6 sm:space-y-8">
      {header}

      {noUpcoming ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Calendar className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              All caught up — no upcoming shows on the calendar.
            </p>
            {!isArtist && (
              <div className="mt-4 inline-flex">
                <CreateShowDialog />
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {featured && (
            <div>
              <SectionLabel>
                {featured.show.date === todayStr ? "Tonight" : "Next Show"}
              </SectionLabel>
              <FeaturedShowCard
                show={featured.show}
                mode={featured.mode}
                tour={featured.show.tours ?? null}
              />
            </div>
          )}

          {listShows.length > 0 && (
            <div>
              <SectionLabel
                action={
                  <div className="flex items-center gap-2">
                    <StatusLegend />
                    <Link
                      to="/shows"
                      className="text-[11px] uppercase tracking-widest font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      View all →
                    </Link>
                  </div>
                }
              >
                Upcoming Shows
              </SectionLabel>
              <div className="space-y-2">
                {visibleListShows.map((show, i) => (
                  <div
                    key={show.id}
                    className="stagger-item"
                    style={{ animationDelay: `${(i % PAGE_SIZE) * 60}ms` }}
                  >
                    <ShowCard
                      show={show}
                      chip={show.tour_id ? "tour" : "none"}
                    />
                  </div>
                ))}
              </div>
              {hasMore && (
                <div ref={sentinelRef} aria-hidden className="h-12" />
              )}
            </div>
          )}
        </>
      )}

      {showToday && <DayOfShowFloatingButton showId={showToday.id} />}
    </div>
  );
}
