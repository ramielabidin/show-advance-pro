

## Add Deal & Venue Fields to Shows + Update CSV Importer

### What changes

Add 11 new columns to the `shows` table and wire them through the entire stack: database → types → detail page → CSV importer.

### New database columns (all nullable text)

| Column | Maps to CSV | Group |
|--------|------------|-------|
| `venue_capacity` | Cap | Venue details |
| `ticket_price` | Ticket Price | Venue details |
| `age_restriction` | Age | Venue details |
| `guarantee` | Guarantee | Financial |
| `backend_deal` | Backend Deal | Financial |
| `hospitality` | Hospitality | Production |
| `support_act` | Support Act | Production |
| `support_pay` | Support Pay | Production |
| `merch_split` | Merch Split | Production |
| `walkout_potential` | Walkout Potential | Projections |
| `net_gross` | Net Gross | Projections |
| `artist_comps` | Artist Comps | Projections |

All text type since values are often mixed formats (e.g. "$20/$25", "vs 60% of GBOR", "TBD").

### Files to change

| File | Change |
|------|--------|
| **DB migration** | `ALTER TABLE shows ADD COLUMN` for all 12 new fields |
| `src/lib/types.ts` | Add the 12 new optional fields to the `Show` interface |
| `src/pages/ShowDetailPage.tsx` | Add new FieldGroups: "Venue Details", "Deal Terms", "Production", "Projections" in both view and edit modes |
| `src/components/BulkUploadDialog.tsx` | Add the new column names to `TEMPLATE_COLUMNS`, map CSV headers to DB columns (handle the header row format from the real CSV — e.g. "Ticket Price" → `ticket_price`) |
| `src/components/ShowCard.tsx` | Optionally show capacity or guarantee as a subtitle line |

### CSV importer updates

The uploaded CSV has a different header format than the template (e.g. "Ticket Price" not "ticket_price", plus extra header rows). The importer already normalizes headers via `transformHeader` (lowercasing + replacing spaces with underscores), so most columns will auto-map. We'll add the new column names to `TEMPLATE_COLUMNS` and handle the mapping in the import mutation (e.g. `cap` → `venue_capacity`, `age` → `age_restriction`).

### Detail page layout

New sections added after existing fields:

- **Venue Details**: Capacity, Ticket Price, Age Restriction
- **Deal Terms**: Guarantee, Backend Deal
- **Production & Logistics**: Hospitality, Support Act, Support Pay, Merch Split
- **Projections**: Walkout Potential, Net Gross, Artist Comps

