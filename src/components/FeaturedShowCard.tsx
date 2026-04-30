import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { MapPin, Car } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatCityState } from "@/lib/utils";
import { to12Hour, to24Hour } from "@/lib/timeFormat";
import { isLoadInLabel, isDoorsLabel } from "@/lib/scheduleMatch";
import { showDayMinutes } from "@/components/DayOfShow/timeUtils";
import { useNowMinutes } from "@/hooks/useNowMinutes";
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

  const showFinalDate = mode === "final";

  const nowMin = useNowMinutes();
  const entries = show.schedule_entries ?? [];
  const loadInEntry = entries
    .filter((e) => isLoadInLabel(e.label))
    .sort((a, b) => (to24Hour(a.time) ?? "").localeCompare(to24Hour(b.time) ?? ""))[0];
  const doorsEntry = entries.find((e) => isDoorsLabel(e.label));
  const bandEntry = entries.find((e) => e.is_band);

  const loadInTime = to12Hour(loadInEntry?.time);
  const doorsTime = to12Hour(doorsEntry?.time);
  const setTime = to12Hour(bandEntry?.time);

  const countdownText = (() => {
    if (daysAway > 0 || !bandEntry?.time) return null;
    const setMin = showDayMinutes(bandEntry.time);
    if (setMin === null) return null;
    const now = new Date();
    const isPostMidnightOnShowNight = setMin >= 24 * 60 && now.getHours() < 4;
    const adjustedCurrentMin = isPostMidnightOnShowNight ? nowMin + 24 * 60 : nowMin;
    const diffMin = setMin - adjustedCurrentMin;
    if (diffMin <= 0) return null;
    const hours = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    return hours > 0 ? `in ${hours} hr ${mins} min` : `in ${mins} min`;
  })();

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
              <h2 className="text-2xl sm:text-3xl font-display text-foreground truncate tracking-[-0.02em] min-w-0">
                {show.venue_name}
              </h2>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{formatCityState(show.city)}</span>
              </div>
              {/* Mobile-only tour byline. Desktop renders it in the right column for balance.
                  The leading "↳" glyph reads as a typographic kicker that ties the byline to
                  the venue/city above. Desktop drops it since the right-column position
                  already separates it from the body. */}
              {tour && (
                <div className="sm:hidden mt-2 flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-mono text-muted-foreground/80">
                  <Car className="h-3 w-3 shrink-0" strokeWidth={1.75} aria-hidden />
                  <span className="truncate">{tour.name}</span>
                </div>
              )}
              {showFinalDate && (
                <div className="mt-2 text-[10px] uppercase tracking-widest font-mono text-muted-foreground/80">
                  {format(date, "MMM d, yyyy")}
                </div>
              )}
              {countdownText && daysAway === 0 && (
                <div className="mt-2 text-[10px] uppercase tracking-widest font-mono text-muted-foreground/80">
                  Set {countdownText}
                </div>
              )}
            </div>

            {/* Right meta column. Desktop: tour byline above the dot; mobile: just the dot. */}
            <div className="flex flex-col items-end gap-2 shrink-0">
              {tour && (
                <div className="hidden sm:block max-w-[240px] mt-1 text-[10px] uppercase tracking-widest font-mono text-muted-foreground/80 truncate">
                  {tour.name}
                </div>
              )}
              <StatusDot show={show} className="mt-1.5 sm:mt-0" />
            </div>
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
