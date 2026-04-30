import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Show } from "@/lib/types";
import { useNowMinutes } from "@/hooks/useNowMinutes";
import { useDayOfShowPhase } from "@/hooks/useDayOfShowPhase";
import { useTeam } from "@/components/TeamProvider";
import PhasePreShow from "./PhasePreShow";
import PhaseSettle from "./PhaseSettle";
import PhasePostSettle from "./PhasePostSettle";

interface DayOfShowModeProps {
  showId: string;
  onClose: () => void;
}

// Swipe-down dismissal thresholds. Either condition fires dismiss:
//   1. Drag distance past SWIPE_DISMISS_DISTANCE (slow but committed)
//   2. Velocity > SWIPE_DISMISS_VELOCITY after a min 40px (quick flick)
// Tuned to feel like Vaul / iOS sheet — easy to dismiss but not so easy
// you trigger it accidentally on a tap.
const SWIPE_DISMISS_DISTANCE = 120;
const SWIPE_DISMISS_VELOCITY = 0.5; // px / ms
const SWIPE_TRANSITION_MS = 300;
// Drag distance over which the "lifting" affordances (scale + corner radius)
// reach their full value. After this point further drag just translates.
const SWIPE_LIFT_RANGE = 240;

/**
 * Walk up from a touched element to find the nearest scrollable ancestor
 * (excluding the overlay root itself). We use this to decide whether a
 * downward swipe should dismiss the overlay or be deferred to native
 * scroll — if the user grabs inside a list that's scrolled past the top,
 * we want their finger to scroll the list, not dismiss.
 */
function findScrollableAncestor(
  target: HTMLElement,
  root: HTMLElement,
): HTMLElement | null {
  let cur: HTMLElement | null = target;
  while (cur && cur !== root) {
    if (cur.scrollHeight > cur.clientHeight) {
      const overflowY = window.getComputedStyle(cur).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") return cur;
    }
    cur = cur.parentElement;
  }
  return null;
}

/**
 * Full-screen overlay that takes over the viewport when the user enters Day
 * of Show Mode. Top chrome is a centered chevron-down (tap to dismiss); the
 * body swaps between three phase surfaces, deriving phase from `show + now`.
 *
 *   Phase 1 — Pre-show
 *   Phase 2 — Settle (auto-promotes 90 min after band's set time)
 *   Phase 3 — Post-settle hotel reveal (when `is_settled = true`)
 *
 * Phase swap uses a keyed remount + the `phase-morph` CSS animation so
 * content fades between phases in place, no hard cuts.
 *
 * Dismissal: tap the chevron, press Escape, or swipe the overlay down.
 * The swipe handler tracks pointerdown→up at the overlay level and walks
 * up from the touched element to find the nearest scrollable ancestor; if
 * that ancestor has scrolled past the top, native scroll wins (iOS sheet
 * rule). Otherwise the overlay translates 1:1 with the finger and the top
 * corners round to read as a sheet being lifted away. Release with > 120px
 * traveled OR > 0.5 px/ms velocity dismisses; otherwise the overlay springs
 * back. Components can opt out of the gesture with `data-no-dismiss-drag`.
 * Reduced-motion users get instant dismiss / snap-back without transitions.
 *
 * Fetches the full show by ID on mount so we get show_contacts (the
 * dashboard's list query doesn't include them — joining show_contacts on
 * every dashboard load would be needlessly expensive for a one-show-a-day
 * feature).
 */
