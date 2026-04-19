# CLAUDE.md

## App Overview

**Advance** is a tour management app for independent musicians. Core features: dashboard, shows (create/edit/advance/settle), tours, settings (team, documents, contacts, Slack, email forwarding), PDF/email advance parsing, and show PDF/email/Slack export.

Currently pre-launch, transitioning from personal tool to SaaS product. The UI is the product — output quality (PDFs, emails, Slack messages) must match in-app quality.

## Project context

Always consult `ROADMAP.md` (at the repo root) before proposing significant feature work or architectural changes — it is the source of truth for product direction, pricing, roles/permissions, and phase priorities.

### Current phase

We are **pre-launch, still hardening core functionality**. The app is a working single-tenant tool (one team, one artist, one set of crew) being turned into a SaaS product. Multi-tenancy, billing, and role-based access control are **planned but not yet built**.

What this means for day-to-day work:

- **Prioritize core feature quality** — show advancing, day sheets, tour management, exports. Making these feel great is the current job.
- **Don't build scaffolding for unshipped tiers.** Do not add free-tier gating, per-tier feature flags, artist switchers, or RBAC checks unless the task explicitly calls for them. Premature abstraction here is expensive to unwind.
- **Do keep future tiers in mind when shaping the data model.** When adding new tables or columns, shape them so the planned changes (see ROADMAP Phase 2 — `account`, `artist`, `account_artist` tables, tier enforcement, RBAC) can slot in without a migration marathon. When in doubt, mirror the existing `team_id` + RLS pattern.
- **Roles today are just `owner` / `member` on `team_members`.** The Admin / Crew / Artist / Guest model in ROADMAP.md is future state. Don't write code against roles that don't exist yet.
- **Free-tier show cap is planned, not live.** There is currently no 30-show enforcement. Don't add it ad hoc — it's a Phase 2 feature that needs the `account` table first.

### Key product principles (from ROADMAP)

- **"The UI is the product."** Advance's moat is that it's genuinely nice to use. Outputs (PDFs, emails, Slack messages) must match in-app quality.
- **"Manual is fine, beautiful is mandatory."** Automation is a convenience, not a differentiator. A sleek manual workflow beats a clunky automated one.
- **Guests are first-class.** Most people who interact with tour data (promoters, venue contacts, show-day crew) will never log in. Magic-link guest access and great transactional emails are how the product spreads.
- **No anti-exploit logic on edits.** When tier enforcement does land, deleting a show will not return a slot and editing a show will not affect any counter. Do not add validation that makes legitimate edits (reschedules, routing changes) feel hostile.

## Tech Stack

- **React 18 + TypeScript** (Vite, path alias `@/` → `src/`)
- **Routing**: React Router v6 — routes defined in `src/App.tsx` (not `main.tsx`)
- **Data fetching**: TanStack React Query v5 + Supabase JS client
- **Forms**: React Hook Form + Zod (via shadcn `<Form />` wrapper)
- **UI components**: shadcn UI in `src/components/ui/`, built on Radix UI primitives
- **Icons**: Lucide React
- **Toasts**: Sonner (`toast.success()` / `toast.error()`)
- **Drawers**: Vaul
- **Dark mode**: next-themes (class-based)
- **Fonts**: DM Sans (body), DM Serif Display (display), JetBrains Mono (mono)
- **Dates**: `date-fns` (used everywhere — `format`, `parseISO`, `isPast`, `isToday`, `differenceInCalendarDays`)
- **PDF generation**: `jspdf` (in `ExportPdfDialog.tsx`)
- **PDF text extraction**: `pdfjs-dist` (in `src/lib/pdfExtract.ts`)
- **CSV parsing**: `papaparse` (in `BulkUploadDialog.tsx`)
- **PWA**: `vite-plugin-pwa` with custom update prompt (`PWAUpdatePrompt.tsx`)
- **Analytics**: `@vercel/speed-insights`
- **Testing**: `vitest` + `@testing-library/jest-dom` (setup in `src/test/setup.ts`)
- **TypeScript config**: `strict: false`, `noImplicitAny: false` — don't add strict types where the rest of the codebase doesn't use them

## Project Structure

