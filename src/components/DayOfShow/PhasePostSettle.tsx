import { useMemo } from "react";
import { Navigation, ArrowUpRight } from "lucide-react";
import { formatHotelMoment, to12Hour } from "@/lib/timeFormat";
import { formatCityState } from "@/lib/utils";
import type { Show, ScheduleEntry } from "@/lib/types";
import { showDayMinutes } from "./timeUtils";

/**
 * Lead-in copy as a confident, time-aware statement. Each variant is
 * a self-contained line that names the moment without instructing the
 * user — the hotel hero (or its absence) below speaks for itself, so
 * the lead-in doesn't need a "go to bed / drive safe" branch. Avoids
 * any "safe" doubling against the eyebrow.
 *
 * Buckets:
 *   pre-midnight (9 PM–11:59 PM): "That's the show."
 *   post-midnight (00:00–02:59):  "That's a long one."
 *   pre-dawn (03:00–04:59):       "Almost dawn."
 *   morning (05:00–07:59, rare):  "Show's in the books."
 *
 * (After 8 AM the overlay auto-resolves itself.)
 */
function leadInCopy(nowHour: number): string {
  if (nowHour >= 5 && nowHour < 8) return "Show's in the books.";
  if (nowHour >= 3 && nowHour < 5) return "Almost dawn.";
  if (nowHour < 3) return "That's a long one.";
  return "That's the show.";
}

/**
 * Pool of sign-offs picked deterministically by show date so the same
 * show always shows the same line (stable across re-opens of the same
 * day's Phase 3) but the line varies day-to-day across a tour. Date
 * format is "YYYY-MM-DD" from show.date.
 */
const SIGN_OFFS = [
  "Good night.",
  "Sleep well.",
  "Until tomorrow.",
  "Rest up.",
  "See you in the morning.",
  "Until the next one.",
];

function signOffFor(date: string): string {
  const seed = date
    .split("")
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return SIGN_OFFS[seed % SIGN_OFFS.length];
}

interface PhasePostSettleProps {
  show: Show;
}

/**
 * Phase 3 surface — show is settled. The hotel reveal: name in big serif,
 * tap-to-navigate, a small booking card with check-in / confirmation, and a
 * "Good night" sign-off pinned to the bottom.
 *
 * Uses only fields that actually exist on the Show row (hotel_name,
 * hotel_address, hotel_confirmation, hotel_checkin, hotel_checkout). Distance
 * and room block aren't stored — design originally had them, we trimmed for
 * v1 rather than invent data.
 */
