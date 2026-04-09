

## Plan: Update Departure Notes Placeholder and Auto-Normalize Departure Time

### Changes

**1. Update placeholder text** in `src/pages/ShowDetailPage.tsx` (line 611)
- Change `"e.g. Car 1 leaving from Rami's at 9am, Car 2 from JT's at 9:30am"` to something generic like `"e.g. Car 1 leaving from hotel at 9am, Car 2 from venue at 9:30am"`

**2. Normalize time on save** in `src/pages/ShowDetailPage.tsx`
- Currently, `normalizeTime` runs on blur but the raw value is still what gets saved. Update `saveInline` to detect if the current field has `timeFormat` and apply `normalizeTime` before saving. This way typing "1" saves as "1:00 PM", typing "330" saves as "3:30 PM", etc.
- Store a ref or flag so `saveInline` knows if the current inline field uses time formatting. The simplest approach: normalize inside `saveInline` by checking if `inlineField` is one of the time fields (e.g., `departure_time`), or pass the `timeFormat` option through to the save function.

### Technical Detail

The `normalizeTime` utility already handles all the formats ("1" → "1:00 PM", "330" → "3:30 PM", "1530" → "3:30 PM", etc.). It just needs to be applied at save time, not only on blur. I'll store the current field's options in a ref so `saveInline` can access them.

Two lines changed, one small addition to `saveInline`.

