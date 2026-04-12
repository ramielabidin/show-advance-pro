import type { Show } from "@/lib/types";

export const SECTIONS = [
  { key: "contact",      label: "Day of Show Contact" },
  { key: "venue",        label: "Venue Address" },
  { key: "schedule",     label: "Schedule" },
  { key: "departure",    label: "Departure" },
  { key: "parking",      label: "Parking" },
  { key: "loadIn",       label: "Load In" },
  { key: "greenRoom",    label: "Green Room" },
  { key: "venueDetails", label: "Venue Details" },
  { key: "band",         label: "Band & Performance" },
  { key: "dealTerms",    label: "Deal Terms" },
  { key: "hospitality",  label: "Hospitality" },
  { key: "guestList",    label: "Guest List" },
  { key: "projections",  label: "Projections" },
  { key: "wifi",         label: "WiFi" },
  { key: "hotel",        label: "Accommodations" },
  { key: "travel",       label: "Travel" },
  { key: "additional",   label: "Additional Info" },
] as const;

export type SectionKey = (typeof SECTIONS)[number]["key"];

export const ALL_SECTION_KEYS: SectionKey[] = SECTIONS.map((s) => s.key);

/**
 * Sections included in "Band View" — logistics the band needs, no financial details.
 */
export const BAND_VIEW_KEYS: SectionKey[] = [
  "contact",
  "venue",
  "schedule",
  "parking",
  "loadIn",
  "greenRoom",
  "venueDetails",
  "band",
  "guestList",
];

/**
 * Fields hidden per section in band view.
 * Shared across all output formats (PDF, Slack, Email).
 */
const BAND_HIDDEN_FIELDS: Partial<Record<SectionKey, string[]>> = {
  venueDetails: ["ticket_price"],
  band: ["support_pay"],
};

/**
 * Returns true if the given field should be hidden in band view.
 * Used by all renderers to ensure consistent field filtering.
 */
export function isBandHidden(
  sectionKey: SectionKey,
  fieldName: string,
  bandMode: boolean
): boolean {
  if (!bandMode) return false;
  return BAND_HIDDEN_FIELDS[sectionKey]?.includes(fieldName) ?? false;
}

/** Helper — non-empty, non-TBD/n/a value */
function v(f: unknown): boolean {
  if (f == null) return false;
  const s = String(f).trim().toLowerCase();
  return s !== "" && s !== "tbd" && s !== "n/a";
}

/** Returns true if the section has at least one populated field in the show. */
export function hasData(
  show: Show & { schedule_entries?: any[] },
  key: SectionKey
): boolean {
  switch (key) {
    case "contact":
      return v(show.dos_contact_name) || v(show.dos_contact_phone);
    case "venue":
      return v(show.venue_address) || v(show.city);
    case "schedule":
      return !!(show.schedule_entries?.length);
    case "departure":
      return v(show.departure_time) || v(show.departure_location);
    case "parking":
      return v(show.parking_notes);
    case "loadIn":
      return v(show.load_in_details);
    case "greenRoom":
      return v(show.green_room_info);
    case "venueDetails":
      return v(show.venue_capacity) || v(show.ticket_price) || v(show.age_restriction);
    case "band":
      return v(show.set_length) || v(show.curfew) || v(show.support_act) || v(show.support_pay);
    case "dealTerms":
      return v(show.guarantee) || v(show.backend_deal);
    case "hospitality":
      return v(show.hospitality);
    case "guestList":
      return v(show.guest_list_details);
    case "projections":
      return v(show.walkout_potential) || v(show.net_gross);
    case "wifi":
      return v(show.wifi_network) || v(show.wifi_password);
    case "hotel":
      return v(show.hotel_name) || v(show.hotel_address) || v(show.hotel_confirmation);
    case "travel":
      return v(show.travel_notes);
    case "additional":
      return v(show.additional_info) || v(show.merch_split);
  }
}

/**
 * From the given list of keys, returns a Set containing only the keys
 * that have actual data in the show.
 */
export function withData(
  keys: SectionKey[],
  show: Show & { schedule_entries?: any[] }
): Set<SectionKey> {
  return new Set(keys.filter((k) => hasData(show, k)));
}
