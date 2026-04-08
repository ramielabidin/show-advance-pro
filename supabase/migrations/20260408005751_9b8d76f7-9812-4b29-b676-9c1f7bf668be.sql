
-- Create a secure function for team creation that handles team + member + settings atomically
CREATE OR REPLACE FUNCTION public.create_team_with_owner(_team_id uuid, _name text, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify the caller is the user they claim to be
  IF auth.uid() IS NULL OR auth.uid() != _user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO public.teams (id, name, created_by) VALUES (_team_id, _name, _user_id);
  INSERT INTO public.team_members (team_id, user_id, role) VALUES (_team_id, _user_id, 'owner');
  INSERT INTO public.app_settings (team_id) VALUES (_team_id);
END;
$$;

-- Now tighten the team_members INSERT policy to only allow owners
DROP POLICY IF EXISTS "Owners can insert team members" ON public.team_members;
CREATE POLICY "Owners can insert team members"
  ON public.team_members
  FOR INSERT
  TO authenticated
  WITH CHECK (is_team_owner(auth.uid(), team_id));
