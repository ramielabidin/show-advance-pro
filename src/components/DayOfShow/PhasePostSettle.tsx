import { useMemo } from "react";
import { Navigation, ArrowUpRight } from "lucide-react";
import { to12Hour } from "@/lib/timeFormat";
import { formatCityState } from "@/lib/utils";
import type { Show } from "@/lib/types";

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

  const checkInDisplay = show.hotel_checkin
    ? to12Hour(show.hotel_checkin) ?? show.hotel_checkin
    : null;

  const hasBookingDetail = !!(checkInDisplay || show.hotel_confirmation || show.hotel_checkout);

  // No hotel info at all — show a graceful "drive safe" sign-off rather than
  // an empty hero. Most shows will have at least a name; this is the edge.
  const hasHotel = !!(show.hotel_name?.trim() || show.hotel_address?.trim());

  return (
    <div className="px-[22px] pt-2 pb-7 flex-1 flex flex-col">
      {/* Eyebrow + lead-in */}
      <div className="mt-6">
        <div
          className="text-[10.5px] uppercase font-medium leading-none mb-2"
          style={{ letterSpacing: "0.18em", color: "hsl(var(--muted-foreground))" }}
        >
          Settled · Drive safe
        </div>
        <div
          className="text-[13px] leading-[1.45]"
          style={{ color: "hsl(var(--muted-foreground))" }}
        >
          {hasHotel ? "Tonight's done. Here's where you're sleeping." : "Tonight's done. Get home safe."}
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
              {show.hotel_checkout && (
                <BookingRow
                  label="Check-out"
                  value={to12Hour(show.hotel_checkout) ?? show.hotel_checkout}
                  mono
                />
              )}
              {show.hotel_confirmation && (
                <BookingRow label="Confirmation" value={show.hotel_confirmation} mono />
              )}
            </div>
          )}
        </>
      )}

      {/* Sign-off — pinned to the bottom */}
      <div className="mt-auto pt-8 text-center">
        <div
          className="font-display"
          style={{
            fontSize: 22,
            lineHeight: 1.2,
            letterSpacing: "-0.02em",
            color: "hsl(var(--foreground))",
          }}
        >
          Good night.
        </div>
        <div
          className="mt-1 text-[12px]"
          style={{ color: "hsl(var(--muted-foreground))" }}
        >
          This view closes itself in the morning.
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
