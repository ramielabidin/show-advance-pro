-- Inbound email parsing via SendGrid
--   1. Adds per-team inbound_email_token on app_settings.
--   2. Adds inbound_parse_events queue table.
--   3. Adds inbound_email_attachments table for PDFs saved from forwarded emails.
--   4. Creates private storage bucket `inbound-attachments` with team-scoped policies.
--   5. Updates create_team_with_owner to auto-provision the token.
--   6. Backfills tokens for any existing app_settings rows.

-- 1. Token column -----------------------------------------------------------

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS inbound_email_token text UNIQUE;

-- Token generator: 8 chars, lowercase alphanumeric, excluding ambiguous chars
-- (0, o, 1, l, i). Retries on the rare collision.
CREATE OR REPLACE FUNCTION public.generate_inbound_email_token()
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  alphabet  constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  candidate text;
  i         int;
BEGIN
  LOOP
    candidate := '';
    FOR i IN 1..8 LOOP
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    IF NOT EXISTS (
      SELECT 1 FROM public.app_settings WHERE inbound_email_token = candidate
    ) THEN
      RETURN candidate;
    END IF;
  END LOOP;
END;
$$;

-- 2. inbound_parse_events ---------------------------------------------------

CREATE TABLE IF NOT EXISTS public.inbound_parse_events (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id          uuid        NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  raw_email_text   text        NOT NULL,
  from_address     text,
  email_subject    text,
  status           text        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  reviewed_at      timestamptz,
  reviewed_show_id uuid        REFERENCES public.shows(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_inbound_parse_events_team_status_created
  ON public.inbound_parse_events (team_id, status, created_at DESC);

ALTER TABLE public.inbound_parse_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view inbound parse events"
  ON public.inbound_parse_events FOR SELECT TO authenticated
  USING (team_id IN (SELECT public.user_team_ids(auth.uid())));

CREATE POLICY "Team members can update inbound parse events"
  ON public.inbound_parse_events FOR UPDATE TO authenticated
  USING (team_id IN (SELECT public.user_team_ids(auth.uid())))
  WITH CHECK (team_id IN (SELECT public.user_team_ids(auth.uid())));

-- No INSERT policy: only the edge function (service role) writes these rows.

-- 3. inbound_email_attachments ----------------------------------------------

CREATE TABLE IF NOT EXISTS public.inbound_email_attachments (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          uuid        NOT NULL REFERENCES public.inbound_parse_events(id) ON DELETE CASCADE,
  team_id           uuid        NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  show_id           uuid        REFERENCES public.shows(id) ON DELETE SET NULL,
  storage_path      text        NOT NULL,
  original_filename text        NOT NULL,
  content_type      text,
  size_bytes        integer,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inbound_email_attachments_event
  ON public.inbound_email_attachments (event_id);
CREATE INDEX IF NOT EXISTS idx_inbound_email_attachments_show
  ON public.inbound_email_attachments (show_id);
CREATE INDEX IF NOT EXISTS idx_inbound_email_attachments_team
  ON public.inbound_email_attachments (team_id);

ALTER TABLE public.inbound_email_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view inbound email attachments"
  ON public.inbound_email_attachments FOR SELECT TO authenticated
  USING (team_id IN (SELECT public.user_team_ids(auth.uid())));

CREATE POLICY "Team members can update inbound email attachments"
  ON public.inbound_email_attachments FOR UPDATE TO authenticated
  USING (team_id IN (SELECT public.user_team_ids(auth.uid())))
  WITH CHECK (team_id IN (SELECT public.user_team_ids(auth.uid())));

CREATE POLICY "Team members can delete inbound email attachments"
  ON public.inbound_email_attachments FOR DELETE TO authenticated
  USING (team_id IN (SELECT public.user_team_ids(auth.uid())));

-- 4. Storage bucket `inbound-attachments` -----------------------------------
-- Path convention: {team_id}/{event_id}/{filename}
-- Team-scoped via first path segment, matching the band-documents pattern.

INSERT INTO storage.buckets (id, name, public)
VALUES ('inbound-attachments', 'inbound-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Team members can view inbound attachment objects"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'inbound-attachments'
    AND (storage.foldername(name))[1] IN (
      SELECT team_id::text FROM public.team_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can delete inbound attachment objects"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'inbound-attachments'
    AND (storage.foldername(name))[1] IN (
      SELECT team_id::text FROM public.team_members WHERE user_id = auth.uid()
    )
  );

-- No INSERT/UPDATE client policy: only the edge function (service role) writes.

-- 5. Provision token on team creation ---------------------------------------

CREATE OR REPLACE FUNCTION public.create_team_with_owner(_team_id uuid, _name text, _user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != _user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  INSERT INTO public.teams (id, name, created_by) VALUES (_team_id, _name, _user_id);
  INSERT INTO public.team_members (team_id, user_id, role) VALUES (_team_id, _user_id, 'owner');
  INSERT INTO public.app_settings (team_id, inbound_email_token)
    VALUES (_team_id, public.generate_inbound_email_token());
END;
$$;

-- 6. Backfill tokens for existing teams -------------------------------------

UPDATE public.app_settings
SET inbound_email_token = public.generate_inbound_email_token()
WHERE inbound_email_token IS NULL;
