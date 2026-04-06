CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.touring_party_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.touring_party_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access" ON public.touring_party_members FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.shows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  venue_name TEXT NOT NULL,
  venue_address TEXT,
  city TEXT NOT NULL,
  date DATE NOT NULL,
  dos_contact_name TEXT,
  dos_contact_phone TEXT,
  departure_time TEXT,
  departure_location TEXT,
  parking_notes TEXT,
  load_in_details TEXT,
  green_room_info TEXT,
  guest_list_details TEXT,
  wifi_network TEXT,
  wifi_password TEXT,
  settlement_method TEXT,
  settlement_guarantee TEXT,
  hotel_name TEXT,
  hotel_address TEXT,
  hotel_confirmation TEXT,
  hotel_checkin TEXT,
  hotel_checkout TEXT,
  travel_notes TEXT,
  additional_info TEXT,
  is_reviewed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.shows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access" ON public.shows FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER update_shows_updated_at BEFORE UPDATE ON public.shows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.schedule_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  show_id UUID NOT NULL REFERENCES public.shows(id) ON DELETE CASCADE,
  time TEXT NOT NULL,
  label TEXT NOT NULL,
  is_band BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.schedule_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access" ON public.schedule_entries FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.show_party_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  show_id UUID NOT NULL REFERENCES public.shows(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.touring_party_members(id) ON DELETE CASCADE,
  UNIQUE (show_id, member_id)
);
ALTER TABLE public.show_party_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access" ON public.show_party_members FOR ALL USING (true) WITH CHECK (true);