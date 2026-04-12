-- =============================================================
-- CONSOLIDATED MIGRATION SCRIPT
-- Run this in order on a fresh Supabase project SQL Editor.
-- All 7 sections must be executed as a single run or top-to-bottom
-- in order — later sections depend on earlier ones.
-- =============================================================


-- =============================================================
-- SECTION 1: CUSTOM TYPES
-- Must come first. The team_role enum is used in Section 3.
-- =============================================================

CREATE TYPE public.team_role AS ENUM ('owner', 'member');


-- =============================================================
-- SECTION 2: UTILITY TRIGGER FUNCTION
-- Must come before tables so triggers can reference it.
-- =============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;


-- =============================================================
-- SECTION 3: TABLES
-- Order matters: referenced tables must exist before the ones
-- that foreign-key into them.
--   teams → team_members, team_invites
--   teams → touring_party_members, tours, app_settings
--   tours  → shows
--   shows  → schedule_entries, show_party_members
--   touring_party_members → show_party_members
-- =============================================================

-- ---------------- teams ----------------
CREATE TABLE public.teams (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  created_by  uuid        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------- team_members ----------------
CREATE TABLE public.team_members (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    uuid        NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users(id)  ON DELETE CASCADE,
  role       team_role   NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);

-- ---------------- team_invites ----------------
CREATE TABLE public.team_invites (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    uuid        NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  email      text        NOT NULL,
  invited_by uuid        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, email)
);

