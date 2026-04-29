# Dashboard Simplification — Design Spec

**Status:** Approved, ready for implementation plan
**Date:** 2026-04-28
**Branch:** new branch off `main` (suggested: `claude/dashboard-simplification`)

## Goal

Make the dashboard quiet and focused. It becomes "what's next" — a single chronological view of upcoming shows, with the today's-show featured at the top. No financial information, no progress bars, no scope filtering.

The current dashboard tries to be three things at once: a "what's next" feed, a financial summary, and a progress tracker. The financial summary and progress tracker have low value in their current form (taxes are tracked elsewhere, per-show progress is visible on the row's status dot, per-tour rollup belongs on `/shows` via `TourRevenueSimulator`). Stripping them frees the dashboard to be the one thing it's actually good at: showing the user the next shows on the calendar with a clean visual rhythm.

## Design principle

**Financials are tour-scoped or show-scoped, never account-scoped.** The dashboard is account-scoped, so financials don't belong here. Tour-scoped financials remain on `/shows` (when a tour is selected) via the existing `TourRevenueSimulator`. Per-show financials live on the show detail page.

## What stays

- Route at `/`, same data fetch (`useQuery(["shows"])`, `useQuery(["tours", "with-shows"])`)
- The header pattern: date eyebrow → greeting line → utility actions (`BulkUploadDialog` + `CreateShowDialog`, admin-only)
- A featured "Tonight" / "Next Show" card at the top of the content
- A flat chronological list of upcoming shows below it
- `DayOfShowMode` overlay launches the same component
- All consumed components keep working as-is: `ShowCard`, `BulkUploadDialog`, `CreateShowDialog`, `DayOfShowMode`, `StatusDot`, `StatusLegend`, `SectionLabel`
- Stagger animation on the list

## What's removed

- **Scope pills** (`Tour` / `Standalone` / `All Shows`) — entirely gone, including `TourPicker` rendering on this page
- **Progress card** (`Advanced` / `Settled` bars and tooltips) — gone
- **Revenue card** (`Earned` / `Upcoming` / upside, collapsed/expanded states) — gone
- **PastTourCard** recap — gone (no scope means no past-tour-only state)
- The **tappable-headline-with-mic** pattern on show day — replaced by the floating DOS button (the headline becomes a plain `h1` always)
- All scope-derivation logic: `parseScope`, `autoPickedTourId`, `scope` / `activeTourId` resolution, `setScopeTour` / `setScopeStandalone` / `setScopeUpcoming` / `clearTourScope`, `isPastTour`
- All financial-derivation logic: `dashCards` memo, `projectedUpside` helper, `fmtMoney`, `parseDollar` import, `SETTLED_WINDOW_MONTHS`, `UPSIDE_TOOLTIP`
- The `?scope=` and `?tourId=` URL params on the dashboard (replaced by no params — the page is one canonical view)

## What's added

### 1. Tour chip on the featured card

Small inline pill next to the venue name when the show belongs to a tour. Matches the mock ("Spring Routing"). Uses `var(--pastel-blue-bg)` / `var(--pastel-blue-fg)` to match the existing tour-chip palette on `ShowCard`.

### 2. Tour chip on list rows

The current `ShowCard` already supports `chip="tour" | "standalone" | "none"`. We pass `chip="tour"` when the show has a `tour_id` and `chip="none"` otherwise. **No "Standalone" chip on the dashboard** — without scope context, that label is noise.

### 3. Client-side infinite scroll on the upcoming list

- Initial render: 10 upcoming shows (excluding the featured one if it's the next upcoming)
- Sentinel `<div>` after the last rendered card, observed by `IntersectionObserver`
- When sentinel intersects the viewport, increment the visible count by 10
- All shows are already in memory (single query); no network pagination
- The "View all shows →" link to `/shows` is always rendered at the bottom of the visible list (with the existing `SectionLabel` action treatment)
- The IntersectionObserver sentinel sits above the View-all link and is unmounted once `visibleCount >= upcomingShows.length`

### 4. Floating Day of Show pill

- New component: `src/components/DayOfShow/DayOfShowFloatingButton.tsx`
- Position: `fixed bottom-20 right-4` (above the mobile bottom tab bar, which is `pb-16` + safe area)
- Style: pill with `Mic` icon and "Day of Show" label, blue glow using the existing `day-of-active-pulse` class and `--day-of-active` color token
- Visible: mobile only (`md:hidden`), only when `showToday` is set, only on the dashboard page
- Tap: opens `DayOfShowMode` overlay
- Replaces the tappable-headline-with-mic pattern on show day. The headline returns to a plain `h1` for both show and non-show days.

### 5. Search icon in mobile top bar

- Position: between wordmark and theme toggle in the mobile top bar (`AppLayout.tsx` mobile header)
- Action: `navigate("/shows", { state: { focusSearch: true } })`
- On `/shows`, read `location.state?.focusSearch` on mount via `useEffect` and focus the search `Input` via a ref
- After focusing, clear the state with `navigate(".", { replace: true, state: null })` so a refresh doesn't re-focus
- **Theme toggle and sign-out stay** in the mobile top bar (no relocation to Settings)

## Files touched

| File | Change |
|------|--------|
| `src/pages/DashboardPage.tsx` | Major reduction (~1100 → ~300 lines). Strip all scope/financial/progress logic and inline subcomponents. Render header → featured → infinite-scroll list → optional floating DOS button. |
| `src/components/AppLayout.tsx` | Add search icon to mobile top bar (`md:hidden` header), wired to `navigate("/shows", { state: { focusSearch: true } })`. |
| `src/pages/ShowsPage.tsx` | Add `useEffect` on mount that reads `location.state?.focusSearch` and focuses the search `Input` (via `useRef`). |
| `src/components/DayOfShow/DayOfShowFloatingButton.tsx` | **New file.** Mobile-only fixed-position pill that mounts when there's a show today. Owns the open/close state for `DayOfShowMode`. |
| `src/components/FeaturedShowCard.tsx` | **New file.** Extract from inline `FeaturedShowCard` in `DashboardPage.tsx`. Add `tour` prop for the inline tour chip. |

## Behavior details

### Featured card mode

Without scope, the featured card has only two modes:

- **`today`** — there is a show today (or yesterday if past midnight before 4 AM, matching existing `showToday` logic). Section label: `Tonight`.
- **`next`** — no show today, but there are upcoming shows. Section label: `Next Show`.

If there are no upcoming shows at all, the featured card section is omitted entirely.

The "Final Show" mode is removed (it only appeared in past-tour scope, which is gone).

### List

- Source: all shows where `isUpcomingDate(s.date)` is true, sorted ascending by date (already the order from the query)
- Excludes the featured show (the first upcoming) — it's already shown above
- Initial render: first 10
- IntersectionObserver sentinel reveals the next 10 each time it enters the viewport
- Each card uses the existing `ShowCard` component with `chip="tour"` if `show.tour_id` else `chip="none"`

### Empty states

- **No shows at all** — same as today: `Calendar` icon + "No shows yet — add your first one to get started."
- **No upcoming shows but past shows exist** — new copy: "All caught up — no upcoming shows on the calendar." With a `CreateShowDialog` CTA (admin only).
- The current dashboard's "no upcoming/no recent" inline tooltips are removed along with the cards they're attached to.

### Show day cliff

Existing logic preserved: `showToday` matches `today's date` OR `yesterday's date if before 4 AM`. The featured card and floating DOS button both gate on this. Settled-today shows still match (the user re-enters DOS to see Phase 3).

### Artist role

The existing `isArtist` gating becomes simpler:

- Header utility actions (Bulk Upload + Create Show) — admin only (unchanged)
- Empty-state CTA — admin only
- Everything else — same for both roles, since all financial gating is removed by virtue of removing the financials

The Day of Show flow's existing artist-vs-admin behavior (artists skip Phase 2) is unchanged.

### Routing

- Dashboard URL is canonical `/` — no query params
- Existing inbound links to `/?scope=tour&tourId=X` from elsewhere in the app: search the codebase and convert to `/shows?view=tour&tourId=X` (or remove if dashboard-only). Likely candidates: links in `TourScopedHeader`, `ShowCard`, etc.

## What does NOT change in this work

- `/shows` page (other than the small `focusSearch` mount-effect)
- `TourRevenueSimulator` on `/shows` when a tour is selected — tour-scoped financials remain
- Show detail page
- Day of Show flow internals (Phase 1 / 2 / 3, Settle, PostSettle)
- Bulk upload, create show, parse advance flows
- Desktop top nav (sidebar / top bar pattern stays)
- Settings page

## Out of scope (future work)

- **`/shows` redesign as searchable historical log** — separate brainstorm. The decision that aggregate financials drop applies here too, but the visual redesign of the historical log is its own task.
- **Hybrid time-band grouping** — if the flat list ever feels too long, add `THIS WEEK` / `NEXT WEEK` / `LATER` headers. Defer until there's evidence of need.
- **App-wide floating DOS button** — currently dashboard-only. If users want it on `/shows` and Settings during a show day, broaden the surface.
- **Desktop nav rethink** — out of scope; desktop currently uses the same nav links plus theme/sign-out and works.
- **Search-icon richer behavior** — for now it just navigates and focuses. If `/shows` later gets richer search (tour names, year filters, settled-only), the icon inherits it for free.

## Risks and edge cases

- **Inbound `/?scope=...` links from elsewhere in the app** — must be audited and converted before merge. If left in place, they 404-into-canonical (the dashboard ignores them) — not breaking, but a stale link. Audit with a grep for `scope=` and `tourId=` references.
- **Many upcoming shows (50+)** — infinite scroll is purely client-side render gating. If the in-memory dataset itself is huge, query performance is the bottleneck, not render. Not changed by this work.
- **Show today is settled** — currently the dashboard still shows the today card. We preserve this behavior (artist re-enters DOS to see Phase 3).
- **Past midnight, before 4 AM** — yesterday's show is still "today" via existing `showToday` logic. Floating button and featured card both honor it.
- **No tours exist** — without scope pills, this is a non-event. The page just shows upcoming shows.

## Verification

Manual QA before merge:

- [ ] Dashboard renders cleanly with no shows, with shows but none upcoming, with one upcoming, with 11+ upcoming (infinite scroll triggers)
- [ ] Featured card shows correct label (`Tonight` / `Next Show`) for each case
- [ ] Tour chip appears on featured card and list rows when applicable
- [ ] On show day (mobile), floating DOS button appears bottom-right, pulses, opens overlay
- [ ] On non-show day, no floating button visible
- [ ] On desktop, no floating button visible regardless
- [ ] Mobile top-bar search icon navigates to `/shows` and focuses the search input
- [ ] Refreshing `/shows` after focus does not re-focus
- [ ] Theme toggle and sign-out still work on mobile
- [ ] Artist role: same view, no admin-only CTAs visible
- [ ] No `?scope=` query params appear in URL on dashboard navigation

Lint and typecheck must pass. No new dependencies.
