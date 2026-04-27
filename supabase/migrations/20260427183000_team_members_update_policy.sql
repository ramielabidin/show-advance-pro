-- Allow team owners to UPDATE team_members rows in their team.
--
-- The original team_members RLS policy set covered SELECT (all members),
-- INSERT (owners), and DELETE (owners) — but not UPDATE. With access_role
-- now flippable from the Settings UI, the supabase-js client was hitting
-- this policy gap: postgrest silently dropped the row update (0 rows
-- affected, no error returned), the success toast fired, and the refetch
-- returned the unchanged row, making it look like the change "didn't take."
--
-- Mirrors the existing DELETE policy. Same predicate on USING and
-- WITH CHECK so an owner can't sneak a row across teams via UPDATE.

CREATE POLICY "Owners can update team members"
  ON public.team_members
  FOR UPDATE
  USING (public.is_team_owner(auth.uid(), team_id))
  WITH CHECK (public.is_team_owner(auth.uid(), team_id));
