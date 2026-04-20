import { type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { cn } from "@/lib/utils";

/**
 * Height of the mobile sticky header (h-12 = 48px).
 * The indicator is anchored just below this so it slides in from underneath.
 */
const MOBILE_HEADER_HEIGHT = 48;

/**
 * How far above the anchor point the indicator starts (fully hidden).
 * indicator circle (32px) + 10px breathing room = 42px.
 */
const INDICATOR_OFFSET = 42;

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
}

/**
 * Wraps page content with iOS-style pull-to-refresh behaviour.
 * The animated indicator is rendered as a fixed overlay so it
 * never disturbs the page layout.
 *
 * Only activates on touch devices and is visually hidden on md+.
 */
export default function PullToRefresh({
  onRefresh,
  children,
}: PullToRefreshProps) {
  const { pullY, isRefreshing, isReleasing, threshold } =
    usePullToRefresh(onRefresh);

  // True during any animated transition (release snap-back or refresh hold).
  const isTransitioning = isReleasing || isRefreshing;

  // Progress 0→1 as the user pulls toward the threshold.
  const progress = Math.min(pullY / threshold, 1);

  // Indicator slides up from below the header line.
  // translateY(-INDICATOR_OFFSET) = fully hidden above the anchor.
  // translateY(0) = indicator bottom is flush with the header bottom.
  // translateY(+n) = n px below the header — the comfortable reading zone.
  const translateY = pullY - INDICATOR_OFFSET;

  // Only show when there is meaningful pull or an active refresh.
  const visible = pullY > 2 || isRefreshing;

  return (
    <>
      {/*
       * Fixed indicator — sits just below the sticky mobile header.
       * pointer-events-none so it never blocks taps on the content below.
       * md:hidden so it is invisible (and zero-cost) on desktop.
       */}
      <div
        aria-hidden
        className="fixed left-0 right-0 flex justify-center pointer-events-none z-40 md:hidden"
        style={{
          top: MOBILE_HEADER_HEIGHT,
          transform: `translateY(${translateY}px)`,
          opacity: visible ? 1 : 0,
          // Spring easing gives the "snap into place" feel native iOS has.
          transition: isTransitioning
            ? "transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 200ms ease"
            : "opacity 120ms ease",
        }}
      >
        <div
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded-full",
            "bg-background border border-border",
            // Shadow grows when the indicator is fully out — subtle depth cue.
            progress >= 1 || isRefreshing ? "shadow-md" : "shadow-sm",
            "[transition:box-shadow_200ms_var(--ease-out)]"
          )}
        >
          <RefreshCw
            className={cn(
              "h-3.5 w-3.5 [transition:color_150ms_var(--ease-out)]",
              // Icon brightens once the threshold is reached.
              progress >= 1 || isRefreshing
                ? "text-foreground"
                : "text-muted-foreground",
              // Continuous spin while data is loading.
              isRefreshing && "animate-spin"
            )}
            style={
              isRefreshing
                ? undefined
                : {
                    // Rotate 0→240° as the user pulls to threshold,
                    // giving tactile feedback about how far they've gone.
                    transform: `rotate(${progress * 240}deg)`,
                    transition: "none",
                  }
            }
          />
        </div>
      </div>

      {children}
    </>
  );
}
