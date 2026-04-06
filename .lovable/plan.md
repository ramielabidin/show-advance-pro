

## Bulk CSV Upload for Shows

Add a "CSV Upload" button to the Shows page that lets you upload a spreadsheet of shows in one go.

### How it works

1. Click **Import CSV** on the Shows page
2. A dialog opens with a drag-and-drop file zone and a link to download a template CSV
3. Upload a `.csv` file with columns like: `date`, `venue_name`, `city`, `venue_address`, `tour_name` (optional), plus any other show fields
4. The app previews the parsed rows in a table so you can review before committing
5. Click **Import** to bulk-insert all rows into the database
6. If a `tour_name` is provided, it matches to an existing tour (or creates one)

### CSV Template columns

`date, venue_name, city, venue_address, dos_contact_name, dos_contact_phone, hotel_name, hotel_address, tour_name`

### Technical details

- **New component**: `src/components/BulkUploadDialog.tsx`
  - File input accepting `.csv` files
  - Client-side CSV parsing using `papaparse` (lightweight, already common in JS projects)
  - Preview table showing parsed rows with validation (highlight missing required fields: date, venue_name, city)
  - Tour name resolution: query existing tours, match by name, optionally create new ones
  - Bulk insert via `supabase.from("shows").insert([...rows])`
  - Success toast with count of imported shows

- **ShowsPage.tsx**: Add the `BulkUploadDialog` button next to "Paste Advance" and "Add Show"

- **Template download**: Generate a small CSV template string as a downloadable blob link inside the dialog

- **Dependency**: Install `papaparse` + `@types/papaparse` for reliable CSV parsing (handles quoted fields, commas in values, etc.)

### Validation rules
- Skip empty rows
- Require `date`, `venue_name`, and `city` per row
- Show error count in preview if any rows are invalid
- Only enable the Import button when all rows pass validation

