import { useEffect, useRef, useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Show } from "@/lib/types";
import HotelReveal from "./HotelReveal";

/**
 * Pool of sign-offs picked deterministically by show date so the same
 * show always shows the same line (stable across re-opens) but the
 * line varies day-to-day across a tour.
 */
const SIGN_OFFS = [
  "Good night.",
  "Sleep well.",
  "Until tomorrow.",
  "Rest up.",
  "See you in the morning.",
  "Until the next one.",
];

function signOffFor(date: string | null | undefined): string {
  if (!date || typeof date !== "string") return "See you soon.";
  const seed = date.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return SIGN_OFFS[seed % SIGN_OFFS.length];
}

interface PhasePostSettleProps {
  show: Show;
  onShowDone?: () => void;
}

/**
 * Phase 3 — settled. Branches into:
 *
 *   3a (celebration) — runs once, on first open after settle. Persists
 *      `dos_closed_at` on mount so subsequent opens land on 3b. Auto-
 *      plays a ~3.6s sequence (check draws, holds, fades; "Good job."
 *      rises, lingers, fades). Tap-anywhere skips to dismiss.
 *
 *   3b (hotel reveal) — runs on every subsequent open. Centered hotel
 *      card with conditional Maps + Call chips, then the line footer.
 *
 * The branch is captured ONCE at first render via useState(() => ...)
 * so a successful mutation that updates `dos_closed_at` mid-sequence
 * can't swap the surface to 3b while the celebration is still playing.
 *
 * Degenerate case: if there's no hotel name, both 3a (after dismiss)
 * and 3b would have nothing to show. Phase 3a still plays normally.
 * Phase 3b in the no-hotel case renders just the line footer.
 */
export default function PhasePostSettle({ show, onShowDone }: PhasePostSettleProps) {
  // Capture the closed state at mount time so subsequent re-fetches
  // (e.g. the mutation success cache invalidation) don't swap the
  // surface mid-celebration.
  const [wasClosedAtMount] = useState(() => !!show.dos_closed_at);

  if (!wasClosedAtMount) {
    return <Phase3aCelebration show={show} onDone={onShowDone ?? (() => {})} />;
  }

  return (
    <div className="px-[22px] pt-2 pb-7 flex-1 flex flex-col">
      {show.hotel_name ? <HotelReveal show={show} /> : <div className="flex-1" />}
      <div className="dos-phase-footer">{signOffFor(show.date)}</div>
    </div>
  );
}

// ─── Phase 3a — celebration (auto-played, ~3.6s) ────────────────

const T_CELEBRATION = {
  checkDrawEnd:   880,
  checkHoldBeat:  500,
  checkFadeOut:   360,
  goodJobIn:      320,
  goodJobLinger: 1100,
  goodJobFadeOut: 460,
} as const;
const T_CHECK_GONE   = T_CELEBRATION.checkDrawEnd + T_CELEBRATION.checkHoldBeat + T_CELEBRATION.checkFadeOut;
const T_GOODJOB_PEAK = T_CHECK_GONE + T_CELEBRATION.goodJobIn;
const T_GOODJOB_FADE = T_GOODJOB_PEAK + T_CELEBRATION.goodJobLinger;
const T_DISMISS      = T_GOODJOB_FADE + T_CELEBRATION.goodJobFadeOut;

function Phase3aCelebration({ show, onDone }: { show: Show; onDone: () => void }) {
  const [checkFading, setCheckFading] = useState(false);
  const [goodJobShow, setGoodJobShow] = useState(false);
  const [goodJobFading, setGoodJobFading] = useState(false);

  const skippedRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // Persist dos_closed_at on first mount. Optimistic update writes
  // the timestamp into the cached show immediately so any subsequent
  // refetch sees the closed state. Failures are logged but don't
  // roll the UI back — re-running the celebration on a later open
  // is a worse outcome than dropping a single network hit.
  const queryClient = useQueryClient();
  const closeMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("shows")
        .update({ dos_closed_at: new Date().toISOString() })
        .eq("id", show.id)
        .is("dos_closed_at", null);
      if (error) throw error;
    },
    onMutate: async () => {
      const key = ["show", show.id];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Show>(key);
      if (previous) {
        queryClient.setQueryData<Show>(key, {
          ...previous,
          dos_closed_at: new Date().toISOString(),
        });
      }
      return { previous };
    },
    onError: (err) => {
      // No rollback — see comment above.
      console.warn("dos_closed_at persistence failed", err);
    },
  });

  // Fire the mutation exactly once on mount.
  const closedRef = useRef(false);
  useEffect(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    closeMutation.mutate();
    // We intentionally don't list closeMutation in deps — it's stable
    // for the lifetime of this component, and listing it would risk
    // re-running the effect on a re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Run the celebration timeline.
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    timers.push(setTimeout(() => {
      if (skippedRef.current) return;
      setCheckFading(true);
    }, T_CELEBRATION.checkDrawEnd + T_CELEBRATION.checkHoldBeat));

    timers.push(setTimeout(() => {
      if (skippedRef.current) return;
      setGoodJobShow(true);
    }, T_CHECK_GONE));

    timers.push(setTimeout(() => {
      if (skippedRef.current) return;
      setGoodJobShow(false);
      setGoodJobFading(true);
    }, T_GOODJOB_FADE));

    timers.push(setTimeout(() => {
      if (skippedRef.current) return;
      onDoneRef.current();
    }, T_DISMISS));

    return () => {
      timers.forEach(clearTimeout);
    };
  }, []);

  const skip = useCallback(() => {
    if (skippedRef.current) return;
    skippedRef.current = true;
    setCheckFading(true);
    setGoodJobShow(false);
    setGoodJobFading(true);
    window.setTimeout(() => onDoneRef.current(), T_CELEBRATION.goodJobFadeOut);
  }, []);

  return (
    <div
      className="px-[22px] pt-2 pb-7 flex-1 flex flex-col"
      onClick={skip}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          skip();
        }
      }}
      aria-label="Tap to dismiss"
    >
      <div className="flex-1 flex items-center justify-center">
        <div className="relative flex flex-col items-center">
          <div className={`dos-check-mark${checkFading ? " fading" : ""}`}>
            <svg viewBox="0 0 72 72" width="96" height="96" className="block overflow-visible">
              <path className="check-stroke" d="M 19 38 L 31 50 L 55 24" />
            </svg>
          </div>
          <div
            className={`dos-good-job${goodJobShow ? " show" : ""}${goodJobFading ? " fading" : ""}`}
            style={{ top: 28 }}
          >
            Good job.
          </div>
        </div>
      </div>

      <div className="dos-phase-footer">{signOffFor(show.date)}</div>
    </div>
  );
}
