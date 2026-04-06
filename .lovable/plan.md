

## Bug: Show update fails because `tours` relation is sent in PATCH body

**Root cause:** When you click Save, the update mutation strips `schedule_entries` and `show_party_members` from the form data, but it doesn't strip `tours` (the joined relation from the query). Supabase rejects the PATCH because `tours` isn't a column on the `shows` table.

The error from the API: `Could not find the 'tours' column of 'shows' in the schema cache`

## Fix

**File: `src/pages/ShowDetailPage.tsx`** — In the `updateMutation`, also strip `tours` from the update payload:

```typescript
// Line ~68: change destructuring to also exclude `tours`
const { schedule_entries, show_party_members, tours, ...showUpdates } = updates as any;
```

One-line fix. That's it.

