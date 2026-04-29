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
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Enter Day of Show Mode"
        className="md:hidden fixed bottom-20 right-4 z-40 day-of-active-pulse inline-flex items-center gap-2 h-11 pl-3 pr-4 rounded-full bg-background border border-[hsl(var(--day-of-active))]/40 text-[hsl(var(--day-of-active))] shadow-lg [transition:transform_160ms_var(--ease-out)] active:scale-[0.97]"
        style={{
          paddingBottom: "max(0px, env(safe-area-inset-bottom, 0px))",
        }}
      >
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-full"
          style={{ backgroundColor: "hsl(var(--day-of-active) / 0.15)" }}
        >
          <Mic className="h-4 w-4" strokeWidth={2.4} />
        </span>
        <span className="text-sm font-medium tracking-tight">Day of Show</span>
      </button>
      {open && <DayOfShowMode showId={showId} onClose={() => setOpen(false)} />}
    </>
  );
}
