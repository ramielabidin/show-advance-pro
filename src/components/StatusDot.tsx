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

type LiveStatus = Exclude<ShowStatus, "past">;

export const STATUS_COLOR: Record<LiveStatus, string> = {
  advanced: "var(--pastel-green-fg)",
  pending: "var(--pastel-yellow-fg)",
  urgent: "var(--pastel-red-fg)",
};

export const STATUS_LABEL: Record<LiveStatus, string> = {
  advanced: "Advanced",
  pending: "Not yet advanced",
  urgent: "Within 7 days, not advanced",
};

interface StatusDotProps {
  show: Pick<Show, "date" | "advanced_at">;
  className?: string;
}

export default function StatusDot({ show, className }: StatusDotProps) {
  const status = getShowStatus(show);
  if (status === "past") return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn("inline-block h-2 w-2 rounded-full shrink-0", className)}
          style={{ backgroundColor: STATUS_COLOR[status] }}
          aria-label={STATUS_LABEL[status]}
        />
      </TooltipTrigger>
      <TooltipContent>{STATUS_LABEL[status]}</TooltipContent>
    </Tooltip>
  );
}
