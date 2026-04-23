-- Multi-contact support for shows.
--
-- Before this migration, each show had a single "day of show" contact stored
-- in three columns on the `shows` table (dos_contact_name/phone/email). This
-- migration introduces a `show_contacts` table that can hold any number of
-- tagged contacts per show (promoter, production, hospitality, etc.), mirrors
-- the `schedule_entries` pattern (no team_id, transitive RLS via show_id),
-- backfills the existing DOS rows into the new table, then drops the legacy
-- columns. It also updates the `get_guest_show` RPC to return a `contacts`
-- jsonb array in place of the two DOS fields it previously exposed.

-- 1) Table --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.show_contacts (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id    uuid        NOT NULL REFERENCES public.shows(id) ON DELETE CASCADE,
  name       text        NOT NULL DEFAULT '',
  phone      text,
  email      text,
  role       text        NOT NULL DEFAULT 'custom',
  role_label text,
  notes      text,
  sort_order integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_show_contacts_show_id ON public.show_contacts(show_id);

ALTER TABLE public.show_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can access show contacts"
  ON public.show_contacts FOR ALL TO authenticated
  USING (
    show_id IN (
      SELECT id FROM public.shows
      WHERE team_id IN (SELECT public.user_team_ids(auth.uid()))
    )
  )
  WITH CHECK (
    show_id IN (
      SELECT id FROM public.shows
      WHERE team_id IN (SELECT public.user_team_ids(auth.uid()))
    )
  );

DROP TRIGGER IF EXISTS update_show_contacts_updated_at ON public.show_contacts;
CREATE TRIGGER update_show_contacts_updated_at
  BEFORE UPDATE ON public.show_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Backfill existing DOS data ----------------------------------------------
INSERT INTO public.show_contacts (show_id, name, phone, email, role, sort_order)
SELECT id,
       COALESCE(dos_contact_name, ''),
       NULLIF(dos_contact_phone, ''),
       NULLIF(dos_contact_email, ''),
       'day_of_show',
       0
FROM public.shows
WHERE COALESCE(dos_contact_name, '')  <> ''
   OR COALESCE(dos_contact_phone, '') <> ''
   OR COALESCE(dos_contact_email, '') <> '';

-- 3) Drop legacy columns ------------------------------------------------------
ALTER TABLE public.shows
  DROP COLUMN IF EXISTS dos_contact_name,
  DROP COLUMN IF EXISTS dos_contact_phone,
  DROP COLUMN IF EXISTS dos_contact_email;

-- 4) Update get_guest_show RPC ------------------------------------------------
-- Replace the two legacy dos_contact_* fields with a `contacts` jsonb array.
CREATE OR REPLACE FUNCTION public.get_guest_show(p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_link        public.guest_links%ROWTYPE;
  v_show        public.shows%ROWTYPE;
  v_artist_name text;
  v_result      jsonb;
BEGIN
  SELECT * INTO v_link
  FROM public.guest_links
  WHERE token = p_token
    AND revoked_at IS NULL
    AND expires_at > now()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_show FROM public.shows WHERE id = v_link.show_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT name INTO v_artist_name FROM public.teams WHERE id = v_show.team_id LIMIT 1;

  v_result := jsonb_build_object(
    'link_type',           v_link.link_type,
    'expires_at',          v_link.expires_at,
    'id',                  v_show.id,
    'artist_name',         v_artist_name,
    'date',                v_show.date,
    'venue_name',          v_show.venue_name,
    'venue_address',       v_show.venue_address,
    'city',                v_show.city,
    'departure_time',      v_show.departure_time,
    'departure_notes',     v_show.departure_notes,
    'parking_notes',       v_show.parking_notes,
    'load_in_details',     v_show.load_in_details,
    'green_room_info',     v_show.green_room_info,
    'guest_list_details',  v_show.guest_list_details,
    'artist_comps',        v_show.artist_comps,
    'venue_capacity',      v_show.venue_capacity,
    'wifi_network',        v_show.wifi_network,
    'wifi_password',       v_show.wifi_password,
    'hotel_name',          v_show.hotel_name,
    'hotel_address',       v_show.hotel_address,
    'hotel_confirmation',  v_show.hotel_confirmation,
    'hotel_checkin',       v_show.hotel_checkin,
    'hotel_checkout',      v_show.hotel_checkout,
    'set_length',          v_show.set_length,
    'additional_info',     v_show.additional_info,
    'schedule_entries',    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',         s.id,
          'time',       s.time,
          'label',      s.label,
          'is_band',    s.is_band,
          'sort_order', s.sort_order
        )
        ORDER BY s.sort_order
      )
      FROM public.schedule_entries s
      WHERE s.show_id = v_show.id
    ), '[]'::jsonb),
    'contacts',            COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',         c.id,
          'name',       c.name,
          'phone',      c.phone,
          'email',      c.email,
          'role',       c.role,
          'role_label', c.role_label,
          'notes',      c.notes,
          'sort_order', c.sort_order
        )
        ORDER BY c.sort_order
      )
      FROM public.show_contacts c
      WHERE c.show_id = v_show.id
    ), '[]'::jsonb)
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_guest_show(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_guest_show(text) TO anon, authenticated;
