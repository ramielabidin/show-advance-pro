import { Bed, MapPin, Phone } from "lucide-react";
import { formatCityState, normalizePhone } from "@/lib/utils";
import type { Show } from "@/lib/types";

interface HotelRevealProps {
  show: Show;
}

/**
 * Phase 3b surface — hotel reveal. Mounts when `dos_closed_at` is
 * set on the show (the celebration in Phase 3a has already played
 * once). The card is centered vertically; the line footer ("Sleep
 * well." picked from the deterministic SIGN_OFFS pool by
 * PhasePostSettle) sits at the bottom. Same vertical rhythm as the
 * other phases.
 *
 * Action chips render conditionally:
 *
 *   address + phone → Open in Maps  +  Call front desk
 *   address only    → Open in Maps
 *   phone only      → Call front desk
 *   neither         → no chips (name-only fallback)
 *
 * The whole hotel section degrades gracefully — if there's not even
 * a hotel name, the parent renders just the line footer instead.
 */
export default function HotelReveal({ show }: HotelRevealProps) {
  const hasAddress = !!show.hotel_address?.trim();
  const hasPhone = !!show.hotel_phone?.trim();

  const cityDisplay = formatCityState(show.city ?? "");
  const addrSubline = (() => {
    if (show.hotel_address?.trim()) {
      const parts = show.hotel_address.split(",").map((s) => s.trim()).filter(Boolean);
      return parts.length > 1 ? parts.slice(1).join(", ") : (cityDisplay || parts[0]);
    }
    return cityDisplay || null;
  })();

  const mapsHref = hasAddress
    ? `https://maps.google.com/?q=${encodeURIComponent(
        [show.hotel_name, show.hotel_address].filter(Boolean).join(", "),
      )}`
    : undefined;

  const phoneHref = hasPhone ? `tel:${(show.hotel_phone ?? "").replace(/[^\d+]/g, "")}` : undefined;

  return (
    <div className="flex-1 flex items-center">
      <div
        className="w-full rounded-[18px] border p-6 flex flex-col gap-2.5"
        style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
      >
        <div
          className="inline-flex items-center justify-center rounded-[12px] mb-1"
          style={{
            width: 48,
            height: 48,
            background: "var(--pastel-blue-bg)",
            color: "var(--pastel-blue-fg)",
          }}
        >
          <Bed className="h-[22px] w-[22px]" strokeWidth={1.6} />
        </div>
        <div
          className="font-display"
          style={{
            fontSize: 26,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            color: "hsl(var(--foreground))",
          }}
        >
          {show.hotel_name}
        </div>
        {addrSubline && (
          <div
            className="font-mono text-[12.5px]"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            {addrSubline}
          </div>
        )}

        {(hasAddress || hasPhone) && (
          <div className="mt-3 flex gap-2.5">
            {hasAddress && (
              <a
                href={mapsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 h-[42px] rounded-[12px] border text-[13px] font-medium transition-colors hover:bg-muted active:scale-[0.985]"
                style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }}
              >
                <MapPin className="h-[14px] w-[14px]" strokeWidth={1.6} />
                Open in Maps
              </a>
            )}
            {hasPhone && (
              <a
                href={phoneHref}
                className="flex-1 inline-flex items-center justify-center gap-2 h-[42px] rounded-[12px] border text-[13px] font-medium transition-colors hover:bg-muted active:scale-[0.985]"
                style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }}
                aria-label={`Call ${show.hotel_name} front desk at ${normalizePhone(show.hotel_phone ?? "")}`}
              >
                <Phone className="h-[14px] w-[14px]" strokeWidth={1.6} />
                Call front desk
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
