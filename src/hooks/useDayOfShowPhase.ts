import { useMemo } from "react";
import { format } from "date-fns";
import type { Show } from "@/lib/types";
import { showDayMinutes } from "@/components/DayOfShow/timeUtils";

export type DayOfShowPhase = 1 | 2 | 3;

/** Buffer after the band's set start before Phase 2 (Settle) auto-promotes.
 *  90 min covers a typical headliner set + some load-out lead time, so the
 *  Settle CTA shows up around when the show is naturally winding down. */
const SETTLE_BUFFER_MIN = 90;

/**
 * Derive the Day of Show phase from the show + current wall clock.
 *
 *   Phase 3 — settled. The hotel reveal.
 *   Phase 2 — set has finished (band's `is_band` entry + 90 min has passed).
 *             The Settle CTA + hotel teaser. Triggered as well by load-out
 *             (TODO: needs row-level "completed" tracking — not in DB yet).
 *   Phase 1 — default. Pre-show, schedule + actions.
 *
 * Phase is always derived, never stored — the source of truth is `show` +
 * `nowMin`. This keeps the in-overlay state predictable and avoids drift.
 *
 * `isArtist` skips Phase 2 entirely: settle isn't an artist concern, so when
 * the same time-based trigger would fire, artists land directly on Phase 3
 * (hotel reveal) regardless of `is_settled`. Their flow is schedule → hotel.
 */
export function useDayOfShowPhase(
  show: Show,
  nowMin: number,
  isArtist: boolean = false,
): DayOfShowPhase {
  return useMemo(() => {
    if (show.is_settled) return 3;

    const setEntry = (show.schedule_entries ?? []).find((e) => e.is_band);
    const setMin = setEntry ? showDayMinutes(setEntry.time) : null;
    if (setMin === null) return 1;

    // If the show is still "tonight" but the wall clock has crossed midnight
    // (show.date < today, current hour < 4 AM), bump nowMin into the same
    // show-day coordinate space as setMin (which showDayMinutes already
    // bumps for early-morning entries). Without this, a 9 PM band set looks
    // 19 hours in the future at 1 AM next day instead of 4 hours past.
    const now = new Date();
    const todayStr = format(now, "yyyy-MM-dd");
    const isPostMidnightOnShowNight = show.date < todayStr && now.getHours() < 4;
    const showDayNow = isPostMidnightOnShowNight ? nowMin + 24 * 60 : nowMin;

    if (showDayNow >= setMin + SETTLE_BUFFER_MIN) return isArtist ? 3 : 2;
    return 1;
  }, [show.is_settled, show.schedule_entries, show.date, nowMin, isArtist]);
}
