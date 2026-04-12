import { format, parseISO, isPast, isToday, differenceInCalendarDays } from "date-fns";
import { MapPin, ChevronRight, Sparkles, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { cn, formatCityState } from "@/lib/utils";
import type { Show } from "@/lib/types";

interface ShowCardProps {
  show: Show;
  hasLoadIn?: boolean;
  hasDosContact?: boolean;
}

export default function ShowCard({ show, hasLoadIn, hasDosContact }: ShowCardProps) {
  const date = parseISO(show.date);
  const past = isPast(date) && !isToday(date);
  const daysAway = differenceInCalendarDays(date, new Date());
  const isUpcoming = !past;
  const isWithin7 = isUpcoming && daysAway >= 0 && daysAway < 7;

  // Compute dot color only for upcoming shows when advance info is provided
  let dotColor: string | null = null;
  if (isUpcoming && hasLoadIn !== undefined) {
    const advancedCount = (hasLoadIn ? 1 : 0) + (hasDosContact ? 1 : 0);
    if (advancedCount === 2) {
      dotColor = "bg-green-500";
    } else if (advancedCount === 1) {
      dotColor = isWithin7 ? "bg-red-500" : "bg-amber-400";
    } else {
      dotColor = isWithin7 ? "bg-red-500" : "bg-amber-400";
    }
  }

  return (
    <Link
      to={`/shows/${show.id}`}
      className={cn(
        "group flex items-center justify-between rounded-lg border bg-card p-3 sm:p-4 transition-all hover:border-foreground/20 hover:shadow-sm animate-fade-in active:bg-accent/50",
        past && "opacity-60"
      )}
    >
      <div className="flex items-center gap-3 sm:gap-5 min-w-0">
        <div className="text-center w-12 sm:w-14 shrink-0">
          <div className="text-[10px] sm:text-xs font-medium uppercase text-muted-foreground">
            {format(date, "MMM")}
          </div>
          <div className="text-xl sm:text-2xl font-display text-foreground leading-tight">
            {format(date, "d")}
          </div>
          <div className="text-[10px] sm:text-xs text-muted-foreground">{format(date, "EEE")}</div>
        </div>
        <div className="border-l pl-3 sm:pl-5 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-foreground text-sm sm:text-base truncate min-w-0">{show.venue_name}</h3>
            {!show.is_reviewed && (
              <span className="inline-flex items-center gap-1 rounded-full bg-badge-new/10 px-2 py-0.5 text-[11px] font-medium text-badge-new shrink-0">
                <Sparkles className="h-3 w-3" />
                New
              </span>
            )}
            {(show as any).is_settled && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:text-green-400 shrink-0">
                <CheckCircle2 className="h-3 w-3" />
                Settled
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground mt-0.5">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{formatCityState(show.city)}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-2">
        {dotColor && <span className={cn("h-2 w-2 rounded-full", dotColor)} />}
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 md:transition-opacity hidden sm:block" />
      </div>
    </Link>
  );
}
