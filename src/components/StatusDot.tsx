import { differenceInCalendarDays, isPast, isToday, parseISO } from "date-fns";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Show } from "@/lib/types";

export type ShowStatus = "past" | "advanced" | "urgent" | "pending";

export function getShowStatus(show: Pick<Show, "date" | "advanced_at">): ShowStatus {
  const date = parseISO(show.date);
  if (isPast(date) && !isToday(date)) return "past";
  if (show.advanced_at) return "advanced";
  const daysAway = differenceInCalendarDays(date, new Date());
  if (daysAway >= 0 && daysAway < 7) return "urgent";
  return "pending";
}

// Visual grammar collapsed to two states: silent for advanced, single warm
// dot for anything that needs attention. The four-value `ShowStatus` type
// stays so callers that distinguish urgent/pending (e.g. future filters)
// don't have to recompute it from raw fields.
export const NEEDS_ATTENTION_COLOR = "var(--pastel-yellow-fg)";
export const NEEDS_ATTENTION_LABEL = "Not yet advanced";

interface StatusDotProps {
  show: Pick<Show, "date" | "advanced_at">;
  className?: string;
}

export default function StatusDot({ show, className }: StatusDotProps) {
  const status = getShowStatus(show);
  if (status === "past" || status === "advanced") return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn("inline-block h-2 w-2 rounded-full shrink-0", className)}
          style={{ backgroundColor: NEEDS_ATTENTION_COLOR }}
          aria-label={NEEDS_ATTENTION_LABEL}
        />
      </TooltipTrigger>
      <TooltipContent>{NEEDS_ATTENTION_LABEL}</TooltipContent>
    </Tooltip>
  );
}
