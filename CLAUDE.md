# CLAUDE.md

## App Overview

**Advance** is a tour management app for independent musicians. Core features: dashboard, shows (create/edit/advance/settle), tours, settings (team, documents, contacts, Slack, email forwarding), PDF/email advance parsing, and show PDF/email/Slack export.

Currently pre-launch, transitioning from personal tool to SaaS product. The UI is the product — output quality (PDFs, emails, Slack messages) must match in-app quality.

**Production domain is `advancetouring.com`** (served from `app.advancetouring.com` for the app). Some older design handoff mocks use the placeholder `advance.fm` — that is **not** the real domain and should not appear in shipped copy, emails, or UI.

## Project context

Always consult `ROADMAP.md` (at the repo root) before proposing significant feature work or architectural changes — it is the source of truth for product direction, pricing, roles/permissions, and phase priorities.

### Current phase

We are **pre-launch, still hardening core functionality**. The app is a working single-tenant tool (one team, one artist) being turned into a SaaS product. Multi-tenancy and billing are **planned but not yet built**; a minimal two-role RBAC (`admin` / `artist`) is live.

What this means for day-to-day work:

- **Prioritize core feature quality** — show advancing, day sheets, tour management, exports. Making these feel great is the current job.
- **Don't build scaffolding for unshipped tiers.** Do not add free-tier gating, per-tier feature flags, or artist switchers unless the task explicitly calls for them. Premature abstraction here is expensive to unwind.
- **Do keep future tiers in mind when shaping the data model.** When adding new tables or columns, shape them so the planned changes (see ROADMAP Phase 2 — `account`, `artist`, `account_artist` tables, tier enforcement) can slot in without a migration marathon. When in doubt, mirror the existing `team_id` + RLS pattern.
- **RBAC is two roles, on `team_members.access_role`: `admin` and `artist`.** Admins have full access. Artists are blocked from: deal / settle / revenue-simulator surfaces, integrations / team / touring-party settings, outbound shares (email day sheet, Slack push, mint guest link), and structural edits (create / delete show, import advance, bulk upload, tour CRUD). Artists can still edit show data (schedule, contacts, guest list, notes, set list) and download PDF day sheets. In Day of Show, artists skip Phase 2 (Settle) entirely and land on Phase 3 (hotel reveal) at the same `set + 90 min` trigger that promotes admins to settle. Use `role` / `isArtist` from `useTeam()` to gate; new admin-only surfaces should read those rather than reimplementing the check. The existing `team_members.role` (`owner` / `member`) is a separate concept controlling team ownership and stays untouched. An `owner` always has `access_role = 'admin'` in practice.
- **Free-tier show cap is planned, not live.** There is currently no 30-show enforcement. Don't add it ad hoc — it's a Phase 2 feature that needs the `account` table first.

### Key product principles (from ROADMAP)

- **"The UI is the product."** Advance's moat is that it's genuinely nice to use. Outputs (PDFs, emails, Slack messages) must match in-app quality.
- **"Manual is fine, beautiful is mandatory."** Automation is a convenience, not a differentiator. A sleek manual workflow beats a clunky automated one.
- **Guests are first-class.** Most people who interact with tour data (promoters, venue contacts, show-day crew) will never log in. Magic-link guest access and great transactional emails are how the product spreads.
- **No anti-exploit logic on edits.** When tier enforcement does land, deleting a show will not return a slot and editing a show will not affect any counter. Do not add validation that makes legitimate edits (reschedules, routing changes) feel hostile.

## Branch Discipline

**This is the most important workflow rule.** Multiple parallel Claude sessions run on this repo, and commits landing on the wrong branch — or on top of another session's in-flight work — has been the single biggest source of friction. Before any commit:

- ALWAYS verify the current branch with `git branch --show-current` before making commits
- NEVER commit to an existing PR branch without explicit confirmation it's the right one
- When starting new work, create a fresh branch off latest main: `git checkout main && git pull && git checkout -b <new-branch>`
- Before pushing, verify commits aren't entangled with another agent's in-flight work (`git log main..HEAD --oneline` — every line should be yours)
- If the harness routes you back to a different branch mid-session, stop and re-confirm before continuing edits

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
- **TypeScript config**: `strict: true`, `noImplicitAny: true` (in `tsconfig.app.json`, along with `noUnusedLocals`/`noUnusedParameters`). Types are enforced — don't reach for `any` as an escape hatch. Prefix deliberately unused parameters with `_` to satisfy the lint rule.

