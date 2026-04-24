-- Two-role RBAC: admin vs artist.
--
-- `team_members.role` continues to mean team ownership (owner/member) and
-- gates team deletion. `access_role` is the new dimension: whether a seat
-- has full access (`admin`) or the restricted artist view that hides deal,
-- settlement, revenue-simulator, integration, team-management, and
-- outbound-share surfaces. Kept as a separate column so owner/member stays
-- single-purpose and doesn't need a three-value enum.
--
-- Existing rows default to `admin` — nothing changes for current users.
-- Invites carry an `access_role` so the role is known at accept time; the
-- `accept_pending_invites` trigger copies it onto the new team_members row.
--
-- Owners are expected to always have `admin` access_role. Enforced in UI
-- rather than a CHECK constraint so we keep room to manoeuvre if the model
-- grows (e.g. a future "owner on sabbatical" state).

DO $$ BEGIN
  CREATE TYPE public.access_role AS ENUM ('admin', 'artist');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS access_role public.access_role NOT NULL DEFAULT 'admin';

ALTER TABLE public.team_invites
  ADD COLUMN IF NOT EXISTS access_role public.access_role NOT NULL DEFAULT 'admin';

-- Redefine the auto-accept trigger to carry access_role from invite → seat.
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
    INSERT INTO public.team_members (team_id, user_id, role, access_role)
    VALUES (invite.team_id, NEW.id, 'member', invite.access_role)
    ON CONFLICT (team_id, user_id) DO NOTHING;
    DELETE FROM public.team_invites WHERE id = invite.id;
  END LOOP;
  RETURN NEW;
END;
$$;
