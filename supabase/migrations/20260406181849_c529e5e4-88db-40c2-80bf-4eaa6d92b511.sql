
-- Create team_role enum
DO $$ BEGIN
  CREATE TYPE public.team_role AS ENUM ('owner', 'member');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Teams table
CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Team members table
CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role team_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Team invites table
CREATE TABLE IF NOT EXISTS public.team_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  email text NOT NULL,
  invited_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, email)
);
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

-- Add team_id to existing tables
ALTER TABLE public.shows ADD COLUMN team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE;
ALTER TABLE public.tours ADD COLUMN team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE;
ALTER TABLE public.touring_party_members ADD COLUMN team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE;
ALTER TABLE public.app_settings ADD COLUMN team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE;

-- Security definer function to check team membership
CREATE OR REPLACE FUNCTION public.is_team_member(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = _user_id AND team_id = _team_id
  )
$$;

-- Function to get all team IDs for a user
CREATE OR REPLACE FUNCTION public.user_team_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_id FROM public.team_members WHERE user_id = _user_id
$$;

-- Function to check if user is team owner
CREATE OR REPLACE FUNCTION public.is_team_owner(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = _user_id AND team_id = _team_id AND role = 'owner'
  )
$$;

-- Function to auto-accept invites on signup/login
CREATE OR REPLACE FUNCTION public.accept_pending_invites()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite RECORD;
BEGIN
  FOR invite IN
    SELECT * FROM public.team_invites WHERE LOWER(email) = LOWER(NEW.email)
  LOOP
    INSERT INTO public.team_members (team_id, user_id, role)
    VALUES (invite.team_id, NEW.id, 'member')
    ON CONFLICT (team_id, user_id) DO NOTHING;
    DELETE FROM public.team_invites WHERE id = invite.id;
  END LOOP;
  RETURN NEW;
END;
$$;

-- Trigger to auto-accept invites when a user is created
DROP TRIGGER IF EXISTS on_auth_user_created_accept_invites ON auth.users;
CREATE TRIGGER on_auth_user_created_accept_invites
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.accept_pending_invites();

-- RLS Policies for teams
CREATE POLICY "Members can view their teams"
  ON public.teams FOR SELECT TO authenticated
  USING (id IN (SELECT public.user_team_ids(auth.uid())));

CREATE POLICY "Authenticated users can create teams"
  ON public.teams FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Owners can update their teams"
  ON public.teams FOR UPDATE TO authenticated
  USING (public.is_team_owner(auth.uid(), id));

CREATE POLICY "Owners can delete their teams"
  ON public.teams FOR DELETE TO authenticated
  USING (public.is_team_owner(auth.uid(), id));

-- RLS Policies for team_members
CREATE POLICY "Members can view team members"
  ON public.team_members FOR SELECT TO authenticated
  USING (team_id IN (SELECT public.user_team_ids(auth.uid())));

CREATE POLICY "Owners can insert team members"
  ON public.team_members FOR INSERT TO authenticated
  WITH CHECK (
    public.is_team_owner(auth.uid(), team_id)
    OR user_id = auth.uid()
  );

CREATE POLICY "Owners can delete team members"
  ON public.team_members FOR DELETE TO authenticated
  USING (public.is_team_owner(auth.uid(), team_id));

-- RLS Policies for team_invites
CREATE POLICY "Members can view team invites"
  ON public.team_invites FOR SELECT TO authenticated
  USING (team_id IN (SELECT public.user_team_ids(auth.uid())));

CREATE POLICY "Owners can create invites"
  ON public.team_invites FOR INSERT TO authenticated
  WITH CHECK (public.is_team_owner(auth.uid(), team_id));

CREATE POLICY "Owners can delete invites"
  ON public.team_invites FOR DELETE TO authenticated
  USING (public.is_team_owner(auth.uid(), team_id));

