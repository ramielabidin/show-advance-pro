-- Inbound email deduplication + match tracking
--   1. gmail_thread_id — dedupe by Gmail thread (not per-message). Advances are
--      back-and-forth threads; we want a single row per conversation with the
--      latest full-thread text blob, not one row per reply.
--   2. matched_show_id + match_confidence populated at insert time so the
--      notification modal can preview the matched show without an AI round-trip.

ALTER TABLE public.inbound_parse_events
  ADD COLUMN IF NOT EXISTS gmail_thread_id  text,
  ADD COLUMN IF NOT EXISTS matched_show_id  uuid REFERENCES public.shows(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS match_confidence text
    CHECK (match_confidence IS NULL OR match_confidence IN ('high', 'low'));

CREATE UNIQUE INDEX IF NOT EXISTS inbound_parse_events_gmail_thread_id_key
  ON public.inbound_parse_events (gmail_thread_id)
  WHERE gmail_thread_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inbound_parse_events_matched_show
  ON public.inbound_parse_events (matched_show_id);
