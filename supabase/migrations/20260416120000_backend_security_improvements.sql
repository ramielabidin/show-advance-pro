-- Backend security improvements
--   1. Make band-documents bucket private and replace permissive storage
--      policies with team-scoped policies that enforce membership by the
--      first path segment ({team_id}/...).
--   2. Add rate-limit table used by the parse-advance edge function.
--   3. Add indexes for common multi-tenant query paths and FK columns.

-- 1. Band documents: private bucket + team-scoped storage policies -----------

UPDATE storage.buckets SET public = false WHERE id = 'band-documents';

DROP POLICY IF EXISTS "Team members can upload band documents" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view band documents" ON storage.objects;
DROP POLICY IF EXISTS "Team members can delete band documents" ON storage.objects;

CREATE POLICY "Team members can view band documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'band-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT team_id::text FROM public.team_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can upload band documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'band-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT team_id::text FROM public.team_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can update band documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'band-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT team_id::text FROM public.team_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'band-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT team_id::text FROM public.team_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can delete band documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'band-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT team_id::text FROM public.team_members WHERE user_id = auth.uid()
    )
  );


-- 2. parse-advance rate limiting ---------------------------------------------

CREATE TABLE IF NOT EXISTS public.parse_advance_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_hash text NOT NULL,
  input_bytes integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.parse_advance_requests ENABLE ROW LEVEL SECURITY;
-- No policies: the table is only ever read/written by the edge function using
-- the service role key, which bypasses RLS. Clients get no access.

CREATE INDEX IF NOT EXISTS idx_parse_advance_requests_user_created
  ON public.parse_advance_requests (user_id, created_at DESC);


-- 3. Indexes for multi-tenant query paths and FKs ----------------------------

-- Team scoping
CREATE INDEX IF NOT EXISTS idx_shows_team_id ON public.shows (team_id);
CREATE INDEX IF NOT EXISTS idx_shows_team_id_date ON public.shows (team_id, date);
CREATE INDEX IF NOT EXISTS idx_tours_team_id ON public.tours (team_id);
CREATE INDEX IF NOT EXISTS idx_touring_party_members_team_id
  ON public.touring_party_members (team_id);
CREATE INDEX IF NOT EXISTS idx_app_settings_team_id ON public.app_settings (team_id);
CREATE INDEX IF NOT EXISTS idx_band_documents_team_id ON public.band_documents (team_id);

-- Team membership lookups (hot path via user_team_ids in every RLS policy)
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members (user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON public.team_members (team_id);
CREATE INDEX IF NOT EXISTS idx_team_invites_team_id ON public.team_invites (team_id);
CREATE INDEX IF NOT EXISTS idx_team_invites_email_lower
  ON public.team_invites (LOWER(email));

-- Show joins
CREATE INDEX IF NOT EXISTS idx_shows_tour_id ON public.shows (tour_id);
CREATE INDEX IF NOT EXISTS idx_schedule_entries_show_id_sort
  ON public.schedule_entries (show_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_show_party_members_show_id
  ON public.show_party_members (show_id);
CREATE INDEX IF NOT EXISTS idx_show_party_members_member_id
  ON public.show_party_members (member_id);