-- ---------------- touring_party_members ----------------
CREATE TABLE public.touring_party_members (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    uuid        REFERENCES public.teams(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  email      text        NOT NULL DEFAULT '',
  phone      text        NOT NULL DEFAULT '',
  role       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------- tours ----------------
CREATE TABLE public.tours (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    uuid        REFERENCES public.teams(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  start_date date,
  end_date   date,
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------- shows ----------------
CREATE TABLE public.shows (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id              uuid        REFERENCES public.teams(id) ON DELETE CASCADE,
  tour_id              uuid        REFERENCES public.tours(id) ON DELETE SET NULL,
  venue_name           text        NOT NULL,
  venue_address        text,
  city                 text        NOT NULL,
  date                 date        NOT NULL,
  dos_contact_name     text,
  dos_contact_phone    text,
  departure_time       text,
  departure_location   text,
  parking_notes        text,
  load_in_details      text,
  green_room_info      text,
  guest_list_details   text,
  wifi_network         text,
  wifi_password        text,
  settlement_method    text,
  settlement_guarantee text,
  hotel_name           text,
  hotel_address        text,
  hotel_confirmation   text,
  hotel_checkin        text,
  hotel_checkout       text,
  travel_notes         text,
  additional_info      text,
  venue_capacity       text,
  ticket_price         text,
  age_restriction      text,
  guarantee            text,
  backend_deal         text,
  hospitality          text,
  support_act          text,
  support_pay          text,
  merch_split          text,
  walkout_potential    text,
  net_gross            text,
  artist_comps         text,
  set_length           text,
  curfew               text,
  backline_provided    text,
  catering_details     text,
  changeover_time      text,
  is_settled           boolean     NOT NULL DEFAULT false,
  actual_tickets_sold  text,
  actual_walkout       text,
  settlement_notes     text,
  is_reviewed          boolean     NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- ---------------- schedule_entries ----------------
CREATE TABLE public.schedule_entries (
  id         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id    uuid    NOT NULL REFERENCES public.shows(id) ON DELETE CASCADE,
  time       text    NOT NULL,
  label      text    NOT NULL,
  is_band    boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0
);

-- ---------------- show_party_members ----------------
CREATE TABLE public.show_party_members (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id   uuid NOT NULL REFERENCES public.shows(id)                  ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.touring_party_members(id)  ON DELETE CASCADE,
  UNIQUE (show_id, member_id)
);

-- ---------------- app_settings ----------------
CREATE TABLE public.app_settings (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id           uuid        REFERENCES public.teams(id) ON DELETE CASCADE,
  slack_webhook_url text,
  home_base_city    text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ---------------- band_documents ----------------
CREATE TABLE public.band_documents (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    uuid        NOT NULL,
  slot       text        NOT NULL,
  file_name  text        NOT NULL,
  file_path  text        NOT NULL,
  file_size  bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT band_documents_team_slot_unique UNIQUE (team_id, slot)
);


-- =============================================================
-- SECTION 4: updated_at TRIGGERS
-- Tables with an updated_at column get an auto-update trigger.
-- =============================================================

CREATE TRIGGER update_tours_updated_at
  BEFORE UPDATE ON public.tours
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shows_updated_at
  BEFORE UPDATE ON public.shows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_band_documents_updated_at
  BEFORE UPDATE ON public.band_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- =============================================================
-- SECTION 5: SECURITY-DEFINER FUNCTIONS & AUTH TRIGGER
-- These query team_members, so tables must already exist.
-- create_team_with_owner is called by the app on first login.
-- accept_pending_invites fires when a new auth.users row is
-- inserted (i.e. someone signs up via invite link).
-- =============================================================

CREATE OR REPLACE FUNCTION public.is_team_member(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = _user_id AND team_id = _team_id
  );
$$;

CREATE OR REPLACE FUNCTION public.user_team_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT team_id FROM public.team_members WHERE user_id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.is_team_owner(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = _user_id AND team_id = _team_id AND role = 'owner'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_team_member_emails(_team_id uuid)
RETURNS TABLE(user_id uuid, email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT tm.user_id, au.email::text
  FROM public.team_members tm
  JOIN auth.users au ON au.id = tm.user_id
  WHERE tm.team_id = _team_id
    AND EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_id = _team_id AND user_id = auth.uid()
    );
$$;

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
  INSERT INTO public.app_settings (team_id) VALUES (_team_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_pending_invites()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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

-- Fires on every new sign-up to auto-accept any pending invites for that email
CREATE TRIGGER on_auth_user_created_accept_invites
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.accept_pending_invites();


-- =============================================================
-- SECTION 6: ROW LEVEL SECURITY (RLS)
-- Enable RLS first, then attach policies.
-- All policies are TO authenticated — anonymous users get nothing.
-- schedule_entries and show_party_members are scoped indirectly
-- through their parent show's team_id.
-- =============================================================

-- Enable RLS
ALTER TABLE public.teams                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invites           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.touring_party_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tours                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shows                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_entries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.show_party_members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_documents         ENABLE ROW LEVEL SECURITY;

-- ---- teams ----
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

-- ---- team_members ----
CREATE POLICY "Members can view team members"
  ON public.team_members FOR SELECT TO authenticated
  USING (team_id IN (SELECT public.user_team_ids(auth.uid())));

CREATE POLICY "Owners can insert team members"
  ON public.team_members FOR INSERT TO authenticated
  WITH CHECK (public.is_team_owner(auth.uid(), team_id));

CREATE POLICY "Owners can delete team members"
  ON public.team_members FOR DELETE TO authenticated
  USING (public.is_team_owner(auth.uid(), team_id));

-- ---- team_invites ----
CREATE POLICY "Members can view team invites"
  ON public.team_invites FOR SELECT TO authenticated
  USING (team_id IN (SELECT public.user_team_ids(auth.uid())));

CREATE POLICY "Owners can create invites"
  ON public.team_invites FOR INSERT TO authenticated
  WITH CHECK (public.is_team_owner(auth.uid(), team_id));

CREATE POLICY "Owners can delete invites"
  ON public.team_invites FOR DELETE TO authenticated
  USING (public.is_team_owner(auth.uid(), team_id));

-- ---- shows ----
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

-- ---- tours ----
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

-- ---- touring_party_members ----
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

-- ---- app_settings ----
CREATE POLICY "Team members can view settings"
  ON public.app_settings FOR SELECT TO authenticated
  USING (team_id IN (SELECT public.user_team_ids(auth.uid())));

CREATE POLICY "Team members can insert settings"
  ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (team_id IN (SELECT public.user_team_ids(auth.uid())));

CREATE POLICY "Team members can update settings"
  ON public.app_settings FOR UPDATE TO authenticated
  USING (team_id IN (SELECT public.user_team_ids(auth.uid())));

-- ---- schedule_entries (scoped through shows) ----
CREATE POLICY "Team members can access schedule entries"
  ON public.schedule_entries FOR ALL TO authenticated
  USING (
    show_id IN (
      SELECT id FROM public.shows
      WHERE team_id IN (SELECT public.user_team_ids(auth.uid()))
    )
  )
  WITH CHECK (
    show_id IN (
      SELECT id FROM public.shows
      WHERE team_id IN (SELECT public.user_team_ids(auth.uid()))
    )
  );

-- ---- show_party_members (scoped through shows) ----
CREATE POLICY "Team members can access show party members"
  ON public.show_party_members FOR ALL TO authenticated
  USING (
    show_id IN (
      SELECT id FROM public.shows
      WHERE team_id IN (SELECT public.user_team_ids(auth.uid()))
    )
  )
  WITH CHECK (
    show_id IN (
      SELECT id FROM public.shows
      WHERE team_id IN (SELECT public.user_team_ids(auth.uid()))
    )
  );

-- ---- band_documents ----
CREATE POLICY "Team members can view band documents"
  ON public.band_documents FOR SELECT TO authenticated
  USING (team_id IN (SELECT public.user_team_ids(auth.uid())));

CREATE POLICY "Team members can insert band documents"
  ON public.band_documents FOR INSERT TO authenticated
  WITH CHECK (team_id IN (SELECT public.user_team_ids(auth.uid())));

CREATE POLICY "Team members can update band documents"
  ON public.band_documents FOR UPDATE TO authenticated
  USING (team_id IN (SELECT public.user_team_ids(auth.uid())));

CREATE POLICY "Team members can delete band documents"
  ON public.band_documents FOR DELETE TO authenticated
  USING (team_id IN (SELECT public.user_team_ids(auth.uid())));


-- =============================================================
-- SECTION 7: STORAGE BUCKET & POLICIES
-- NOTE: If the Storage UI shows an error saying the bucket
-- already exists, skip the INSERT and only run the policies.
-- =============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('band-documents', 'band-documents', true);

CREATE POLICY "Team members can upload band documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'band-documents');

CREATE POLICY "Authenticated users can view band documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'band-documents');

CREATE POLICY "Team members can delete band documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'band-documents');
