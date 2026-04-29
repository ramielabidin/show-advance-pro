ALTER TABLE public.shows
  ADD COLUMN dos_closed_at timestamptz NULL,
  ADD COLUMN hotel_phone   text         NULL;

COMMENT ON COLUMN public.shows.dos_closed_at IS
  'Set when the user closes the Day of Show overlay after settling. Drives the Phase 3a (celebration) → Phase 3b (hotel reveal) split inside PhasePostSettle.';

COMMENT ON COLUMN public.shows.hotel_phone IS
  'Optional hotel front desk phone number. Drives the "Call front desk" chip on the Day of Show hotel reveal (Phase 3b).';
