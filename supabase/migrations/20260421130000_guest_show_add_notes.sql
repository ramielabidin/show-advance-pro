-- Add additional_info to the get_guest_show RPC so the guest day sheet
-- can display show notes. Financial fields remain excluded.

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
    ), '[]'::jsonb)
  );

  RETURN v_result;
END;
$$;