## Environment & Commands

**Env vars** (only two — don't invent new `VITE_*` flags; feature toggles are not wired in):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

See `.env.example`. Everything else lives in Supabase Edge Function secrets, not the client.

**Scripts** (from `package.json`):

- `npm run dev` — Vite dev server (port 8080 by default)
- `npm run build` / `npm run build:dev`
- `npm run lint` — ESLint (react-hooks + react-refresh plugins; unused vars allowed only when prefixed `_`)
- `npm test` — Vitest (one-shot) / `npm run test:watch`
- `npm run check:supabase` — sanity check in `scripts/check-supabase.js`; run before pushing when migrations or env are in play

**Supabase types**: `src/integrations/supabase/types.ts` is **generated** from the live schema. Do not hand-edit — regenerate with the Supabase CLI (`supabase gen types typescript ...`) after migrations land.

## Git workflow

- Develop on short-lived feature branches; the harness names them by task (`claude/<slug>`). Never push directly to `main`.
- When you push a feature branch, open a PR against `main` with a short summary and a test-plan checklist. The Claude Code desktop UI prompts for this on every new branch anyway — opening it proactively saves a click. Don't create one for experimental branches you don't intend to ship.
- Don't merge your own PRs and don't force-push to `main` — the user reviews and merges.

## Project Structure

```
src/
  pages/           # Route-level components (*Page.tsx)
    GuestShowPage.tsx        # /guest/:token entry — resolves link_type, dispatches to guest view
    show-detail/             # Sub-hooks extracted from ShowDetailPage (e.g. useGroupEditor)
  components/
    ui/            # shadcn primitives — don't edit these directly
    guest/         # Public guest-link views — GuestLayout, DaysheetGuestView, DoorListGuestView, GuestGuestList
    *Provider.tsx  # Context providers (AuthProvider, TeamProvider, PendingEmailsProvider)
    *Dialog.tsx    # Modal workflows (self-contained with state + mutations)
    *Editor.tsx    # Complex form sections (ScheduleEditor, GuestListEditor, ContactsEditor, RevenueSimulator, TourRevenueSimulator)
    AppLayout.tsx  # Shell layout wrapping authenticated routes
    CopyGuestLinkButton.tsx  # Mint / copy / revoke a guest magic link from a show
  hooks/           # Custom hooks (use-mobile, use-toast, usePullToRefresh)
  integrations/supabase/
    client.ts      # Supabase client (typed with Database type)
    types.ts       # Auto-generated DB types — regenerate, never hand-edit
  lib/
    types.ts              # Domain types (Show, Tour, ScheduleEntry, ShowContact, etc.)
    utils.ts              # cn, normalizePhone, formatCityState
    timeFormat.ts         # normalizeTime — canonical time parser
    pdfExtract.ts         # extractTextFromPdf (uses pdfjs-dist)
    saveParsedShow.ts     # Canonical "save AI-parsed show" (insert or update by venue+date)
    daysheetSections.ts   # Shared section list + hasData() for PDF/Email/Slack exports
    guestLinks.ts         # Guest-link helpers (buildGuestUrl, generateGuestLink, revokeGuestLink, fetchGuestShow, GuestShowPayload type)
    contactRoles.ts       # roleLabel() + the role vocabulary for show_contacts
    scheduleMatch.ts      # Shared tight-label matchers for schedule entries (load in, doors, etc.)
    clipboard.ts          # Copy-to-clipboard helper used by CopyButton / CopyGuestLinkButton
  test/
    setup.ts, example.test.ts  # Vitest wiring — suite is sparse today (see Testing below)
supabase/
  migrations/      # Numbered SQL migrations (`YYYYMMDDHHMMSS_short_snake.sql`)
  functions/       # Edge functions (auto-deployed on push to main — see below)
    _shared/rate-limit.ts    # Shared rate-limit helper for abuse-prone functions
scripts/
  check-supabase.js  # Sanity check for env config; wired to `npm run check:supabase`
docs/
  design-system.md # Read before any UI change — see "UI & Design" below
ROADMAP.md         # Source of truth for product direction / phases
.claude/
  skills/advance-design/  # Agent Skill — brand, tokens, UI kit. Read for any UI work (see "UI & Design")
.github/workflows/
  deploy-supabase-functions.yml  # Auto-deploys all edge functions on push to main
```

**Naming conventions:**
- Route pages → `*Page.tsx`
- Modal workflows → `*Dialog.tsx`
- Complex form sections → `*Editor.tsx`
- Custom hooks → `use*.ts`
- Components use **default exports** (`export default function FooBar() { ... }`), matching the shadcn/Vite-template convention already in the tree. Named exports are reserved for utilities and type modules.

### Key files to read first

When a task touches one of these areas, open the file before making changes — they carry the most product logic and the most in-file conventions:

- **`src/pages/ShowDetailPage.tsx`** (~1.5k lines) — show detail, inline editing, all show-level mutations
- **`src/pages/SettingsPage.tsx`** (~1k lines) — team, documents, contacts, Slack, email-forwarding setup
- **`src/components/BulkUploadDialog.tsx`** (~800 lines) — CSV parsing, column mapping, upsert logic
- **`src/pages/DashboardPage.tsx`** — tour-progress UI, URL-as-state filtering
- **`src/components/ParseAdvanceForShowDialog.tsx`** — the AI parse → review → save flow (pairs with `saveParsedShow`)
- **`src/components/ContactsEditor.tsx`** — multi-contact editor (day-of-show, promoter, production, etc.) — read before touching anything contact-related
- **`src/pages/GuestShowPage.tsx`** + **`src/components/guest/*`** — the public guest-link surface. Read before adding any new guest-facing view
- **`src/App.tsx`** — route table + auth gating (read when touching routing)

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
- Current team: `useTeam()` → `{ team, teamId, isOwner, role, isArtist, loading }` — `role` is `"admin" | "artist"`, `isArtist` is a convenience boolean. Gate admin-only UI with `!isArtist` (or the equivalent `role === "admin"`).
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

### Multi-contact per show (`show_contacts`)

Each show can have any number of contacts stored in the `show_contacts` table — this replaced the legacy single-field `dos_contact_*` pattern. There is no longer a "day of show contact" column on `shows`; don't grep for `dos_contact_name` et al.

- Roles (from `src/lib/contactRoles.ts`): `day_of_show`, `promoter`, `production`, `hospitality`, `custom`. `role_label` is free-text, used when `role === "custom"`.
- At most one contact per show should have `role === "day_of_show"` — `ContactsEditor.tsx` enforces this in the UI.
- Sort order convention: `day_of_show = 0` so it renders first; others default higher.
- **Payload shape differs by surface:** the authenticated app reads `show.show_contacts` (joined table, see `Show` in `src/lib/types.ts`). The guest `get_guest_show` RPC returns the same data under `contacts` (flat array, deliberate rename to keep the curated payload simple). Any code that works with both surfaces must accept either — `hasData("contact")` in `daysheetSections.ts` is the reference pattern.
- Format a contact's role for display with `roleLabel(contact)` — respects `role_label` when role is `"custom"`.

## Edge functions

Located in `supabase/functions/`. Called via `supabase.functions.invoke("<name>", { body })`:

- **`parse-advance`** — AI-parses pasted email / extracted PDF text into show fields + schedule
- **`push-slack-daysheet`** — sends day sheet to connected Slack workspace
- **`send-daysheet-email`** — sends the HTML band day sheet via SendGrid. One shared thread (all recipients in `to`), `reply_to` is the caller so replies land in the user's inbox. Requires Supabase secrets `SENDGRID_API_KEY` and `SENDGRID_FROM_EMAIL`. The HTML template lives alongside the function in `supabase/functions/send-daysheet-email/template.ts` and mirrors `DaysheetGuestView` — keep them in visual sync. The section list is duplicated at `supabase/functions/send-daysheet-email/sections.ts` (Deno can't import from `src/`); if you edit `src/lib/daysheetSections.ts`, mirror the change there. **Contact-field gotcha:** the authenticated app reads `show.show_contacts` while the guest `get_guest_show` RPC returns the same data under `contacts` — `hasData("contact")` already accepts either, but any new contact-aware section code must do the same
- **`send-team-invite-email`** — sends the HTML team invite via SendGrid (Dispatch design variant). Gateway JWT verification is intentionally disabled (Slack-style webhook pattern); the function requires the explicit `success` flag in its response body. The template lives at `supabase/functions/send-team-invite-email/template.ts`
- **`calculate-drive-time`** — Google Maps drive time between two points (used on `ShowDetailPage`)
- **`lookup-venue-address`** — resolves a venue name + city into a full address
- **`autocomplete-place`** — Google Places autocomplete (used for Home Base City)
- **`slack-oauth-initiate`** — returns Slack OAuth authorization URL
- **`slack-oauth-callback`** — completes the Slack OAuth handshake and stores workspace credentials
- **`inbound-email`** — webhook for forwarded advance emails; parses and drops them into the review queue surfaced by `PendingEmailsProvider` / `PendingEmailsModal`
- **`_shared/rate-limit.ts`** — shared rate-limit helper. Wrap abuse-prone edge functions (parse-advance, lookup-venue-address, autocomplete-place) with it; see existing usage for the pattern