export default function PhasePostSettle({ show }: PhasePostSettleProps) {
  const navHref = useMemo(() => {
    if (!show.hotel_address?.trim() && !show.hotel_name?.trim()) return undefined;
    const target = [show.hotel_name, show.hotel_address].filter(Boolean).join(", ");
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(target)}`;
  }, [show.hotel_name, show.hotel_address]);

  // Split a free-text address into clean stacked lines, same convention as
  // the venue card on Phase 1: first comma splits street vs the rest.
  const addressLines = useMemo<string[]>(() => {
    const raw = show.hotel_address?.trim();
    if (raw) {
      const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
      if (parts.length <= 1) return parts;
      const [street, ...rest] = parts;
      return [street, rest.join(", ")];
    }
    const fallback = formatCityState(show.city || "");
    return fallback ? [fallback] : [];
  }, [show.hotel_address, show.city]);

  const checkInDisplay = formatHotelMoment(show.hotel_checkin_date, show.hotel_checkin) || null;
  const checkOutDisplay = formatHotelMoment(show.hotel_checkout_date, show.hotel_checkout) || null;

  const hasBookingDetail = !!(checkInDisplay || show.hotel_confirmation || checkOutDisplay);

  // No hotel info at all — fall through to the sign-off without the hero.
  // Most shows will have at least a name; this is the edge case.
  const hasHotel = !!(show.hotel_name?.trim() || show.hotel_address?.trim());

  // Schedule timeline — echoes Phase 2's timeline footer as a closing
  // visual. Same dot positions, same band-halo, no label or cues count
  // — a quiet recap of the night now behind the user. The dots replay
  // the sparkler animation so the timeline reads as a thread connecting
  // Phase 2 → Phase 3.
  const sortedEntries = useMemo<{ entry: ScheduleEntry; min: number }[]>(() => {
    const entries = (show.schedule_entries ?? [])
      .map((entry) => ({ entry, min: showDayMinutes(entry.time) }))
      .filter((row): row is { entry: ScheduleEntry; min: number } => row.min !== null);
    entries.sort((a, b) => {
      if (a.min !== b.min) return a.min - b.min;
      return a.entry.sort_order - b.entry.sort_order;
    });
    return entries;
  }, [show.schedule_entries]);

  return (
    <div className="px-[22px] pt-2 pb-7 flex-1 flex flex-col">
      {/* Phase 3 hero — the lead-in is the moment. Dropped the small
          "SETTLED" eyebrow and tiny 13px lead-in in favor of a big
          display statement that gives the final screen real weight.
          Clamps from 38px (small phones) to 52px (large), wraps via
          textWrap: balance for clean two-line breaks. The empty space
          below the statement is intentional — leave room for a
          designy element here later (small SVG flourish, accent rule,
          show-date badge — TBD). */}
      <div className="pt-[14px] pb-3">
        <div
          className="font-display"
          style={{
            fontSize: "clamp(38px, 11vw, 52px)",
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            color: "hsl(var(--foreground))",
            textWrap: "balance",
          }}
        >
          {leadInCopy(new Date().getHours())}
        </div>
      </div>

      {hasHotel && (
        <>
          {/* Hotel hero */}
          <div className="mt-6">
            <div
              className="text-[11px] uppercase font-medium leading-none mb-2.5"
              style={{ letterSpacing: "0.14em", color: "hsl(var(--muted-foreground))" }}
            >
              Hotel
            </div>
            <div
              className="font-display"
              style={{
                fontSize: 46,
                lineHeight: 1.02,
                letterSpacing: "-0.03em",
                color: "hsl(var(--foreground))",
              }}
            >
              {show.hotel_name || addressLines[0] || "Hotel"}
            </div>
            {addressLines.length > 0 && (
              <div
                className="mt-3.5 font-mono text-[14px] leading-[1.5]"
                style={{ color: "hsl(var(--foreground))" }}
              >
                {addressLines.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            )}
          </div>

          {/* Navigate button — inverted: light pill on dark canvas. The single
              big action available on this screen. */}
          {navHref && (
            <a
              href={navHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-[22px] flex items-center justify-between rounded-[14px] px-[18px] py-4 [transition:transform_160ms_var(--ease-out)] active:scale-[0.985]"
              style={{
                background: "hsl(var(--foreground))",
                color: "hsl(var(--background))",
              }}
            >
              <span className="inline-flex items-center gap-2">
                <Navigation className="h-4 w-4" strokeWidth={2} />
                <span className="text-[15px] font-medium">Navigate</span>
              </span>
              <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
            </a>
          )}

          {/* Booking card — only render rows for fields that exist */}
          {hasBookingDetail && (
            <div
              className="mt-5 rounded-[12px] border px-[14px] py-1"
              style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
            >
              {checkInDisplay && (
                <BookingRow label="Check-in" value={checkInDisplay} mono />
              )}
              {checkOutDisplay && (
                <BookingRow label="Check-out" value={checkOutDisplay} mono />
              )}
              {show.hotel_confirmation && (
                <BookingRow label="Confirmation" value={show.hotel_confirmation} mono />
              )}
            </div>
          )}
        </>
      )}

      {/* Closing artifact — quiet timeline echo from Phase 2 plus the
          sign-off, pinned to the bottom together. The timeline has no
          label or cues count here (Phase 2 already named it "Tonight,
          in full") and the dots are slightly smaller / softer so it
          reads as memory, not data. The dots replay the sparkler so
          the timeline feels like a single thread connecting the two
          wrap-up phases. */}
      <div className="mt-auto pt-8">
        {sortedEntries.length >= 2 && (
          <div className="mb-7 relative h-6">
            <div
              aria-hidden
              className="absolute left-0 right-0 top-1/2 h-px"
              style={{
                background: "hsl(var(--border))",
                transform: "translateY(-50%)",
              }}
            />
            {(() => {
              const startMin = sortedEntries[0].min;
              const endMin = sortedEntries[sortedEntries.length - 1].min;
              const span = Math.max(endMin - startMin, 1);
              return sortedEntries.map(({ entry, min }) => {
                const pos = ((min - startMin) / span) * 100;
                const isBand = !!entry.is_band;
                const size = isBand ? 8 : 5;
                const display = to12Hour(entry.time) ?? entry.time;
                const delayMs = Math.round(pos * 4);
                return (
                  <div
                    key={entry.id}
                    title={`${display} — ${entry.label}`}
                    className="timeline-dot absolute top-1/2 rounded-full"
                    style={{
                      left: `${pos}%`,
                      transform: "translate(-50%, -50%)",
                      width: size,
                      height: size,
                      background: isBand
                        ? "hsl(var(--badge-new))"
                        : "hsl(var(--muted-foreground) / 0.7)",
                      boxShadow: isBand
                        ? "0 0 0 2px hsl(var(--background)), 0 0 0 3px hsl(var(--badge-new) / 0.4)"
                        : "0 0 0 2px hsl(var(--background))",
                      animationDelay: `${delayMs}ms`,
                    }}
                  />
                );
              });
            })()}
          </div>
        )}
        <div className="text-center">
          <div
            className="font-display gentle-breathe"
            style={{
              fontSize: 22,
              lineHeight: 1.2,
              letterSpacing: "-0.02em",
              color: "hsl(var(--foreground))",
            }}
          >
            {signOffFor(show.date)}
          </div>
          <div
            className="mt-1 text-[12px]"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            This view closes itself in the morning.
          </div>
        </div>
      </div>
    </div>
  );
}

function BookingRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div
      className="grid grid-cols-[110px_1fr] gap-2.5 py-2.5 border-b last:border-b-0"
      style={{ borderColor: "hsl(var(--border) / 0.5)" }}
    >
      <span className="text-[12.5px]" style={{ color: "hsl(var(--muted-foreground))" }}>
        {label}
      </span>
      <span
        className={mono ? "font-mono text-[13px]" : "text-[13px]"}
        style={{ color: "hsl(var(--foreground))" }}
      >
        {value}
      </span>
    </div>
  );
}
