-- Generic rate-limit log shared by edge functions via
-- supabase/functions/_shared/rate-limit.ts. Separate from
-- parse_advance_requests (which also tracks content_hash for dedupe); this
-- table is count-only and multiplexes buckets via the `bucket` column.
--
-- Written and read only by edge functions using the service role key; RLS is
-- enabled with no policies so clients get no access.

CREATE TABLE IF NOT EXISTS public.edge_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket text NOT NULL,
  key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.edge_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_edge_rate_limits_bucket_key_created
  ON public.edge_rate_limits (bucket, key, created_at DESC);
