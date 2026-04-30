import { formatCityState } from "@/lib/utils";

interface PlaceFooterProps {
  venueName: string | null;
  city: string | null;
  /** Optional full street address, used when building the Maps href.
   *  Display only ever shows City, State — keeping it short. */
  address?: string | null;
}

/**
 * Bottom anchor for Phase 1 + Phase 2 of Day of Show. Renders the
 * venue name in display serif and `City, ST` in mono underneath, the
 * whole element being a tap-target that opens Google Maps. Pinned to
 * the bottom of the phase body via flex-column ordering — caller is
 * responsible for placing it as the last child.
 *
 * Maps href prefers the full street address when available so the pin
 * lands on the venue precisely, falls back to "venue name, city" when
 * we don't have a street.
 */
export default function PlaceFooter({ venueName, city, address }: PlaceFooterProps) {
  if (!venueName) return null;

  const cityDisplay = formatCityState(city ?? "");
  const queryParts = [venueName];
  if (address?.trim()) queryParts.push(address.trim());
  else if (cityDisplay) queryParts.push(cityDisplay);
  const href = `https://maps.google.com/?q=${encodeURIComponent(queryParts.join(", "))}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="dos-phase-footer-place"
    >
      <div className="pf-name">{venueName}</div>
      {cityDisplay && <div className="pf-addr">{cityDisplay}</div>}
    </a>
  );
}
