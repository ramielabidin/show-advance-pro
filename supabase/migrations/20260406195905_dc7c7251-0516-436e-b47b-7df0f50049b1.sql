
CREATE OR REPLACE FUNCTION public.get_team_member_emails(_team_id uuid)
RETURNS TABLE(user_id uuid, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tm.user_id, au.email::text
  FROM public.team_members tm
  JOIN auth.users au ON au.id = tm.user_id
  WHERE tm.team_id = _team_id
    AND EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_id = _team_id AND user_id = auth.uid()
    )
$$;