**Deployment**: all edge functions auto-deploy to `knwdjeicyisqsfiisaic` on push to `main` via `.github/workflows/deploy-supabase-functions.yml`. Manual redeploy is available via the Actions tab. Do **not** assume a function change is live just because it's merged — if the Action failed, the old version is still running.

**Migrations**: new migrations should be named `YYYYMMDDHHMMSS_short_snake_name.sql` (see the most recent files under `supabase/migrations/`). Older entries use a timestamp + UUID suffix — that's legacy; don't copy it. Apply via `supabase db push` against the remote project; regenerate `src/integrations/supabase/types.ts` after.

## Database Migrations

- Use the Supabase MCP server for all database operations (migrations, vault secrets, RLS policies)
- Avoid direct Postgres connections (IPv6-only host and pooler tenant issues are recurring blockers)
- When adding RLS policies, ensure SELECT, INSERT, UPDATE, and DELETE are all covered explicitly — missing UPDATE policies cause silent failures (this bit us on the initial RBAC ship)

## Guest links & guest views

"Guests are first-class" is a stated product principle — most people who interact with tour data (promoters, venue contacts, show-day crew, the artist on tour) will never log in. The guest-link system gives them scoped, read-mostly access to a single show via a tokenized URL.

**Architecture:**

- **`guest_links` table** — holds `token`, `show_id`, `link_type`, `expires_at`, `revoked_at`, `created_by`. Tokens are generated with `nanoid` (17 chars). Revocation is soft (timestamp).
- **`link_type`** is a string enum, currently `"daysheet"` (full show day sheet) or `"doorlist"` (guest list only). Adding a new type requires updating the table's check constraint and dispatching in `GuestShowPage`.
- **`get_guest_show(p_token text)`** RPC — the single read endpoint. `SECURITY DEFINER`, granted to `anon` and `authenticated`. Returns a curated `jsonb` payload: deal and financial fields are deliberately omitted server-side so they never reach the client, even by accident.
- **Write surface** is intentionally narrow: guest-list edits via a separate RPC gated to `link_type="daysheet"` (see `20260420130000_restrict_guest_list_update_to_daysheet.sql`). No other writes are allowed from a guest token.

