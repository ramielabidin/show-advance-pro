-- Expose PDF attachments in get_guest_show RPC.
--
-- Adds an `attachments` array to the payload so guests can see and open
-- PDFs attached to a show (technical riders, hospitality riders, etc.).
-- Signed URL generation is handled by the `guest-attachment-url` edge
-- function which validates the token server-side before issuing the URL.

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
    'hotel_checkin_date',  v_show.hotel_checkin_date,
    'hotel_checkout_date', v_show.hotel_checkout_date,
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
    ), '[]'::jsonb),
    'attachments',         COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',                a.id,
          'original_filename', a.original_filename,
          'size_bytes',        a.size_bytes,
          'content_type',      a.content_type
        )
        ORDER BY a.created_at
      )
      FROM public.inbound_email_attachments a
      WHERE a.show_id = v_show.id
    ), '[]'::jsonb)
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_guest_show(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_guest_show(text) TO anon, authenticated;