```
src/
  pages/           # Route-level components (*Page.tsx)
  components/
    ui/            # shadcn primitives — don't edit these directly
    *Provider.tsx  # Context providers (AuthProvider, TeamProvider, PendingEmailsProvider)
    *Dialog.tsx    # Modal workflows (self-contained with state + mutations)
    *Editor.tsx    # Complex form sections
  hooks/           # Custom hooks (use*.ts)
  integrations/supabase/
    client.ts      # Supabase client (typed with Database type)
    types.ts       # Auto-generated DB types
  lib/
    types.ts              # Domain types (Show, Tour, ScheduleEntry, etc.)
    utils.ts              # cn, normalizePhone, formatCityState
    timeFormat.ts         # normalizeTime — canonical time parser
    pdfExtract.ts         # extractTextFromPdf (uses pdfjs-dist)
    saveParsedShow.ts     # Canonical "save AI-parsed show" (insert or update by venue+date)
    daysheetSections.ts   # Shared section list + hasData() for PDF/Email/Slack exports
supabase/
  migrations/      # Numbered SQL migrations
  functions/       # Edge functions (auto-deployed on push to main — see below)
.github/workflows/
  deploy-supabase-functions.yml  # Auto-deploys all edge functions on push to main
```

**Naming conventions:**
- Route pages → `*Page.tsx`
- Modal workflows → `*Dialog.tsx`
- Complex form sections → `*Editor.tsx`
- Custom hooks → `use*.ts`

## Data Fetching

Always wrap Supabase calls in React Query:

```ts
// Queries
const { data } = useQuery({
  queryKey: ["shows", teamId],
  queryFn: async () => {
    const { data, error } = await supabase.from("shows").select("*").eq("team_id", teamId);
    if (error) throw error;
    return data;
  },
  enabled: !!teamId,
});

// Mutations — always invalidate on success
const mutation = useMutation({
  mutationFn: async (payload) => {
    const { error } = await supabase.from("shows").insert(payload);
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["shows"] });
    toast.success("Show created");
  },
  onError: (err: Error) => toast.error(err.message),
});
```

**Query key conventions:** `["shows"]`, `["show", id]`, `["tours"]`, `["band-documents", teamId]` — invalidate the top-level key to bust all related queries.

## Auth & Team Context

- Auth state: `useAuth()` → `{ session, user, loading }`
- Current team: `useTeam()` → `{ team, teamId, isOwner, loading }`
- Always include `team_id` in inserts — Supabase RLS enforces team isolation and will **silently reject rows without it** (no error thrown, just no insert). Missing `team_id` is the #1 source of "my insert succeeded but the row isn't there" bugs.
- All tables have RLS enabled; the service role (edge functions only) bypasses it.
- Team creation goes through the `create_team_with_owner` RPC — don't insert into `teams` directly.

### `team_members` vs `touring_party_members`

These are **two different concepts** — do not conflate:

- **`team_members`**: users with login access to the Advance account (owner + invited members). Used for auth/permissions.
- **`touring_party_members`**: crew directory (artists, managers, drivers, photographers). Used for emailing day sheets and show-level party assignment. These people generally do **not** have logins.

## Show state model

Shows have three independent state flags — each means something different:

- **`is_reviewed`** (bool): User has reviewed the auto-parsed data. Set to `false` on creation from parsed advance / inbound email, `true` on manual creation. Triggers the "New" badge and the yellow review banner.
- **`advanced_at`** (timestamp | null): User has confirmed all show details with the venue. Toggled by "Mark as advanced" button. Drives the dot color on show cards and the Tour Progress bar.
- **`is_settled`** (bool): Show has happened and financials are recorded. Unlocks `actual_walkout`, `actual_tickets_sold`, `settlement_notes` fields. Swaps walkout projections for actuals across the app.

## Edge functions

Located in `supabase/functions/`. Called via `supabase.functions.invoke("<name>", { body })`:

- **`parse-advance`** — AI-parses pasted email / extracted PDF text into show fields + schedule
- **`push-slack-daysheet`** — sends day sheet to connected Slack workspace
- **`calculate-drive-time`** — Google Maps drive time between two points (used on `ShowDetailPage`)
- **`lookup-venue-address`** — resolves a venue name + city into a full address
- **`autocomplete-place`** — Google Places autocomplete (used for Home Base City)
- **`slack-oauth-initiate`** — returns Slack OAuth authorization URL

**Deployment**: all edge functions auto-deploy to `knwdjeicyisqsfiisaic` on push to `main` via `.github/workflows/deploy-supabase-functions.yml`. Manual redeploy is available via the Actions tab. Do **not** assume a function change is live just because it's merged — if the Action failed, the old version is still running.

## Established patterns

Follow these patterns — they're load-bearing across the codebase.

### Inline editing (see `ShowDetailPage.tsx`)

Field-level editing uses a single `inlineField` state variable + `inlineValue`. The `editField(key, label, opts)` helper renders either a clickable `FieldRow` or an inline editor. Empty fields render `<EmptyFieldPrompt>`. Use `startInlineEdit()` / `saveInline()` / `cancelInline()`. New editable fields on `ShowDetailPage` must use this pattern — do not introduce separate edit modals.

