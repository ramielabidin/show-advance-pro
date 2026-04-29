import { useEffect, useRef, useState } from "react";
import type { Show } from "@/lib/types";

/**
 * Lead-in copy as a confident, time-aware statement. Each variant is
 * a self-contained line that names the moment without instructing the
 * user — the screen below speaks for itself, so the lead-in doesn't
 * need a "go to bed / drive safe" branch. Avoids "safe" doubling.
 *
 * Buckets:
 *   pre-midnight (9 PM–11:59 PM): "That's the show."
 *   post-midnight (00:00–02:59):  "That's a long one."
 *   pre-dawn (03:00–04:59):       "Almost dawn."
 *   morning (05:00–07:59, rare):  "Show's in the books."
 *
 * (After 8 AM the overlay auto-resolves itself.)
 */
function leadInCopy(nowHour: number): string {
  if (nowHour >= 5 && nowHour < 8) return "Show's in the books.";
  if (nowHour >= 3 && nowHour < 5) return "Almost dawn.";
  if (nowHour < 3) return "That's a long one.";
  return "That's the show.";
}

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
 * Phase 3 — settled. Intentionally minimal: a confident time-aware
 * lead-in at top, a delicate hand-drawn done-mark filling the middle,
 * and a sign-off pinned to the bottom. The hotel reveal that used to
 * live here was redundant — Phase 2 already shows a hotel teaser, and
 * the show detail page has the full booking. Phase 3 is for closing
 * the moment, not surfacing more data.
 *
 * The done-mark is interactive: hold to complete. Holding fills a circle
 * around the checkmark over ~1.5s. On release, the checkmark fills in
 * (satisfying completion animation), then the phase closes.
 */
export default function PhasePostSettle({ show, onShowDone }: PhasePostSettleProps) {
  return (
    <div className="px-[22px] pt-2 pb-7 flex-1 flex flex-col">
      {/* Lead-in — big display statement that names the moment. Clamps
          38–52px, wraps via textWrap: balance for clean two-line breaks. */}
      <div className="pt-[14px] pb-3">
        <div
          className="font-display"
          style={{
            fontSize: "clamp(38px, 11vw, 52px)",
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            color: "hsl(var(--foreground))",
            textWrap: "balance",
          }}
        >
          {leadInCopy(new Date().getHours())}
        </div>
      </div>

      {/* Done-mark — the closing flourish. Centered in the middle of the
          available space, sized to feel substantial but not loud. The
          three-part animation (ring stroke → check stroke → tiny serif
          punctuation dot) sequences ~1.5s on phase entry. Interactive:
          hold to complete. */}
      <div className="flex-1 flex items-center justify-center py-6">
        <DoneMark onComplete={onShowDone} />
      </div>

      {/* Sign-off — pinned to the bottom. Pool varies by show date so
          the line changes day-to-day across a tour without ever feeling
          random within a single show's repeat opens. */}
      <div className="text-center">
        <div
          className="font-display gentle-breathe"
          style={{
            fontSize: 22,
            lineHeight: 1.2,
            letterSpacing: "-0.02em",
            color: "hsl(var(--foreground))",
          }}
        >
          {signOffFor(show.date)}
        </div>
      </div>
    </div>
  );
}

/**
 * Interactive done-mark. Hold to complete. Holding fills the circle around
 * the checkmark over ~1.5s. On release/completion, the checkmark fills in
 * (satisfying solid fill animation), then triggers onComplete callback.
 *
 * Initial animation: ring + check + dot draw in sequence (~1.5s total).
 * Hold interaction: circle fills from 0→100% over 1500ms with linear timing.
 * Completion: checkmark transitions to solid fill, then fades with sign-off.
 */
function DoneMark({ onComplete }: { onComplete?: () => void }) {
  const [isHolding, setIsHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const holdStartRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const HOLD_DURATION = 1500; // ms

  const startHold = () => {
    if (isCompleted) return;
    setIsHolding(true);
    holdStartRef.current = performance.now();

    const updateProgress = () => {
      if (!holdStartRef.current) return;
      const elapsed = performance.now() - holdStartRef.current;
      const progress = Math.min(elapsed / HOLD_DURATION, 1);
      setHoldProgress(progress);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(updateProgress);
      } else {
        endHold(true);
      }
    };

    animationFrameRef.current = requestAnimationFrame(updateProgress);
  };

  const endHold = (completed: boolean) => {
    setIsHolding(false);
    holdStartRef.current = null;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    if (completed) {
      setIsCompleted(true);
      // Trigger phase close after completion animation (~600ms)
      holdTimerRef.current = setTimeout(() => {
        onComplete?.();
      }, 600);
    } else {
      setHoldProgress(0);
    }
  };

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  return (
    <button
      type="button"
      onPointerDown={startHold}
      onPointerUp={() => endHold(false)}
      onPointerLeave={() => endHold(false)}
      onPointerCancel={() => endHold(false)}
      disabled={isCompleted}
      className="done-mark relative cursor-pointer [transition:opacity_600ms_var(--ease-out)] disabled:cursor-default"
      style={{
        width: 96,
        height: 96,
        opacity: isCompleted ? 0 : 1,
      }}
      aria-label="Hold to complete the show"
      aria-valuenow={Math.round(holdProgress * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      role="progressbar"
    >
      <svg viewBox="0 0 72 72" width={96} height={96} className="block">
        {/* Outer circle for hold fill progress (appears on hold) */}
        {holdProgress > 0 && (
          <circle
            cx="36"
            cy="36"
            r="32"
            fill="none"
            stroke="hsl(var(--foreground) / 0.3)"
            strokeWidth="2"
            strokeDasharray={`${(holdProgress * 201).toFixed(1)} 201`}
            strokeLinecap="round"
            style={{
              transformOrigin: "36px 36px",
              transform: "rotate(-90deg)",
            }}
          />
        )}

        {/* Base circle (entrance animation) */}
        <circle
          className="done-circle"
          cx="36"
          cy="36"
          r="32"
          fill="none"
          stroke="hsl(var(--muted-foreground) / 0.55)"
          strokeWidth="1"
        />

        {/* Checkmark — fills on completion */}
        <path
          className={`done-check ${isCompleted ? "done-check-completed" : ""}`}
          d="M 23 37 L 33 47 L 51 27"
          fill="none"
          stroke="hsl(var(--foreground))"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Serif punctuation dot */}
        <circle
          className="done-dot"
          cx="56"
          cy="20"
          r="1.4"
          fill="hsl(var(--foreground))"
        />
      </svg>
    </button>
  );
}
