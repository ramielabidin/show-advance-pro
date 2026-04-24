import type { Show } from "@/lib/types";

/**
 * The sections included in a day sheet shared with the band.
 *
 * Rendered in this order by all exporters (PDF, Email, Slack). Sections
 * with no populated data are automatically skipped — see `withData()`.
 *
 * Financial / business-side sections (Deal Terms, Projections, Hospitality,
 * Travel, Additional Info) are intentionally excluded. Per-field hides
 * (Ticket Price on Venue Details, Support Pay on Band & Performance) are
 * handled inline by each renderer.
 */
export const DAYSHEET_SECTION_KEYS = [
  "contact",
  "venue",
  "schedule",
  "departure",
  "parking",
  "loadIn",
  "greenRoom",
  "venueDetails",
  "guestList",
  "wifi",
  "hotel",
] as const;

export type SectionKey = (typeof DAYSHEET_SECTION_KEYS)[number];

/** Helper — non-empty, non-TBD/n/a value */
function v(f: unknown): boolean {
  if (f == null) return false;
  const s = String(f).trim().toLowerCase();
  return s !== "" && s !== "tbd" && s !== "n/a";
}

/** Returns true if the section has at least one populated field in the show. */
export function hasData(
  show: Show & { contacts?: unknown[] },
  key: SectionKey
): boolean {
  switch (key) {
    case "contact":
      return !!(show.show_contacts?.length || show.contacts?.length);
    case "venue":
      return v(show.venue_address) || v(show.city);
    case "schedule":
      return !!(show.schedule_entries?.length);
    case "departure":
      return v(show.departure_time) || v(show.departure_notes);
    case "parking":
      return v(show.parking_notes);
    case "loadIn":
      return v(show.load_in_details);
    case "greenRoom":
      return v(show.green_room_info);
    case "venueDetails":
      return v(show.venue_capacity);
    case "guestList":
      return v(show.guest_list_details);
    case "wifi":
      return v(show.wifi_network) || v(show.wifi_password);
    case "hotel":
      return v(show.hotel_name) || v(show.hotel_address) || v(show.hotel_confirmation);
  }
}

/**
 * Returns the ordered list of day sheet sections that have populated data
 * in the given show. Anything else is skipped from the export.
 */
export function daysheetSectionsFor(show: Show): SectionKey[] {
  return DAYSHEET_SECTION_KEYS.filter((k) => hasData(show, k));
}