### Dialog composition via `trigger` prop

Action dialogs (`EmailBandDialog`, `SlackPushDialog`, `ExportPdfDialog`, `ParseAdvanceForShowDialog`, `BulkUploadDialog`) accept an optional `trigger?: React.ReactNode` prop so they can be embedded inside a `DropdownMenu` without rendering their default button. When adding a new action dialog, support this prop.

### AI-parsed show persistence

Use `saveParsedShow(parsed, teamId)` from `src/lib/saveParsedShow.ts` — it handles the match-by-`venue_name`+`date` upsert logic and schedule replacement. Do not reimplement this in new flows. Currently used by `CreateShowDialog` and the inbound email review flow.

### Day sheet exports

Email and Slack are full day sheets; the PDF is intentionally not.

- **Email (`EmailBandDialog`) and Slack (`push-slack-daysheet`)** render the same section list from `src/lib/daysheetSections.ts`. Any new section-driven export format must import `DAYSHEET_SECTION_KEYS` and `hasData()` and render in the defined order, skipping sections where `hasData()` returns false. Financial / business-side sections are intentionally excluded from band-facing exports.
- **PDF (`ExportPdfDialog`)** is a different artifact: a single-page "Run of Show" poster meant to be printed and taped to the green-room wall. It deliberately omits the bulk of the day sheet (load in, parking, hotel, guest list, etc. — all of which live in email/Slack) and features the schedule at large scale. Don't "fix" the divergence by wiring it back into `daysheetSections.ts` — the split is intentional. Keep the PDF clean, single-page, and poster-legible.

### `is_band` on schedule entries

`schedule_entries.is_band` marks which row is the band's actual performance slot (as opposed to load in, soundcheck, doors, opener, curfew, etc.). At most one entry per show should be flagged. It's set by the AI parser (`parse-advance`) and toggleable in `ScheduleEditor` via the mic icon. Exports use it to attach `show.set_length` inline to the band's row and (in the PDF) to color that row with the accent. Never infer the band's row from the label text — use the flag.

### URL as state for list pages

`ShowsPage` and `DashboardPage` store scope/view/tourId in `useSearchParams`. New list or dashboard pages should follow this — it makes views shareable and survives refresh.

### CSV bulk import — protected fields

`BulkUploadDialog` explicitly never overwrites: `is_settled`, `actual_walkout`, `actual_tickets_sold`, `settlement_notes`. These are post-show outcomes and must not be clobbered by re-importing a schedule CSV. If you add new post-show fields, add them to `PROTECTED_FIELDS`.

### Data normalization helpers

Reuse, don't reimplement:

- `normalizePhone(raw)` — phone → `(XXX) XXX-XXXX` format (`src/lib/utils.ts`)
- `formatCityState(city)` — display-format `"City, ST"` and strips trailing asterisks (`src/lib/utils.ts`)
- `normalizeTime(raw)` — free-text time → `"H:MM AM/PM"` (`src/lib/timeFormat.ts`)
- `formatCurrency(raw)` — dollar string → display format (`ShowDetailPage.tsx`)
- `parseDollar`, `parseBackendPct`, `parseBackendType`, `parseTieredDeal` — all exported from `RevenueSimulator.tsx`

## Error Handling

Use toast callbacks on mutations, not try/catch with console.log:

```ts
onSuccess: () => toast.success("Saved"),
onError: (err: Error) => toast.error(err.message),
```

For Supabase queries outside mutations, throw the error and let React Query surface it:

```ts
if (error) throw error;
```

## UI & Design

When making any frontend changes — components, pages, modals, layouts, styling — read and follow `docs/design-system.md` before writing any code.

For logic-only changes (edge functions, migrations, Supabase queries, API routes, utility functions, type definitions), skip the design system doc entirely.

The app uses a dark-mode-first aesthetic (light-mode is also available). Key principles:
- Dark backgrounds, high contrast typography
- Minimal, utilitarian UI — no decorative gradients or heavy shadows
- Smooth, intentional micro-animations (not gratuitous)
- Every user-facing detail should feel considered

Output quality is part of the product — PDFs, emails, and Slack messages must match in-app visual quality. Before changing an exporter, eyeball the current output (download the PDF, check the Gmail preview) so the new version is a strict improvement.

## Testing

Vitest is configured (`src/test/setup.ts`, example test at `src/test/example.test.ts`). For non-trivial logic — parsers, normalizers, matchers like the one in `BulkUploadDialog` — add tests alongside. Run via `npm test` / `npx vitest`.
