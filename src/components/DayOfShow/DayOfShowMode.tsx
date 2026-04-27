import { useEffect } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
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

/**
 * Full-screen overlay that takes over the viewport when the user enters Day
 * of Show Mode. Top chrome is shared across phases (just an X dismiss); the
 * body swaps between three phase surfaces, deriving phase from `show + now`.
 *
 *   Phase 1 — Pre-show
 *   Phase 2 — Settle (auto-promotes 90 min after band's set time)
 *   Phase 3 — Post-settle hotel reveal (when `is_settled = true`)
 *
 * Phase swap uses a keyed remount + the `phase-morph` CSS animation so
 * content fades between phases in place, no hard cuts.
 *
 * Fetches the full show by ID on mount so we get show_contacts (the
 * dashboard's list query doesn't include them — joining show_contacts on
 * every dashboard load would be needlessly expensive for a one-show-a-day
 * feature).
 */
export default function DayOfShowMode({ showId, onClose }: DayOfShowModeProps) {
  const nowMin = useNowMinutes();

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
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Day of Show"
      className="fixed inset-0 z-[60] flex flex-col overflow-hidden animate-in fade-in"
      style={{ background: "hsl(var(--background))" }}
    >
      {/* Top chrome — centered chevron-down as the dismiss affordance.
          Reads as "this is a sheet you can pull down" (iOS pattern) without
          the heavy chrome of a corner X button. Swipe-to-dismiss is a polish
          follow-up; for now tap dismisses, ESC also dismisses for keyboard. */}
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
          dashboard pull-to-refresh underneath. */}
      <div
        className="flex-1 overflow-auto flex flex-col"
        style={{ overscrollBehavior: "contain" }}
      >
        {show ? (
          <PhaseBody show={show} nowMin={nowMin} />
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
function PhaseBody({ show, nowMin }: { show: Show; nowMin: number }) {
  const { isArtist } = useTeam();
  const phase = useDayOfShowPhase(show, nowMin, isArtist);
  return (
    <div key={phase} className="phase-morph flex-1 flex flex-col">
      {phase === 1 && <PhasePreShow show={show} nowMin={nowMin} />}
      {phase === 2 && <PhaseSettle show={show} />}
      {phase === 3 && <PhasePostSettle show={show} />}
    </div>
  );
}
