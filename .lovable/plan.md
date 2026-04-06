

## Add Band Day-of-Show Fields to Shows

Add 5 new fields to the `shows` table for information typically found in advance emails but not on booking spreadsheets.

### New columns (all nullable text)

| Column | Label | Purpose |
|--------|-------|---------|
| `set_length` | Set Length | e.g. "75 min", "60-90 min" |
| `curfew` | Curfew | Stage/venue curfew time |
| `backline_provided` | Backline Provided | What gear the venue supplies |
| `catering_details` | Catering / Meals | Meal times, buyouts, rider info |
| `changeover_time` | Changeover Time | Time between acts |

### Files to change

| File | Change |
|------|--------|
| **DB migration** | `ALTER TABLE shows ADD COLUMN` for 5 fields |
| `src/lib/types.ts` | Add 5 optional string fields to `Show` interface |
| `src/pages/ShowDetailPage.tsx` | Add a new "Band / Performance" FieldGroup with the 5 fields (view + edit modes) |
| `supabase/functions/parse-advance/index.ts` | Add the 5 fields to the AI tool schema so they get extracted from advance emails automatically |

### Detail page placement

A new **"Band / Performance"** section will appear after the existing schedule section, containing: Set Length, Curfew, Changeover Time, Backline Provided, and Catering / Meals (multiline).

### Advance email parser

The `parse-advance` edge function's tool schema will include the new fields so pasting an advance email auto-populates set length, curfew, backline, catering, and changeover when mentioned.

