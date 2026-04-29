import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Phone } from "lucide-react";
import { to24Hour } from "@/lib/timeFormat";
import type { Show, ScheduleEntry } from "@/lib/types";
import ScheduleList from "./ScheduleList";
import PlaceFooter from "./PlaceFooter";
import { fmt12parts, formatRelative, showDayMinutes } from "./timeUtils";

interface PhasePreShowProps {
  show: Show;
  /** Current local time as minutes past midnight. Drives the hero + dim states. */
  nowMin: number;
}

/**
 * Phase 1 surface — pre-show. Three regions, top-to-bottom:
 *
 *   - Hero (pinned top): "UP NEXT" eyebrow + label + big serif time +
 *     relative countdown. Single-column; the venue lives in the place
 *     footer below.
 *   - Schedule (scrolls): the operative artifact. Soft fades top and
 *     bottom keep the edges from hard-clipping. The schedule grows
 *     freely without breaking the layout — long festival schedules
 *     just scroll inside the device frame.
 *   - DOS contact + place footer (pinned bottom): always reachable
 *     regardless of how long the schedule is.
 *
 * The flex chain on every column container needs `min-height: 0` so
 * the scroll child can shrink below content size. Without it, the
 * schedule pushes the contact + footer off-screen.
 */
export default function PhasePreShow({ show, nowMin }: PhasePreShowProps) {
  const navigate = useNavigate();
  const sortedEntries = useMemo<ScheduleEntry[]>(() => {
    const entries = [...(show.schedule_entries ?? [])];
    entries.sort((a, b) => {
      const am = showDayMinutes(a.time);
      const bm = showDayMinutes(b.time);
      if (am === null && bm === null) return a.sort_order - b.sort_order;
      if (am === null) return 1;
      if (bm === null) return -1;
      if (am !== bm) return am - bm;
      return a.sort_order - b.sort_order;
    });
    return entries;
  }, [show.schedule_entries]);

  const heroIndex = useMemo(() => {
    const idx = sortedEntries.findIndex((e) => {
      const m = showDayMinutes(e.time);
      return m !== null && m >= nowMin;
    });
    if (idx !== -1) return idx;
    return sortedEntries.length > 0 ? sortedEntries.length - 1 : null;
  }, [sortedEntries, nowMin]);

  const hero = heroIndex !== null ? sortedEntries[heroIndex] : null;
  const heroMin = hero ? showDayMinutes(hero.time) : null;
  const remaining = heroMin !== null ? heroMin - nowMin : null;
  const isFuture = remaining !== null && remaining > 0;
  const heroParts = hero ? fmt12parts(to24Hour(hero.time) ?? hero.time) : null;

  const dosContact = useMemo(
    () => (show.show_contacts ?? []).find((c) => c.role === "day_of_show") ?? null,
    [show.show_contacts],
  );

  return (
    <div
      className="px-[22px] pt-2 pb-7 flex-1 flex flex-col gap-4"
      // min-height: 0 is critical — without it the scroll region below
      // can't shrink below content size, and the schedule pushes the
      // pinned footer + contact card off the device frame.
      style={{ minHeight: 0 }}
    >
      {/* Hero (pinned top) */}
      <div className="pt-[10px] pb-1" data-stagger="0">
        <div
          className="text-[11px] uppercase font-medium leading-none mb-2.5"
          style={{ letterSpacing: "0.18em", color: "hsl(var(--muted-foreground))" }}
        >
          {isFuture ? "Up next" : "Now"}
        </div>
        {hero && (
          <>
            <div
              className="text-[22px] font-medium leading-[1.05]"
              style={{ letterSpacing: "-0.02em", color: "hsl(var(--foreground))" }}
            >
              {hero.label}
            </div>
            {heroParts && (
              <div
                className="mt-3 flex items-baseline gap-2 tabular-nums"
                style={{ letterSpacing: "-0.03em" }}
              >
                <span
                  className="font-display"
                  style={{
                    fontSize: 64,
                    lineHeight: 0.92,
                    color: "hsl(var(--foreground))",
                  }}
                >
                  {heroParts.n}
                </span>
                <span
                  className="font-display"
                  style={{
                    fontSize: 22,
                    lineHeight: 0.92,
                    letterSpacing: "-0.02em",
                    color: "hsl(var(--muted-foreground))",
                  }}
                >
                  {heroParts.u}
                </span>
              </div>
            )}
            {remaining !== null && (
              <div
                className="mt-2.5 text-[13px] font-medium leading-[1.2]"
                style={{ color: "hsl(var(--muted-foreground))" }}
              >
                {isFuture ? formatRelative(remaining) : "now"}
              </div>
            )}
          </>
        )}
      </div>

      {/* Schedule (scrolls in middle) */}
      {sortedEntries.length > 0 && (
        <div className="dos-p1-scroll-wrap" data-stagger="2">
          <div className="dos-p1-scroll-fade top" />
          <div className="dos-p1-scroll">
            <ScheduleList
              entries={sortedEntries}
              nowMin={nowMin}
              heroIndex={heroIndex}
            />
          </div>
          <div className="dos-p1-scroll-fade bottom" />
        </div>
      )}

      {/* DOS contact (pinned, simplified) */}
      <a
        href={dosContact?.phone ? `tel:${dosContact.phone}` : undefined}
        onClick={
          dosContact?.phone
            ? undefined
            : (e) => {
                e.preventDefault();
                navigate(`/shows/${show.id}?tab=contacts`);
              }
        }
        className="flex items-center gap-3 rounded-[12px] border bg-card px-3.5 py-2.5 transition-transform active:scale-[0.985]"
        style={{ borderColor: "hsl(var(--border))" }}
        data-stagger="3"
      >
        <div className="flex-1 min-w-0">
          <div
            className="text-[14px] font-medium leading-tight truncate"
            style={{
              color: dosContact?.name
                ? "hsl(var(--foreground))"
                : "hsl(var(--muted-foreground))",
            }}
          >
            {dosContact?.name ?? "Add a day-of contact"}
          </div>
          <div
            className="mt-1 text-[11px] uppercase font-medium leading-none"
            style={{ letterSpacing: "0.14em", color: "hsl(var(--muted-foreground))" }}
          >
            Day of Show contact
          </div>
        </div>
        <div
          aria-hidden
          className="shrink-0 inline-flex items-center justify-center rounded-full"
          style={{
            width: 34,
            height: 34,
            background: "hsl(152 60% 22% / 0.55)",
            color: "hsl(152 60% 78%)",
          }}
        >
          <Phone className="h-[15px] w-[15px]" strokeWidth={1.7} />
        </div>
      </a>

      {/* Place footer (pinned bottom) */}
      <PlaceFooter
        venueName={show.venue_name}
        city={show.city}
        address={show.venue_address}
      />
    </div>
  );
}
