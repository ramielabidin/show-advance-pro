import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { to12Hour } from "@/lib/timeFormat";
import type { ScheduleEntry } from "@/lib/types";
import { timeToMinutes } from "./timeUtils";

interface ScheduleListProps {
  entries: ScheduleEntry[];
  nowMin: number;
  /** Index of the entry to mark as "Next" (highlighted). null = no current next */
  heroIndex: number | null;
}

/**
 * Vertical schedule list rendered inside Phase 1. Past entries dim with a
 * strikethrough on the time; the hero ("Next") row is highlighted with a chip
 * and bumped weight. Order is the array order — caller is expected to have
 * sorted by time already.
 */
export default function ScheduleList({ entries, nowMin, heroIndex }: ScheduleListProps) {
  if (entries.length === 0) return null;

  return (
    <div
      className="rounded-[12px] border px-3 py-1"
      style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
    >
      {entries.map((row, i) => {
        const min = timeToMinutes(row.time);
        const isHero = i === heroIndex;
        const isPast = min !== null && min <= nowMin && !isHero;
        const display = to12Hour(row.time) ?? row.time;

        return (
          <div
            key={row.id}
            className={cn(
              "grid items-center gap-2.5 py-[9px]",
              "[grid-template-columns:62px_1fr_auto]",
              i < entries.length - 1 && "border-b",
            )}
            style={{
              borderColor: i < entries.length - 1 ? "hsl(var(--border) / 0.5)" : undefined,
              opacity: isPast ? 0.42 : 1,
            }}
          >
            <span
              className={cn(
                "font-mono text-[12px]",
                isPast && "line-through",
              )}
              style={{
                color: isHero ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                fontWeight: isHero ? 600 : 500,
              }}
            >
              {display}
            </span>
            <span
              className="text-[13.5px] flex items-center gap-1.5 min-w-0"
              style={{
                color: isHero ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                fontWeight: isHero ? 500 : 400,
              }}
            >
              {row.is_band && (
                <Mic
                  className="h-[11px] w-[11px] shrink-0"
                  style={{ color: "hsl(var(--badge-new))" }}
                  strokeWidth={2}
                />
              )}
              <span className="truncate">{row.label}</span>
              {isHero && (
                <span
                  className="ml-1 inline-flex items-center px-1.5 h-[18px] rounded-full text-[10px] font-medium uppercase tracking-wide shrink-0"
                  style={{
                    background: "hsl(var(--badge-new) / 0.18)",
                    color: "var(--pastel-blue-fg)",
                    letterSpacing: "0.06em",
                  }}
                >
                  Next
                </span>
              )}
            </span>
            <span aria-hidden />
          </div>
        );
      })}
    </div>
  );
}
