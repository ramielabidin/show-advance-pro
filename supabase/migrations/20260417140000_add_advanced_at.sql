-- Track when a show has been manually marked as advanced.
-- NULL = not yet advanced; non-null = advanced at the given timestamp.
ALTER TABLE shows
  ADD COLUMN IF NOT EXISTS advanced_at timestamptz;
