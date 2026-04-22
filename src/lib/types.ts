export interface TouringPartyMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  created_at: string;
}

export interface ScheduleEntry {
  id: string;
  show_id: string;
  time: string;
  label: string;
  is_band: boolean;
  sort_order: number;
}

export interface Song {
  id: string;
  team_id: string;
  title: string;
  created_at: string;
}

export type SetListEntry =
  | { kind: "song"; song_id: string; title: string }
  | { kind: "custom"; title: string }
  | { kind: "note"; text: string };

export interface Show {
  id: string;
  venue_name: string;
  venue_address: string | null;
  city: string;
  date: string;
  dos_contact_name: string | null;
  dos_contact_phone: string | null;
  dos_contact_email: string | null;
  departure_time: string | null;
  departure_notes: string | null;
  parking_notes: string | null;
  load_in_details: string | null;
  green_room_info: string | null;
  guest_list_details: string | null;
  wifi_network: string | null;
  wifi_password: string | null;
  settlement_method: string | null;
  settlement_guarantee: string | null;
  hotel_name: string | null;
  hotel_address: string | null;
  hotel_confirmation: string | null;
  hotel_checkin: string | null;
  hotel_checkout: string | null;
  additional_info: string | null;
  tour_id: string | null;
  venue_capacity: string | null;
  ticket_price: string | null;
  age_restriction: string | null;
  guarantee: string | null;
  backend_deal: string | null;
  hospitality: string | null;
  support_act: string | null;
  support_pay: string | null;
  merch_split: string | null;
  walkout_potential: string | null;
  net_gross: string | null;
  artist_comps: string | null;
  set_length: string | null;
  backline_provided: string | null;
  catering_details: string | null;
  is_reviewed: boolean;
  is_settled: boolean;
  advanced_at: string | null;
  advance_imported_at: string | null;
  actual_tickets_sold: string | null;
  actual_walkout: string | null;
  settlement_notes: string | null;
  created_at: string;
  updated_at: string;
  set_list?: SetListEntry[] | null;
  schedule_entries?: ScheduleEntry[];
  show_party_members?: ShowPartyMember[];
}

export interface ShowPartyMember {
  id: string;
  show_id: string;
  member_id: string;
  touring_party_members?: TouringPartyMember;
}

export interface Tour {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  shows?: Show[];
}
