import type { Show } from "@/lib/types";

export const SECTIONS = [
  { key: "contact",     label: "Day of Show Contact" },
  { key: "venue",       label: "Venue Address" },
  { key: "departure",   label: "Departure" },
  { key: "schedule",    label: "Schedule" },
  { key: "band",        label: "Band / Performance" },
  { key: "venueDetails",label: "Venue Details" },
  { key: "dealTerms",   label: "Deal Terms" },
  { key: "production",  label: "Production" },
  { key: "projections", label: "Projections" },
  { key: "parking",     label: "Parking" },
  { key: "loadIn",      label: "Load In" },
  { key: "greenRoom",   label: "Green Room" },
  { key: "guestList",   label: "Guest List" },
  { key: "wifi",        label: "WiFi" },
  { key: "settlement",  label: "Settlement" },
  { key: "hotel",       label: "Accommodations" },
  { key: "travel",      label: "Travel" },
  { key: "additional",  label: "Additional Info" },
] as const;

export type SectionKey = (typeof SECTIONS)[number]["key"];

export const ALL_SECTION_KEYS: SectionKey[] = SECTIONS.map((s) => s.key);

/**
 * Sections included in "Band View".
 * Matches what touring party members need on show day:
 * contact, departure, schedule, venue, load-in, parking, WiFi,
 * accommodations, travel, guest list.
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
    case "band":
      return !!(
        show.set_length ||
        show.curfew ||
        show.changeover_time ||
        show.backline_provided ||
        show.catering_details
      );
    case "venueDetails":
      return !!(show.venue_capacity || show.ticket_price || show.age_restriction);
    case "dealTerms":
      return !!(show.guarantee || show.backend_deal);
    case "production":
      return !!(
        show.hospitality ||
        show.support_act ||
        show.support_pay ||
        show.merch_split
      );
    case "projections":
      return !!(show.walkout_potential || show.net_gross || show.artist_comps);
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
    case "settlement":
      return !!(show.settlement_method || show.settlement_guarantee);
    case "hotel":
      return !!(
        show.hotel_name ||
        show.hotel_address ||
        show.hotel_confirmation
      );
    case "travel":
      return !!show.travel_notes?.trim();
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