export default function DayOfShowMode({ showId, onClose }: DayOfShowModeProps) {
  const nowMin = useNowMinutes();
  const queryClient = useQueryClient();

  const { data: show } = useQuery<Show>({
    queryKey: ["show", showId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shows")
        .select("*, schedule_entries(*), show_contacts(*)")
        .eq("id", showId)
        .single();
      if (error) throw error;
      return data as Show;
    },
  });

  // Lock body scroll while the overlay is mounted, and close on ESC.
  // On close, invalidate the shows list so the dashboard refreshes and shows
  // the next show if the current show was just settled.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      // Invalidate shows list on close so dashboard updates if show was settled
      queryClient.invalidateQueries({ queryKey: ["shows"] });
    };
  }, [onClose, queryClient]);

  // Swipe-down state. dragY drives the overlay's translateY; releasing
  // toggles the easing (off during drag for 1:1 finger tracking; on
  // during settle/dismiss). dragStateRef tracks the active pointer so
  // multi-touch and stray pointers don't confuse the gesture. The
  // captured `scrollable` is the inner scroll container (if any) the
  // user grabbed — we re-check its scrollTop mid-gesture to abort if
  // the user starts scrolling the list instead.
  const [dragY, setDragY] = useState(0);
  const [releasing, setReleasing] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragStateRef = useRef<{
    startY: number;
    startTime: number;
    pointerId: number;
    scrollable: HTMLElement | null;
  } | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const startSwipe = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dismissing) return;
    // Don't intercept taps/drags on interactive controls. Any element opting
    // out of the dismiss gesture (e.g. the slide-to-settle slider in Phase 2,
    // a future slider/draggable card) can mark itself with
    // `data-no-dismiss-drag` to be excluded without changing this list.
    const target = e.target as HTMLElement;
    if (
      target.closest(
        "button, a, input, textarea, select, [role='button'], [role='slider'], [data-no-dismiss-drag]",
      )
    ) {
      return;
    }
    // Single-touch only — ignore additional pointers mid-gesture.
    if (dragStateRef.current) return;
    if (!overlayRef.current) return;
    // Walk up to the first scrollable ancestor. If the user grabbed inside
    // a list that's scrolled past the top, defer to native scroll — they're
    // trying to read, not dismiss. This is the iOS sheet rule.
    const scrollable = findScrollableAncestor(target, overlayRef.current);
    if (scrollable && scrollable.scrollTop > 0) return;
    dragStateRef.current = {
      startY: e.clientY,
      startTime: performance.now(),
      pointerId: e.pointerId,
      scrollable,
    };
    setReleasing(false);
    overlayRef.current.setPointerCapture(e.pointerId);
  };

  const continueSwipe = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = dragStateRef.current;
    if (!state || state.pointerId !== e.pointerId) return;
    const delta = e.clientY - state.startY;
    // Upward drag past a small jitter threshold → abort. The body
    // already has overscroll-behavior: contain, so the bounce is
    // suppressed; we just stop translating the overlay so the user
    // feels they're scrolling content, not pulling the sheet.
    if (delta < -10) {
      cancelSwipe();
      return;
    }
    // If the originally-grabbed scrollable started scrolling mid-gesture,
    // abort — the user pivoted to reading the list.
    if (state.scrollable && state.scrollable.scrollTop > 0) {
      cancelSwipe();
      return;
    }
    if (!dragging) setDragging(true);
    setDragY(Math.max(0, delta));
  };

  const endSwipe = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = dragStateRef.current;
    if (!state || state.pointerId !== e.pointerId) return;
    dragStateRef.current = null;
    const elapsed = performance.now() - state.startTime;
    const distance = e.clientY - state.startY;
    const velocity = distance / Math.max(elapsed, 1);

    const shouldDismiss =
      distance > SWIPE_DISMISS_DISTANCE ||
      (distance > 40 && velocity > SWIPE_DISMISS_VELOCITY);

    setDragging(false);

    if (shouldDismiss) {
      if (reducedMotion) {
        onClose();
        return;
      }
      setReleasing(true);
      setDismissing(true);
      setDragY(window.innerHeight);
      window.setTimeout(() => onClose(), SWIPE_TRANSITION_MS + 40);
    } else {
      setReleasing(true);
      setDragY(0);
    }
  };

  const cancelSwipe = () => {
    dragStateRef.current = null;
    setDragging(false);
    setReleasing(true);
    setDragY(0);
  };

  const transitionProps = ["transform", "border-radius", "background-color"];
  const transitionStyle =
    releasing && !reducedMotion
      ? transitionProps
          .map((p) => `${p} ${SWIPE_TRANSITION_MS}ms var(--ease-out)`)
          .join(", ")
      : "none";

  // Visual lift: as the user drags, round the top corners and tint the
  // chrome slightly darker. Subtle but enough to read as "this surface is
  // being pulled away" rather than just translating off-screen.
  const liftProgress = Math.min(1, dragY / SWIPE_LIFT_RANGE);
  const liftRadius = liftProgress * 18;

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Day of Show"
      className="fixed inset-0 z-[60] flex flex-col overflow-hidden animate-in fade-in"
      style={{
        background: "hsl(var(--background))",
        transform: `translateY(${dragY}px)`,
        transition: transitionStyle,
        willChange: "transform, border-radius",
        // Round the top corners as the user drags, so the surface reads
        // as a sheet being pulled away rather than the whole page sliding.
        borderTopLeftRadius: liftRadius,
        borderTopRightRadius: liftRadius,
        // pan-y lets iOS know we want vertical pan gestures; during an
        // active drag we lock to `none` so native scroll on inner regions
        // (or rubberband) doesn't fight the dismiss translation.
        touchAction: dragging ? "none" : "pan-y",
      }}
      onPointerDown={startSwipe}
      onPointerMove={continueSwipe}
      onPointerUp={endSwipe}
      onPointerCancel={endSwipe}
    >
      {/* Top chrome — chevron-down button. Tap dismisses; drag-down
          from anywhere on the overlay also dismisses (iOS sheet
          pattern, see startSwipe / continueSwipe / endSwipe above). */}
      <div className="safe-area-top pt-1 flex justify-center">
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss Day of Show"
          className="inline-flex items-center justify-center px-8 py-3 [transition:transform_160ms_var(--ease-out)] active:scale-[0.92]"
        >
          <ChevronDown
            className="h-5 w-5"
            strokeWidth={2}
            style={{ color: "hsl(var(--muted-foreground))" }}
          />
        </button>
      </div>

      {/* Body — overscroll-contain so swipe-up-then-down doesn't bubble to the
          dashboard pull-to-refresh underneath. While a dismiss drag is in
          flight we also pin the body's overflow so iOS can't run a scroll
          in parallel with our translate. */}
      <div
        className="flex-1 flex flex-col"
        style={{
          overflowY: dragging ? "hidden" : "auto",
          overscrollBehavior: "contain",
        }}
      >
        {show ? (
          <PhaseBody show={show} nowMin={nowMin} onClose={onClose} />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}

/** Inner body — derives the phase and renders the matching surface, keyed so
 *  React remounts on phase change and our `phase-morph` CSS animation runs.
 *  Artists skip Phase 2 (Settle) and land on Phase 3 once the same time-based
 *  trigger fires — see `useDayOfShowPhase`. */
function PhaseBody({ show, nowMin, onClose }: { show: Show; nowMin: number; onClose: () => void }) {
  const { isArtist } = useTeam();
  const phase = useDayOfShowPhase(show, nowMin, isArtist);
  return (
    <div key={phase} className="phase-morph flex-1 flex flex-col">
      {phase === 1 && <PhasePreShow show={show} nowMin={nowMin} />}
      {phase === 2 && <PhaseSettle show={show} />}
      {phase === 3 && <PhasePostSettle show={show} onShowDone={onClose} />}
    </div>
  );
}
