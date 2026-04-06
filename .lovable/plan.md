

## Better Tour ↔ Show Management

### What already works
- Creating a show with a tour assignment (CreateShowDialog has tour dropdown)
- Adding/removing standalone shows on TourDetailPage
- CSV bulk upload with `tour_name` column

### What to add

**1. Tour selector on ShowDetailPage (edit mode)**
- Add a tour dropdown in the show edit form so you can reassign or remove a show from a tour without leaving the page
- Query existing tours, show current assignment, allow changing to another tour or "Standalone"

**2. "Add Show" button on TourDetailPage that pre-fills tour**
- Render the existing `CreateShowDialog` component with `defaultTourId={tour.id}` on the tour detail page
- This already works — just needs to be wired up in the UI alongside the existing "link standalone show" dropdown

**3. Tour pre-select option in BulkUploadDialog**
- Add an optional tour dropdown at the top of the dialog (before/after file upload)
- If a tour is selected there, all imported rows get that `tour_id` unless the CSV row has its own `tour_name` (CSV column takes priority)
- Reuse the existing tours query already in the component

### Files to change

| File | Change |
|---|---|
| `src/pages/ShowDetailPage.tsx` | Add tour `<Select>` in edit mode, query tours list, include `tour_id` in save payload |
| `src/pages/TourDetailPage.tsx` | Add `<CreateShowDialog defaultTourId={tour.id} />` button next to the "Add existing show" UI |
| `src/components/BulkUploadDialog.tsx` | Add optional tour dropdown above the file drop zone; apply selected tour_id to rows missing a tour_name |

