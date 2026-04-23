// Keep in sync with `src/lib/daysheetSections.ts` — edge functions run on Deno
// and can't import from src/.
//
// Day-sheet section list + emptiness check shared by the email renderer and
// the client exporters (Slack / PDF). Sections with no populated data are
// skipped so the email never renders orphan labels.

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

export interface ScheduleEntryLike {
  id?: string;
  time: string | null;
  label: string | null;
  is_band: boolean | null;
  sort_order: number | null;
}

export interface ShowContactLike {
  id?: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  role: string;
  role_label: string | null;
  notes: string | null;
  sort_order: number | null;
}

export interface ShowLike {
  show_contacts?: ShowContactLike[] | null;
  venue_address?: string | null;
  city?: string | null;
  departure_time?: string | null;
  departure_notes?: string | null;
  parking_notes?: string | null;
  load_in_details?: string | null;
  green_room_info?: string | null;
  venue_capacity?: string | null;
  guest_list_details?: string | null;
  wifi_network?: string | null;
  wifi_password?: string | null;
  hotel_name?: string | null;
  hotel_address?: string | null;
  hotel_confirmation?: string | null;
  schedule_entries?: ScheduleEntryLike[] | null;
}

/** Non-empty and not a "TBD" / "n/a" placeholder. */
export function v(f: unknown): boolean {
  if (f == null) return false;
  const s = String(f).trim().toLowerCase();
  return s !== "" && s !== "tbd" && s !== "n/a";
}

/** Pass through the trimmed value, or null if empty/TBD/N/A. */
export function val(f: unknown): string | null {
  if (f == null) return null;
  const s = String(f).trim();
  if (!s || s.toLowerCase() === "tbd" || s.toLowerCase() === "n/a") return null;
  return s;
}

export function hasData(show: ShowLike, key: SectionKey): boolean {
  switch (key) {
    case "contact":
      return !!(show.show_contacts && show.show_contacts.length > 0);
    case "venue":
      return v(show.venue_address) || v(show.city);
    case "schedule":
      return !!(show.schedule_entries && show.schedule_entries.length > 0);
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