-- Update RLS for existing tables
DROP POLICY IF EXISTS "Authenticated access" ON public.shows;
CREATE POLICY "Team members can view shows"
  ON public.shows FOR SELECT TO authenticated
  USING (team_id IN (SELECT public.user_team_ids(auth.uid())));
CREATE POLICY "Team members can insert shows"
  ON public.shows FOR INSERT TO authenticated
  WITH CHECK (team_id IN (SELECT public.user_team_ids(auth.uid())));
CREATE POLICY "Team members can update shows"
  ON public.shows FOR UPDATE TO authenticated
  USING (team_id IN (SELECT public.user_team_ids(auth.uid())));
CREATE POLICY "Team members can delete shows"
  ON public.shows FOR DELETE TO authenticated
  USING (team_id IN (SELECT public.user_team_ids(auth.uid())));

DROP POLICY IF EXISTS "Authenticated access" ON public.tours;
CREATE POLICY "Team members can view tours"
  ON public.tours FOR SELECT TO authenticated
  USING (team_id IN (SELECT public.user_team_ids(auth.uid())));
CREATE POLICY "Team members can insert tours"
  ON public.tours FOR INSERT TO authenticated
  WITH CHECK (team_id IN (SELECT public.user_team_ids(auth.uid())));
CREATE POLICY "Team members can update tours"
  ON public.tours FOR UPDATE TO authenticated
  USING (team_id IN (SELECT public.user_team_ids(auth.uid())));
CREATE POLICY "Team members can delete tours"
  ON public.tours FOR DELETE TO authenticated
  USING (team_id IN (SELECT public.user_team_ids(auth.uid())));

DROP POLICY IF EXISTS "Authenticated access" ON public.touring_party_members;
CREATE POLICY "Team members can view touring party"
  ON public.touring_party_members FOR SELECT TO authenticated
  USING (team_id IN (SELECT public.user_team_ids(auth.uid())));
CREATE POLICY "Team members can insert touring party"
  ON public.touring_party_members FOR INSERT TO authenticated
  WITH CHECK (team_id IN (SELECT public.user_team_ids(auth.uid())));
CREATE POLICY "Team members can update touring party"
  ON public.touring_party_members FOR UPDATE TO authenticated
  USING (team_id IN (SELECT public.user_team_ids(auth.uid())));
CREATE POLICY "Team members can delete touring party"
  ON public.touring_party_members FOR DELETE TO authenticated
  USING (team_id IN (SELECT public.user_team_ids(auth.uid())));

DROP POLICY IF EXISTS "Authenticated read" ON public.app_settings;
DROP POLICY IF EXISTS "Authenticated update" ON public.app_settings;
CREATE POLICY "Team members can view settings"
  ON public.app_settings FOR SELECT TO authenticated
  USING (team_id IN (SELECT public.user_team_ids(auth.uid())));
CREATE POLICY "Team members can update settings"
  ON public.app_settings FOR UPDATE TO authenticated
  USING (team_id IN (SELECT public.user_team_ids(auth.uid())));
CREATE POLICY "Team members can insert settings"
  ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (team_id IN (SELECT public.user_team_ids(auth.uid())));

DROP POLICY IF EXISTS "Authenticated access" ON public.schedule_entries;
CREATE POLICY "Team members can access schedule entries"
  ON public.schedule_entries FOR ALL TO authenticated
  USING (show_id IN (SELECT id FROM public.shows WHERE team_id IN (SELECT public.user_team_ids(auth.uid()))))
  WITH CHECK (show_id IN (SELECT id FROM public.shows WHERE team_id IN (SELECT public.user_team_ids(auth.uid()))));

DROP POLICY IF EXISTS "Authenticated access" ON public.show_party_members;
CREATE POLICY "Team members can access show party members"
  ON public.show_party_members FOR ALL TO authenticated
  USING (show_id IN (SELECT id FROM public.shows WHERE team_id IN (SELECT public.user_team_ids(auth.uid()))))
  WITH CHECK (show_id IN (SELECT id FROM public.shows WHERE team_id IN (SELECT public.user_team_ids(auth.uid()))));