**Files:**

- `src/pages/GuestShowPage.tsx` — route entry at `/guest/:token`, resolves the token and dispatches to the right view based on `link_type`
- `src/components/guest/GuestLayout.tsx` — shared chrome (header, theme toggle, footer) wrapping every guest view. Header and footer link to the marketing site (`advancetouring.com`) so curious guests can discover the product
- `src/components/guest/DaysheetGuestView.tsx` — full day sheet for `link_type="daysheet"`. Renders sections in the same order as the authenticated app (uses `DAYSHEET_SECTION_KEYS` / `hasData`) but against the guest payload shape
- `src/components/guest/DoorListGuestView.tsx` — guest-list-only for `link_type="doorlist"`
- `src/components/guest/GuestGuestList.tsx` — the inline-editable guest list (the only write surface guests get; scoped server-side by link type)
- `src/lib/guestLinks.ts` — helpers: `buildGuestUrl`, `generateGuestLink`, `revokeGuestLink`, `fetchGuestShow`, `getActiveGuestLink`. Also exports the `GuestShowPayload` and `GuestLinkType` types
- `src/components/CopyGuestLinkButton.tsx` — the app-side UI for minting / copying / revoking a link on a show

**When adding a new guest view / link type:**

1. Add the new value to the `guest_links.link_type` check constraint (new migration).
2. Extend `get_guest_show` to include any additional fields the new view needs, keeping financial data out.
3. Widen `GuestShowPayload` and `GuestLinkType` in `src/lib/guestLinks.ts` to match.
4. Dispatch from `GuestShowPage` on the new `link_type`.
5. Wrap the new view in `<GuestLayout>` so it inherits the header/footer/theme toggle.
6. If the view overlaps with the authenticated day sheet, route gating through `has(sectionKey)` from `daysheetSections.ts` to keep behavior consistent — remembering the `contacts` vs `show_contacts` shape difference (see Multi-contact above).

