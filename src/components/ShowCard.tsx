import { format, parseISO, isPast, isToday } from "date-fns";
import { MapPin, ChevronRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { Show } from "@/lib/types";

interface ShowCardProps {
  show: Show;
}

export default function ShowCard({ show }: ShowCardProps) {
  const date = parseISO(show.date);
  const past = isPast(date) && !isToday(date);

  return (
    <Link
      to={`/shows/${show.id}`}
      className={cn(
        "group flex items-center justify-between rounded-lg border bg-card p-4 transition-all hover:border-foreground/20 hover:shadow-sm animate-fade-in",
        past && "opacity-60"
      )}
    >
      <div className="flex items-center gap-5">
        <div className="text-center w-14">
          <div className="text-xs font-medium uppercase text-muted-foreground">
            {format(date, "MMM")}
          </div>
          <div className="text-2xl font-display text-foreground leading-tight">
            {format(date, "d")}
          </div>
          <div className="text-xs text-muted-foreground">{format(date, "EEE")}</div>
        </div>
        <div className="border-l pl-5">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-foreground">{show.venue_name}</h3>
            {!show.is_reviewed && (
              <span className="inline-flex items-center gap-1 rounded-full bg-badge-new/10 px-2 py-0.5 text-[11px] font-medium text-badge-new">
                <Sparkles className="h-3 w-3" />
                New
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
            <MapPin className="h-3 w-3" />
            {show.city}
          </div>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}
