-- Slack day-sheet automation.
--
-- Adds a team-wide toggle that auto-pushes the Slack day sheet at a configured
-- local time on the morning of each show. Scheduling is driven by pg_cron +
-- pg_net, which invokes the `run-scheduled-slack-pushes` edge function every 5
-- minutes. The edge function decides which shows are actually due based on the
-- venue's local timezone.
--
-- Prerequisite (run ONCE per environment, NOT in this migration because the
-- values are secrets and must not live in git):
--
--   select vault.create_secret(
--     'https://knwdjeicyisqsfiisaic.supabase.co',
--     'supabase_url'
--   );
--   select vault.create_secret(
--     '<service-role-key>',
--     'supabase_service_role_key'
--   );
--   select vault.create_secret(
--     '<random-32-char-string>',
--     'slack_cron_secret'
--   );
--
-- The same `slack_cron_secret` value must ALSO be set as the Supabase edge
-- function secret `CRON_SECRET` (used by run-scheduled-slack-pushes to
-- authenticate the inbound dispatch call).

-- 1. Extensions -------------------------------------------------------------
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2. Schema changes ---------------------------------------------------------

-- Team-level automation settings, alongside the existing Slack webhook fields.
alter table public.app_settings
  add column if not exists slack_auto_daysheet_enabled boolean not null default false,
  add column if not exists slack_auto_daysheet_time text not null default '08:00';

-- Per-show IANA timezone (e.g. `America/Los_Angeles`). Populated eagerly at
-- show-creation time via resolve-timezone; the scheduler also resolves lazily
-- for any still-null rows it evaluates.
alter table public.shows
  add column if not exists venue_timezone text,
  add column if not exists slack_daysheet_pushed_at timestamptz;

-- Narrow index used by the scheduler query (shows with automation pending for
-- a given team). Partial so it only covers rows that still need a push.
create index if not exists idx_shows_scheduler_lookup
  on public.shows (team_id, date)
  where slack_daysheet_pushed_at is null;

-- 3. Cron dispatch function -------------------------------------------------
--
-- Reads the Supabase URL, service-role key, and cron secret from Vault and
-- POSTs to the edge function. SECURITY DEFINER so pg_cron can call it; the
-- function is owned by `postgres` which can read vault.decrypted_secrets.
create or replace function public.dispatch_scheduled_slack_pushes()
returns bigint
language plpgsql
security definer
set search_path = public, extensions, vault, net
as $$
declare
  v_url text;
  v_service_key text;
  v_cron_secret text;
  v_request_id bigint;
begin
  select decrypted_secret into v_url
  from vault.decrypted_secrets where name = 'supabase_url';
  select decrypted_secret into v_service_key
  from vault.decrypted_secrets where name = 'supabase_service_role_key';
  select decrypted_secret into v_cron_secret
  from vault.decrypted_secrets where name = 'slack_cron_secret';

  if v_url is null or v_service_key is null or v_cron_secret is null then
    raise notice 'dispatch_scheduled_slack_pushes: missing vault secret(s); skipping';
    return null;
  end if;

  select net.http_post(
    url := v_url || '/functions/v1/run-scheduled-slack-pushes',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key,
      'X-Cron-Secret', v_cron_secret
    ),
    body := '{}'::jsonb
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.dispatch_scheduled_slack_pushes() from public;

-- 4. Schedule ----------------------------------------------------------------
--
-- cron.schedule is idempotent on job name — re-running this migration updates
-- the existing entry rather than duplicating it. Every 5 minutes is frequent
-- enough that a user's configured time (default 08:00) fires within 5 minutes
-- of the target in any timezone.
select cron.schedule(
  'scheduled-slack-daysheet-pushes',
  '*/5 * * * *',
  $cron$select public.dispatch_scheduled_slack_pushes();$cron$
);
