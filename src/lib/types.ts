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

export interface Show {
  id: string;
  venue_name: string;
  venue_address: string | null;
  city: string;
  date: string;
  dos_contact_name: string | null;
  dos_contact_phone: string | null;
  departure_time: string | null;
  departure_location: string | null;
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
  travel_notes: string | null;
  additional_info: string | null;
  tour_id: string | null;
  is_reviewed: boolean;
  created_at: string;
  updated_at: string;
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
