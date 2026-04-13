-- Add display columns for Slack OAuth connection status
-- slack_webhook_url already exists; these two are informational only
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS slack_channel_name text,
  ADD COLUMN IF NOT EXISTS slack_team_name text;
