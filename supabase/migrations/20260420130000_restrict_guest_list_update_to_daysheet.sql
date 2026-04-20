-- Restrict `update_guest_list_by_token` so only `daysheet` tokens can edit the
-- guest list. Door list (`guestlist`) tokens are read-only — they go to venue
-- staff, who shouldn't be mutating the list from the box office view.

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
    AND link_type = 'daysheet'
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