## Established patterns

Follow these patterns — they're load-bearing across the codebase.

### Inline editing (see `ShowDetailPage.tsx`)

Field-level editing uses a single `inlineField` state variable + `inlineValue`. The `editField(key, label, opts)` helper renders either a clickable `FieldRow` or an inline editor. Empty fields render `<EmptyFieldPrompt>`. Use `startInlineEdit()` / `saveInline()` / `cancelInline()`. New editable fields on `ShowDetailPage` must use this pattern — do not introduce separate edit modals.

### Dialog composition via `trigger` prop

Action dialogs (`EmailBandDialog`, `SlackPushDialog`, `ExportPdfDialog`, `ParseAdvanceForShowDialog`, `BulkUploadDialog`) accept an optional `trigger?: React.ReactNode` prop so they can be embedded inside a `DropdownMenu` without rendering their default button. When adding a new action dialog, support this prop.

Also: gate any queries the dialog owns with `enabled: open` so they don't run until the user opens the dialog, and reset local form state in `onOpenChange(false)` so the next open starts clean. This is how the existing dialogs behave — copy it.

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

Three other collaborating structures in the same file must stay in sync when adding importable columns:

- **`CSV_COLUMN_MAP`** — maps user-friendly CSV headers (e.g. `venue`, `cap`) to DB columns (e.g. `venue_name`, `venue_capacity`). Add new aliases here.
- **`TEMPLATE_COLUMNS`** — drives the downloadable CSV template. Keep it aligned with `CSV_COLUMN_MAP`.
- **`FINANCIAL_FIELDS`** + `normalizeBackendDeal()` — strip `$`, commas, ranges (`"$20/$25"` → first value), and canonicalize backend-deal text. Reuse these; don't reimplement per-field cleaners.

### Data normalization helpers

Reuse, don't reimplement:

- `normalizePhone(raw)` — phone → `(XXX) XXX-XXXX` format (`src/lib/utils.ts`)
- `formatCityState(city)` — display-format `"City, ST"` and strips trailing asterisks (`src/lib/utils.ts`)
- `normalizeTime(raw)` — free-text time → `"H:MM AM/PM"` (`src/lib/timeFormat.ts`)
- `formatCurrency(raw)` — dollar string → display format (`ShowDetailPage.tsx`)
- `parseDollar`, `parseBackendPct`, `parseBackendType`, `parseTieredDeal` — all exported from `RevenueSimulator.tsx`
- `roleLabel(contact)` — display-format a `ShowContact`'s role, respecting `role_label` on `"custom"` (`src/lib/contactRoles.ts`)

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

For loading UI, use React Query's `isLoading` / `isPending` (and `isFetching` when revalidating) — don't track loading in component state. Buttons that kick off a mutation should disable on `mutation.isPending` rather than a manual `submitting` flag.

## UI & Design

When making any frontend changes — components, pages, modals, layouts, styling — consult `docs/design-system.md` and '.claude/skills/advance-design' before writing any code.

For logic-only changes (edge functions, migrations, Supabase queries, API routes, utility functions, type definitions), skip the design system doc entirely.

The app uses a dark-mode-first aesthetic (light-mode is also available). Key principles:
- Dark backgrounds, high contrast typography
- Minimal, utilitarian UI — no decorative gradients or heavy shadows
- Smooth, intentional micro-animations (not gratuitous)
- Every user-facing detail should feel considered

Output quality is part of the product — PDFs, emails, and Slack messages must match in-app visual quality. Before changing an exporter, eyeball the current output (download the PDF, check the Gmail preview) so the new version is a strict improvement.

## Design Handoff Compliance

- When implementing from a design file, re-read the spec before coding and after Phase 1 to verify scope
- Do not add elements not in the spec (e.g., hotel info, extra fields) without asking
- Match interaction patterns exactly (e.g., simple check mark vs. slide-to-settle) — confirm ambiguous interactions before building

## Testing

Vitest is wired up (`src/test/setup.ts`), but the suite is currently sparse — only `src/test/example.test.ts` exists as a placeholder. Treat test coverage as an open direction, not an established baseline: when you touch non-trivial pure logic (parsers, normalizers, CSV matchers, deal-math helpers), add a test alongside in `src/test/` or next to the module. Run with `npm test` (one-shot) or `npm run test:watch`. Don't gate feature work on backfilling tests for untouched code.
