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
          (z-50). Spans the full bottom 128px of the viewport, fading from
          transparent up top to solid background by the bottom 30%. */}
      <div
        aria-hidden
        className="md:hidden pointer-events-none fixed bottom-0 left-0 right-0 h-32 z-30"
        style={{
          background:
            "linear-gradient(to top, hsl(var(--background)) 30%, hsl(var(--background) / 0))",
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
