-- Adds advance_imported_at to drive the "Import advance" empty-state on the
-- Show Info tab. Distinct from advanced_at (user confirmation that all details
-- are locked in with venue) and is_reviewed (user has reviewed parsed data).
ALTER TABLE shows ADD COLUMN IF NOT EXISTS advance_imported_at TIMESTAMPTZ NULL;

-- Backfill: any show that already has schedule_entries has effectively had an
-- advance applied, so preserve that status for the empty-state check.
UPDATE shows
SET advance_imported_at = updated_at
WHERE advance_imported_at IS NULL
  AND id IN (SELECT DISTINCT show_id FROM schedule_entries);
