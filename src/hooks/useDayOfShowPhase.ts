import { useMemo } from "react";
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
 */
export function useDayOfShowPhase(show: Show, nowMin: number): DayOfShowPhase {
  return useMemo(() => {
    if (show.is_settled) return 3;

    const setEntry = (show.schedule_entries ?? []).find((e) => e.is_band);
    const setMin = setEntry ? showDayMinutes(setEntry.time) : null;
    if (setMin !== null && nowMin >= setMin + SETTLE_BUFFER_MIN) return 2;

    return 1;
  }, [show.is_settled, show.schedule_entries, nowMin]);
}
