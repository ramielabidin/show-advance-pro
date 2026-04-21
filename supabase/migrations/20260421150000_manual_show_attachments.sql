-- Manual PDF attachments on show detail page
--   1. Make inbound_email_attachments.event_id nullable so rows can exist
--      without an originating inbound email (manual uploads).
--   2. Add INSERT policy on inbound_email_attachments for team members.
--   3. Add INSERT policy on storage.objects for the inbound-attachments bucket.
-- Manual uploads use the path convention {team_id}/manual/{show_id}/{uuid}-{filename}
-- so they do not collide with email-sourced {team_id}/{event_id}/... paths.

ALTER TABLE public.inbound_email_attachments
  ALTER COLUMN event_id DROP NOT NULL;

CREATE POLICY "Team members can insert inbound email attachments"
  ON public.inbound_email_attachments FOR INSERT TO authenticated
  WITH CHECK (team_id IN (SELECT public.user_team_ids(auth.uid())));

CREATE POLICY "Team members can insert inbound attachment objects"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'inbound-attachments'
    AND (storage.foldername(name))[1] IN (
      SELECT team_id::text FROM public.team_members WHERE user_id = auth.uid()
    )
  );
