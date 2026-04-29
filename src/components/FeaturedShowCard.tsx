import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatCityState } from "@/lib/utils";
import { to12Hour, to24Hour } from "@/lib/timeFormat";
import { isLoadInLabel, isDoorsLabel } from "@/lib/scheduleMatch";
import StatusDot from "@/components/StatusDot";
import type { Show } from "@/lib/types";

interface FeaturedShowCardProps {
  show: Show;
  mode: "next" | "final";
  tour?: { id: string; name: string } | null;
}

export default function FeaturedShowCard({ show, mode, tour }: FeaturedShowCardProps) {
  const date = parseISO(show.date);
  const daysAway = differenceInCalendarDays(date, new Date());

  const daysLabel =
    daysAway <= 0
      ? "Today"
      : daysAway === 1
        ? "Tomorrow"
        : daysAway < 7
          ? `${daysAway} days away`
          : daysAway < 14
            ? "Next week"
            : `${Math.ceil(daysAway / 7)} weeks away`;

  const isUrgent = daysAway >= 0 && daysAway < 7;
  const showFinalDate = mode === "final";

  const entries = show.schedule_entries ?? [];
  const loadInEntry = entries
    .filter((e) => isLoadInLabel(e.label))
    .sort((a, b) => (to24Hour(a.time) ?? "").localeCompare(to24Hour(b.time) ?? ""))[0];
  const doorsEntry = entries.find((e) => isDoorsLabel(e.label));
  const bandEntry = entries.find((e) => e.is_band);

  const loadInTime = to12Hour(loadInEntry?.time);
  const doorsTime = to12Hour(doorsEntry?.time);
  const setTime = to12Hour(bandEntry?.time);

  const capRaw = show.venue_capacity;
  const capNum = capRaw ? parseInt(String(capRaw).replace(/[^\d]/g, ""), 10) : NaN;
  const capDisplay = Number.isFinite(capNum) ? capNum.toLocaleString() : null;

  const footerCells: { label: string; value: string | null }[] = [
    { label: "Load-in", value: loadInTime },
    { label: "Doors", value: doorsTime },
    { label: "Set", value: setTime },
    { label: "Capacity", value: capDisplay },
  ];
  const hasAnyFooterData = footerCells.some((c) => !!c.value);

  return (
    <Link to={`/shows/${show.id}`} className="block group card-pressable">
      <Card className="overflow-hidden hover:border-foreground/20 [transition:border-color_160ms_var(--ease-out),box-shadow_200ms_var(--ease-out)]">
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-start gap-4 sm:gap-5">
            {/* Calendar stub */}
            <div className="shrink-0 flex flex-col items-center justify-center rounded-lg border border-border bg-muted/50 w-14 h-[4.5rem] select-none">
              <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold leading-none mb-0.5">
                {format(date, "MMM")}
              </span>
              <span className="text-3xl font-display text-foreground leading-none tracking-[-0.03em]">{format(date, "d")}</span>
              <span className="text-[9px] text-muted-foreground mt-0.5">{format(date, "EEE")}</span>
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-display text-foreground truncate tracking-[-0.02em] min-w-0">
                  {show.venue_name}
                </h2>
                {tour && (
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium shrink-0"
                    style={{ backgroundColor: "var(--pastel-blue-bg)", color: "var(--pastel-blue-fg)" }}
                  >
                    {tour.name}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{formatCityState(show.city)}</span>
              </div>
              {showFinalDate ? (
                <span className="inline-flex items-center mt-2 text-[10px] uppercase tracking-widest font-medium px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                  {format(date, "MMM d, yyyy")}
                </span>
              ) : daysAway > 0 ? (
                <span
                  className={cn(
                    "inline-flex items-center mt-2 text-[10px] uppercase tracking-widest font-medium px-2 py-0.5 rounded-full",
                    !isUrgent && "bg-secondary text-muted-foreground",
                  )}
                  style={
                    isUrgent
                      ? { backgroundColor: "var(--pastel-yellow-bg)", color: "var(--pastel-yellow-fg)" }
                      : undefined
                  }
                >
                  {daysLabel}
                </span>
              ) : null}
            </div>

            {/* Advance status dot */}
            <StatusDot show={show} className="mt-1.5" />
          </div>
        </CardContent>
        {hasAnyFooterData && (
          <div className="grid grid-cols-4 border-t bg-muted/40">
            {footerCells.map((cell, i) => (
              <div
                key={cell.label}
                className={cn("py-3 px-3 sm:px-4", i < 3 && "border-r")}
                style={i < 3 ? { borderRightWidth: "0.5px" } : undefined}
              >
                <div className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">
                  {cell.label}
                </div>
                <div
                  className={cn(
                    "text-sm mt-1 whitespace-nowrap",
                    cell.value ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {cell.value ?? "—"}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </Link>
  );
}
