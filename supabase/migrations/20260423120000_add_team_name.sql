-- Add a separate display name for the team/account.
--
-- `teams.name` currently doubles as the artist name (it's what shows up on
-- day sheets, PDFs, guest views, and emails). This column lets the
-- team/business identity diverge from the artist identity for places that
-- care about the team itself (Settings header, member-invite emails).
--
-- Nullable on purpose: when unset, callers fall back to `teams.name`.
-- In Phase 2, this column moves to `account.name`.

alter table public.teams
  add column if not exists team_name text;
