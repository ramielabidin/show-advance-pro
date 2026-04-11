-- Add home base city to app_settings, used as the departure point for
-- drive-time calculations when a show is the first in its tour.
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS home_base_city text;
