import { useCallback, useEffect, useRef, useState } from "react";

/** Visual px at which releasing triggers a refresh. */
const THRESHOLD = 52;

/**
 * Rubber-band resistance: the indicator moves quickly at first and
 * increasingly resists the further the user pulls.
 * Approaches ~MAX_VISUAL asymptotically — never quite reaches it.
 */
const MAX_VISUAL = 72;
function resist(rawDelta: number): number {
  return (rawDelta * MAX_VISUAL) / (rawDelta + MAX_VISUAL * 1.4);
}

export interface PullToRefreshState {
  /** Current visual pull distance in px (0 when idle). */
  pullY: number;
  /** True while the onRefresh promise is pending. */
  isRefreshing: boolean;
  /** True during the spring snap-back animation after release. */
  isReleasing: boolean;
  /** The visual threshold in px (pullY must reach this to trigger). */
  threshold: number;
}

export function usePullToRefresh(
  onRefresh: () => Promise<void>
): PullToRefreshState {
  const [pullY, setPullY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);

  // Refs hold the live values that event handlers need to read.
  // Using refs avoids stale-closure bugs and keeps deps arrays empty.
  const startYRef = useRef(0);
  const pullYRef = useRef(0);
  const isPullingRef = useRef(false);
  const isRefreshingRef = useRef(false);
  // Always-current copy of the callback so handlers never go stale.
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    // Only engage when the page is already scrolled to the very top.
    if (isRefreshingRef.current || window.scrollY > 0) return;
    startYRef.current = e.touches[0].clientY;
    isPullingRef.current = false;
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (isRefreshingRef.current) return;

    const raw = e.touches[0].clientY - startYRef.current;

    if (raw <= 0) {
      // User reversed direction — cancel the pull.
      if (isPullingRef.current) {
        isPullingRef.current = false;
        pullYRef.current = 0;
        setPullY(0);
      }
      return;
    }

    // Don't start a pull if the page has scrolled since touchstart.
    if (window.scrollY > 0 && !isPullingRef.current) return;

    isPullingRef.current = true;
    // Prevent the browser from scrolling / bouncing while we're intercepting.
    e.preventDefault();

    const visual = resist(raw);
    pullYRef.current = visual;
    setPullY(visual);
  }, []);

  const handleTouchEnd = useCallback(async () => {
    if (!isPullingRef.current) return;
    isPullingRef.current = false;

    const y = pullYRef.current;
    pullYRef.current = 0;

    if (y >= THRESHOLD) {
      // Threshold met: hold the indicator in place and trigger refresh.
      isRefreshingRef.current = true;
      setIsRefreshing(true);
      setIsReleasing(false);
      setPullY(THRESHOLD);
      try {
        await onRefreshRef.current();
      } finally {
        isRefreshingRef.current = false;
        setIsRefreshing(false);
        setIsReleasing(true);
        setPullY(0);
        // Give the spring animation time to complete before removing it.
        setTimeout(() => setIsReleasing(false), 420);
      }
    } else {
      // Threshold not met: spring back without refreshing.
      setIsReleasing(true);
      setPullY(0);
      setTimeout(() => setIsReleasing(false), 380);
    }
  }, []);

  useEffect(() => {
    // Pull-to-refresh is a touch-only, mobile interaction.
    if (!("ontouchstart" in window)) return;

    document.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    // passive: false is required so we can call e.preventDefault() and
    // stop the native scroll/bounce while the user is pulling.
    document.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { pullY, isRefreshing, isReleasing, threshold: THRESHOLD };
}
