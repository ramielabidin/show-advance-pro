-- Fold the standalone `curfew` column on `shows` into `schedule_entries`.
--
-- Curfew as a top-level field never played nicely with the Schedule section:
-- many shows already have a "Stage Curfew" or "Venue Curfew" entry in the
-- schedule, and the separate field produced duplicate curfew lines in every
-- export. Going forward, curfews are just another schedule entry.
--
-- This migration preserves existing curfew data by inserting one entry per
-- show that has a non-empty curfew value, appended at the end of the current
-- schedule (max(sort_order) + 1). Rows with "TBD", "N/A", empty, or null
-- curfews are skipped — they carry no information worth preserving.

INSERT INTO public.schedule_entries (show_id, time, label, is_band, sort_order)
SELECT
  s.id,
  s.curfew,
  'Curfew',
  false,
  COALESCE(
    (SELECT MAX(sort_order) + 1 FROM public.schedule_entries WHERE show_id = s.id),
    0
  )
FROM public.shows s
WHERE s.curfew IS NOT NULL
  AND btrim(s.curfew) <> ''
  AND lower(btrim(s.curfew)) <> 'tbd'
  AND lower(btrim(s.curfew)) <> 'n/a';

ALTER TABLE public.shows DROP COLUMN curfew;
