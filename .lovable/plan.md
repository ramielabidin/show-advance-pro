

## Fix Slack Day Sheet to Include All Show Fields

### Problem
The `formatDaySheet` function in `push-slack-daysheet` was written before the 17 new columns were added (venue details, deal terms, production, projections, band/performance). It only formats the original fields — and since this CSV-imported show only has data in the newer columns (e.g. guarantee = "$500"), the Slack message shows just the header.

### Solution
Update `formatDaySheet` in `supabase/functions/push-slack-daysheet/index.ts` to include sections for all the new field groups:

| New Section | Fields |
|-------------|--------|
| **Band / Performance** | `set_length`, `curfew`, `changeover_time`, `backline_provided`, `catering_details` |
| **Venue Details** | `venue_capacity`, `ticket_price`, `age_restriction` |
| **Deal Terms** | `guarantee`, `backend_deal` |
| **Production** | `hospitality`, `support_act`, `support_pay`, `merch_split` |
| **Projections** | `walkout_potential`, `net_gross`, `artist_comps` |

Each section follows the existing pattern: only render the block if at least one field in the group has a value.

### Files to change

| File | Change |
|------|--------|
| `supabase/functions/push-slack-daysheet/index.ts` | Add formatting blocks for all 5 new field groups in `formatDaySheet()` |

### No other changes needed
The edge function already does `select("*, schedule_entries(*)")` which returns all columns including the new ones — we just need to format them.

