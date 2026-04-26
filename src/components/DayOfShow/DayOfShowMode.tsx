import { useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Show } from "@/lib/types";
import { useNowMinutes } from "@/hooks/useNowMinutes";
import PhasePreShow from "./PhasePreShow";

interface DayOfShowModeProps {
  showId: string;
  onClose: () => void;
}

/**
 * Full-screen overlay that takes over the viewport when the user enters Day
 * of Show Mode. Top chrome (small mic + DAY OF SHOW eyebrow + X dismiss) is
 * shared across phases; the body currently renders Phase 1 (Pre-show) only.
 * Phases 2 (Settle) and 3 (Post-settle hotel reveal) land in a follow-up PR
 * along with the phase derivation hook.
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
      {/* Top chrome — just dismiss. The huge serif typography below makes it
          immediately obvious we're in a different mode; a "DAY OF SHOW" eyebrow
          here was redundant with the dashboard mic chip that just got tapped. */}
      <div className="safe-area-top px-[18px] pt-3 flex items-center justify-end">
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss Day of Show"
          className="inline-flex items-center justify-center rounded-full border h-9 w-9 [transition:transform_160ms_var(--ease-out),background-color_160ms_var(--ease-out)] active:scale-[0.95]"
          style={{
            background: "hsl(var(--secondary))",
            borderColor: "hsl(var(--border))",
            color: "hsl(var(--muted-foreground))",
          }}
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      {/* Body — overscroll-contain so swipe-up-then-down doesn't bubble to the
          dashboard pull-to-refresh underneath. */}
      <div
        className="flex-1 overflow-auto flex flex-col"
        style={{ overscrollBehavior: "contain" }}
      >
        {show ? (
          <PhasePreShow show={show} nowMin={nowMin} />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}
