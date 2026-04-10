import type { Show } from "@/lib/types";

export const SECTIONS = [
  { key: "contact",     label: "Day of Show Contact" },
  { key: "venue",       label: "Venue Address" },
  { key: "departure",   label: "Departure" },
  { key: "schedule",    label: "Schedule" },
  { key: "loadIn",      label: "Load In" },
  { key: "parking",     label: "Parking" },
  { key: "greenRoom",   label: "Green Room" },
  { key: "guestList",   label: "Guest List" },
  { key: "wifi",        label: "WiFi" },
  { key: "hotel",       label: "Accommodations" },
  { key: "travel",      label: "Travel" },
  { key: "dealTerms",   label: "Deal Terms" },
  { key: "additional",  label: "Additional Info" },
] as const;

export type SectionKey = (typeof SECTIONS)[number]["key"];

export const ALL_SECTION_KEYS: SectionKey[] = SECTIONS.map((s) => s.key);

/**
 * Sections included in "Band View".
 */
export const BAND_VIEW_KEYS: SectionKey[] = [
  "contact",
  "departure",
  "schedule",
  "venue",
  "loadIn",
  "parking",
  "wifi",
  "hotel",
  "travel",
  "guestList",
];

/** Returns true if the section has at least one populated field in the show. */
export function hasData(
  show: Show & { schedule_entries?: any[] },
  key: SectionKey
): boolean {
  switch (key) {
    case "contact":
      return !!(show.dos_contact_name || show.dos_contact_phone);
    case "venue":
      return !!(show.venue_address || show.city);
    case "departure":
      return !!(show.departure_time || show.departure_location);
    case "schedule":
      return !!(show.schedule_entries?.length);
    case "parking":
      return !!show.parking_notes?.trim();
    case "loadIn":
      return !!show.load_in_details?.trim();
    case "greenRoom":
      return !!show.green_room_info?.trim();
    case "guestList":
      return !!show.guest_list_details?.trim();
    case "wifi":
      return !!(show.wifi_network || show.wifi_password);
    case "hotel":
      return !!(
        show.hotel_name ||
        show.hotel_address ||
        show.hotel_confirmation
      );
    case "travel":
      return !!show.travel_notes?.trim();
    case "dealTerms":
      return !!(
        show.guarantee ||
        show.ticket_price ||
        show.venue_capacity ||
        show.walkout_potential ||
        show.backend_deal
      );
    case "additional":
      return !!show.additional_info?.trim();
  }
}

/**
 * From the given list of keys, returns a Set containing only the keys
 * that have actual data in the show. Used by preset buttons so empty
 * sections are never pre-selected.
 */
export function withData(
  keys: SectionKey[],
  show: Show & { schedule_entries?: any[] }
): Set<SectionKey> {
  return new Set(keys.filter((k) => hasData(show, k)));
}
