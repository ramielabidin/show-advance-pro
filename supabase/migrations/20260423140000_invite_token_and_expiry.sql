-- Add opaque token + expiry to team_invites.
--
-- The invite URL on the Dispatch email now carries a token that drops the
-- recipient onto a per-invite landing page (`/invite/:token`) instead of
-- the generic auth page. Token is separate from the primary key so it can
-- be rotated without deleting the invite row and so the PK isn't exposed
-- in email links. 16 random bytes → 32 hex chars → unguessable.
--
-- `expires_at` defaults to 14 days out. The resolver edge function treats
-- any row past expiry as invalid.

alter table public.team_invites
  add column if not exists token text unique not null
    default encode(gen_random_bytes(16), 'hex'),
  add column if not exists expires_at timestamptz not null
    default (now() + interval '14 days');

create index if not exists idx_team_invites_token
  on public.team_invites (token);
