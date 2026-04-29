import { useEffect, useState } from "react";
import { Mic } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DayOfShowMode from "@/components/DayOfShow/DayOfShowMode";

interface DayOfShowFloatingButtonProps {
  showId: string;
}

/**
 * Mobile-only fixed pill at the bottom-right that launches Day of Show Mode.
 * Owns its own open state. Mounts only when caller decides there's a show
 * "today" — see DashboardPage's showToday logic.
 *
 * After settling (is_settled = true), the pill transitions from active state
 * ("Day of Show" text + full width) to dormant state (mic icon only, smaller).
 * Dormant state can be clicked to show hotel info (future implementation).
 */
export default function DayOfShowFloatingButton({ showId }: DayOfShowFloatingButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPoweredDown, setIsPoweredDown] = useState(false);
  const [isFlickering, setIsFlickering] = useState(false);

  const { data: show } = useQuery({
    queryKey: ["show", showId, "settled-only"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shows")
        .select("id, is_settled")
        .eq("id", showId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // When the show is settled, transition to powered-down state with flicker animation
  useEffect(() => {
    if (show?.is_settled && !isPoweredDown) {
      setIsPoweredDown(true);
      // Start flicker animation 100ms after power-down transition begins
      setTimeout(() => setIsFlickering(true), 100);
    }
  }, [show?.is_settled, isPoweredDown]);

  const handleShowClose = () => {
    setOpen(false);
    // Mark the show as settled (this happens on the server, but we optimistically
    // trigger the power-down animation locally)
  };

  return (
    <>
      {/* Bottom scroll-edge fade — keeps the pill on a clean canvas as
          upcoming-show cards scroll past it. Mobile-only; sits below the
          pill (z-30) and above page content, beneath the bottom tab bar
          (z-50). Uses an easing-gradient (many stops following an ease-out
          curve) instead of a plain linear-gradient so the dissolve has no
          visible "edge" where the fade tapers off — the eye reads it as a
          natural falloff into the page background, the way fog dissolves
          rather than a sheet of vellum. */}
      <div
        aria-hidden
        className="md:hidden pointer-events-none fixed bottom-0 left-0 right-0 h-32 z-30"
        style={{
          background: `linear-gradient(
            to top,
            hsl(var(--background) / 1) 0%,
            hsl(var(--background) / 0.987) 8.1%,
            hsl(var(--background) / 0.951) 15.5%,
            hsl(var(--background) / 0.896) 22.5%,
            hsl(var(--background) / 0.825) 29%,
            hsl(var(--background) / 0.741) 35.3%,
            hsl(var(--background) / 0.648) 41.2%,
            hsl(var(--background) / 0.55) 47.1%,
            hsl(var(--background) / 0.45) 52.9%,
            hsl(var(--background) / 0.352) 58.8%,
            hsl(var(--background) / 0.259) 64.7%,
            hsl(var(--background) / 0.175) 71%,
            hsl(var(--background) / 0.104) 77.5%,
            hsl(var(--background) / 0.049) 84.5%,
            hsl(var(--background) / 0.013) 91.9%,
            hsl(var(--background) / 0) 100%
          )`,
        }}
      />
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={isPoweredDown ? "Show hotel info" : "Enter Day of Show Mode"}
        className={`md:hidden fixed bottom-20 right-4 z-40 inline-flex items-center justify-center text-white transition-all ${
          isPoweredDown
            ? "h-10 w-10 rounded-full bg-[hsl(var(--day-of-active)/0.4)]"
            : "day-of-active-pulse h-11 gap-2 pl-2 pr-4 rounded-full bg-[hsl(var(--day-of-active))]"
        } [transition:transform_160ms_var(--ease-out),all_800ms_var(--ease-out)] active:scale-[0.97]`}
        style={{
          marginBottom: "max(0px, env(safe-area-inset-bottom, 0px))",
          boxShadow: isPoweredDown
            ? "none"
            : "0 10px 28px -8px hsl(var(--day-of-active) / 0.55), 0 2px 6px -1px hsl(var(--day-of-active) / 0.35)",
        }}
      >
        <span
          className={`inline-flex items-center justify-center ${isPoweredDown ? "h-6 w-6" : "h-7 w-7 rounded-full bg-white/20"} ${isFlickering ? "pill-powerdown-flicker" : ""}`}
        >
          <Mic className={isPoweredDown ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={2.4} />
        </span>
        {!isPoweredDown && (
          <span className="text-sm font-medium tracking-tight">Day of Show</span>
        )}
      </button>
      {open && <DayOfShowMode showId={showId} onClose={handleShowClose} />}
    </>
  );
}
