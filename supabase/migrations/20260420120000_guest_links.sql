-- Magic-link guest access: Day Sheet + Door List links
--   1. guest_links table (token-based share URLs for a single show).
--   2. RLS policies (authenticated team members only; anon never touches the table).
--   3. SECURITY DEFINER RPCs for the anonymous surface:
--        - get_guest_show(token) -> curated jsonb (no deal/financial fields)
--        - update_guest_list_by_token(token, guest_list) -> void
--      The RPCs are the ONLY public entry points; direct table access stays locked down.

-- 1. guest_links table ------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.guest_links (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  token      text        UNIQUE NOT NULL,
  show_id    uuid        NOT NULL REFERENCES public.shows(id) ON DELETE CASCADE,
  link_type  text        NOT NULL CHECK (link_type IN ('daysheet', 'guestlist')),
  created_by uuid        NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  revoked_at timestamptz,
  label      text
);

CREATE INDEX IF NOT EXISTS idx_guest_links_token ON public.guest_links (token);
CREATE INDEX IF NOT EXISTS idx_guest_links_show_type_active
  ON public.guest_links (show_id, link_type)
  WHERE revoked_at IS NULL;

ALTER TABLE public.guest_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view guest links"
  ON public.guest_links FOR SELECT TO authenticated
  USING (show_id IN (
    SELECT id FROM public.shows
    WHERE team_id IN (SELECT public.user_team_ids(auth.uid()))
  ));

CREATE POLICY "Team members can create guest links"
  ON public.guest_links FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND show_id IN (
      SELECT id FROM public.shows
      WHERE team_id IN (SELECT public.user_team_ids(auth.uid()))
    )
  );

CREATE POLICY "Team members can revoke guest links"
  ON public.guest_links FOR UPDATE TO authenticated
  USING (show_id IN (
    SELECT id FROM public.shows
    WHERE team_id IN (SELECT public.user_team_ids(auth.uid()))
  ))
  WITH CHECK (show_id IN (
    SELECT id FROM public.shows
    WHERE team_id IN (SELECT public.user_team_ids(auth.uid()))
  ));

-- No anon policy: the public surface is the RPCs below, not the table.

-- 2. get_guest_show(token) --------------------------------------------------
-- Validates the token and returns a curated show payload + schedule entries.
-- Returns NULL if the token is missing, expired, or revoked.
-- Financial / deal fields are intentionally excluded.

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
    'dos_contact_name',    v_show.dos_contact_name,
    'dos_contact_phone',   v_show.dos_contact_phone,
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
    ), '[]'::jsonb)
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_guest_show(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_guest_show(text) TO anon, authenticated;

-- 3. update_guest_list_by_token(token, guest_list) --------------------------
-- Validates the token and writes the provided guest list JSON string to the
-- associated show. Raises on invalid token so callers can surface an error.

CREATE OR REPLACE FUNCTION public.update_guest_list_by_token(
  p_token      text,
  p_guest_list text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_show_id uuid;
BEGIN
  SELECT show_id INTO v_show_id
  FROM public.guest_links
  WHERE token = p_token
    AND revoked_at IS NULL
    AND expires_at > now()
  LIMIT 1;

  IF v_show_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired guest link' USING ERRCODE = '28000';
  END IF;

  UPDATE public.shows
     SET guest_list_details = p_guest_list,
         updated_at         = now()
   WHERE id = v_show_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_guest_list_by_token(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_guest_list_by_token(text, text) TO anon, authenticated;
