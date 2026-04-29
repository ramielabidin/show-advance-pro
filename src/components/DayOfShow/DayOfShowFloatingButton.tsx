import { useState } from "react";
import { Mic } from "lucide-react";
import DayOfShowMode from "@/components/DayOfShow/DayOfShowMode";

interface DayOfShowFloatingButtonProps {
  showId: string;
}

/**
 * Mobile-only fixed pill at the bottom-right that launches Day of Show Mode.
 * Owns its own open state. Mounts only when caller decides there's a show
 * "today" — see DashboardPage's showToday logic.
 */
export default function DayOfShowFloatingButton({ showId }: DayOfShowFloatingButtonProps) {
  const [open, setOpen] = useState(false);

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
        aria-label="Enter Day of Show Mode"
        className="md:hidden fixed bottom-20 right-4 z-40 day-of-active-pulse inline-flex items-center gap-2 h-11 pl-2 pr-4 rounded-full bg-[hsl(var(--day-of-active))] text-white [transition:transform_160ms_var(--ease-out)] active:scale-[0.97]"
        style={{
          marginBottom: "max(0px, env(safe-area-inset-bottom, 0px))",
          boxShadow:
            "0 10px 28px -8px hsl(var(--day-of-active) / 0.55), 0 2px 6px -1px hsl(var(--day-of-active) / 0.35)",
        }}
      >
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
          <Mic className="h-4 w-4" strokeWidth={2.4} />
        </span>
        <span className="text-sm font-medium tracking-tight">Day of Show</span>
      </button>
      {open && <DayOfShowMode showId={showId} onClose={() => setOpen(false)} />}
    </>
  );
}
