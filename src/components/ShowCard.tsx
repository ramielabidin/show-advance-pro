import { format, parseISO, isPast, isToday } from "date-fns";
import { MapPin, ChevronRight, Sparkles, CheckCircle2, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { cn, formatCityState } from "@/lib/utils";
import StatusDot from "@/components/StatusDot";
import type { Show } from "@/lib/types";

type ShowWithTour = Show & { tours?: { id: string; name: string } | null };

interface ShowCardProps {
  show: ShowWithTour;
  onDelete?: () => void;
  onRemoveFromTour?: () => void;
  chip?: "tour" | "standalone" | "none";
}

export default function ShowCard({ show, onDelete, onRemoveFromTour, chip = "none" }: ShowCardProps) {
  const date = parseISO(show.date);
  const past = isPast(date) && !isToday(date);

  return (
    <Link
      to={`/shows/${show.id}`}
      className={cn(
        "group flex items-center justify-between rounded-lg border bg-card p-3 sm:p-4 card-pressable transition-colors hover:border-foreground/20 hover:shadow-sm active:bg-accent/50",
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
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium text-foreground text-sm sm:text-base truncate min-w-0">{show.venue_name}</h3>
            {chip === "tour" && show.tours?.name && (
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium shrink-0"
                style={{ backgroundColor: "var(--pastel-blue-bg)", color: "var(--pastel-blue-fg)" }}
              >
                {show.tours.name}
              </span>
            )}
            {chip === "standalone" && (
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground shrink-0">
                Standalone
              </span>
            )}
            {!show.is_reviewed && (
              <span className="inline-flex items-center gap-1 rounded-full bg-badge-new/10 px-2 py-0.5 text-[11px] font-medium text-badge-new shrink-0">
                <Sparkles className="h-3 w-3" />
                New
              </span>
            )}
            {(show as any).is_settled && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium shrink-0"
                style={{ backgroundColor: "var(--pastel-green-bg)", color: "var(--pastel-green-fg)" }}
              >
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
        <StatusDot show={show} />
        {onRemoveFromTour && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemoveFromTour();
            }}
            className="px-2 py-1 rounded-md text-xs text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 [transition:color_150ms_var(--ease-out),background-color_150ms_var(--ease-out),opacity_150ms_var(--ease-out)]"
          >
            Remove
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete();
            }}
            className="p-1.5 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 [transition:color_150ms_var(--ease-out),background-color_150ms_var(--ease-out),opacity_150ms_var(--ease-out)]"
            aria-label="Delete show"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block" />
      </div>
    </Link>
  );
}
