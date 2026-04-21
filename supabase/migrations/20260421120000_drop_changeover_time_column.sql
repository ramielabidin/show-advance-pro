-- Fold the standalone `changeover_time` column on `shows` into `schedule_entries`.
--
-- Changeover time as a top-level field was rarely used and awkward to edit
-- alongside Set Length. Since a changeover is just another point on the show
-- day timeline, it belongs in `schedule_entries` (same reasoning as the
-- earlier `curfew` fold-in — see 20260419120000_drop_curfew_column.sql).
--
-- This migration preserves existing changeover data by inserting one entry
-- per show that has a non-empty changeover value, appended at the end of the
-- current schedule (max(sort_order) + 1). Rows with "TBD", "N/A", empty, or
-- null values are skipped.

INSERT INTO public.schedule_entries (show_id, time, label, is_band, sort_order)
SELECT
  s.id,
  s.changeover_time,
  'Changeover',
  false,
  COALESCE(
    (SELECT MAX(sort_order) + 1 FROM public.schedule_entries WHERE show_id = s.id),
    0
  )
FROM public.shows s
WHERE s.changeover_time IS NOT NULL
  AND btrim(s.changeover_time) <> ''
  AND lower(btrim(s.changeover_time)) <> 'tbd'
  AND lower(btrim(s.changeover_time)) <> 'n/a';

ALTER TABLE public.shows DROP COLUMN IF EXISTS changeover_time;
