-- Drop the `age_restriction` column on `shows`.
--
-- The column was removed from the live schema and the guest-facing day sheet
-- at some point, but an explicit migration was never recorded. The column
-- lingered in TypeScript types and in the CSV importer's column map, which
-- caused bulk imports to fail with "Could not find the 'age_restriction'
-- column of 'shows' in the schema cache" whenever the CSV included that
-- header (or even when the importer tried to null it out on update).
--
-- `DROP COLUMN IF EXISTS` makes this idempotent for any environment that
-- still has the column.

ALTER TABLE public.shows DROP COLUMN IF EXISTS age_restriction;
