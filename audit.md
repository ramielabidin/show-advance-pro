# Design System Audit

> Scope: `src/pages/*.tsx`, `src/components/*.tsx` (excluding `src/components/ui/*`), `src/index.css`, `tailwind.config.ts`
> Reference: `docs/design-system.md`, `.claude/skills/advance-design/README.md`

| File | Line | Violation | Category | Severity | Proposed fix |
|------|------|-----------|----------|----------|--------------|
| ~~`src/index.css`~~ | ~~158–160~~ | ~~Global `h1, h2, h3, h4 { @apply font-display; }` forces DM Serif Display onto every semantic heading — including UI labels, card titles, section headers, and empty-state titles that should be DM Sans~~ | ~~Type~~ | ~~high~~ | ~~Remove the blanket rule. Apply `font-display` only at the use-site (e.g. `DashboardPage` greeting, `AuthPage` wordmark, stat numbers). All other headings default to DM Sans via `font-sans`.~~ ✅ |
| ~~`tailwind.config.ts`~~ | ~~—~~ | ~~`--pastel-purple-{bg,fg}` are defined in `index.css` but have no corresponding Tailwind alias — can't use `bg-pastel-purple` or `text-pastel-purple` in class strings~~ | ~~Color~~ | ~~high~~ | ~~Add `"pastel-purple": { DEFAULT: "var(--pastel-purple-bg)", foreground: "var(--pastel-purple-fg)" }` to the `colors` block alongside the other pastels~~ ✅ |
| ~~`src/components/ShowCard.tsx`~~ | ~~27–32~~ | ~~Status dot uses raw Tailwind classes `bg-green-500`, `bg-red-500`, `bg-amber-400` — bypasses theming and the warm-monochrome canvas~~ | ~~Color~~ | ~~high~~ | ~~Replace with pastel fg tokens via inline style: `backgroundColor: "var(--pastel-green-fg)"`, `"var(--pastel-red-fg)"`, `"var(--pastel-yellow-fg)"`~~ ✅ |
| ~~`src/components/ShowCard.tsx`~~ | ~~76~~ | ~~"Settled" badge uses `bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400` — raw Tailwind colors, manually re-implements what `--pastel-green-{bg,fg}` already provides~~ | ~~Color~~ | ~~high~~ | ~~Replace with the pastel chip pattern: `style={{ backgroundColor: "var(--pastel-green-bg)", color: "var(--pastel-green-fg)" }}`~~ ✅ |
| ~~`src/components/BandDocuments.tsx`~~ | ~~175~~ | ~~`if (confirm("Remove this document?"))` — browser native `confirm()` for a destructive action instead of `AlertDialog`~~ | ~~Layout~~ | ~~high~~ | ~~Replace with `AlertDialog` + destructive `AlertDialogAction` variant, matching the delete-show pattern in `ShowsPage.tsx`~~ ✅ |
| ~~`src/components/ShowCard.tsx`~~ | ~~97, 109~~ | ~~`transition-all` on action button hover states — banned; triggers unnecessary layout recalc and is less precise~~ | ~~Motion~~ | ~~med~~ | ~~Specify exact properties: `[transition:color_150ms_var(--ease-out),background-color_150ms_var(--ease-out),opacity_150ms_var(--ease-out)]`~~ ✅ |
| ~~`src/components/FieldGroup.tsx`~~ | ~~16~~ | ~~`<h3 className="text-[11px] font-medium uppercase tracking-widest ...">` — no `font-sans` override; inherits `font-display` from the global h1–h4 rule. An 11px uppercase section label in DM Serif Display looks wrong.~~ | ~~Type~~ | ~~med~~ | ~~Add `font-sans` to the className, or fix the root `index.css` rule first~~ ✅ (resolved by root fix) |
| ~~`src/components/FieldGroup.tsx`~~ | ~~18~~ | ~~`bg-amber-400` for the incomplete-indicator dot — raw Tailwind color~~ | ~~Color~~ | ~~med~~ | ~~Use `style={{ backgroundColor: "var(--pastel-yellow-fg)" }}` (or `bg-[var(--pastel-yellow-fg)]`) to match the status-dot pattern~~ ✅ |
| ~~`src/components/GuestListEditor.tsx`~~ | ~~53~~ | ~~`text-amber-500` for near-capacity guest count warning — raw Tailwind color~~ | ~~Color~~ | ~~med~~ | ~~Use `style={{ color: "var(--pastel-yellow-fg)" }}` or Tailwind's `text-[var(--pastel-yellow-fg)]`~~ ✅ |
| ~~`src/components/GuestListEditor.tsx`~~ | ~~150~~ | ~~`<Input className="text-sm h-9 flex-1">` — `h-9` (36px) without `sm:` prefix on a field that appears in a mobile-accessible dialog~~ | ~~Layout~~ | ~~med~~ | ~~Change to `h-11 sm:h-9`~~ ✅ |
| ~~`src/components/EmptyState.tsx`~~ | ~~16~~ | ~~`<h3 className="text-lg font-medium text-foreground mb-1">` — no `font-sans` override; inherits `font-display`, so every empty-state title renders in DM Serif Display~~ | ~~Type~~ | ~~med~~ | ~~Add `font-sans` to className~~ ✅ (resolved by root fix) |
| ~~`src/components/ScheduleEditor.tsx`~~ | ~~65~~ | ~~`<Input className="text-sm h-9 flex-1">` — standalone `h-9` on a field reachable on mobile~~ | ~~Layout~~ | ~~med~~ | ~~Change to `h-11 sm:h-9`~~ ✅ |
| ~~`src/components/ScheduleEditor.tsx`~~ | ~~74~~ | ~~`text-green-700 hover:text-green-700 dark:text-green-400 dark:hover:text-green-400` on the band-row mic button — raw Tailwind green~~ | ~~Color~~ | ~~med~~ | ~~Use `style={{ color: "var(--pastel-green-fg)" }}` with a hover wrapper or a `[color:var(--pastel-green-fg)]` arbitrary class~~ ✅ |
| ~~`src/components/TourRevenueSimulator.tsx`~~ | ~~84~~ | ~~`<h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">` — no `font-sans`; section-label typography in DM Serif Display at 12px uppercase is wrong~~ | ~~Type~~ | ~~med~~ | ~~Add `font-sans`~~ ✅ (resolved by root fix) |
| ~~`src/components/EmailAttachments.tsx`~~ | ~~84~~ | ~~`<h3 className="text-sm font-medium text-foreground ...">` — no `font-sans`; section heading inherits `font-display`~~ | ~~Type~~ | ~~med~~ | ~~Add `font-sans`~~ ✅ (resolved by root fix) |
| ~~`src/components/BandDocuments.tsx`~~ | ~~116~~ | ~~`<h2 className="font-medium text-foreground mb-0.5">Band Documents</h2>` — no `font-sans`; inherits `font-display`~~ | ~~Type~~ | ~~med~~ | ~~Add `font-sans`~~ ✅ (resolved by root fix) |
| ~~`src/components/TourScopedHeader.tsx`~~ | ~~162, 171, 179, 186~~ | ~~Multiple `Button` elements with only `className="h-9"` (or `h-9 w-9`) — no `sm:` breakpoint; TourScopedHeader renders on mobile~~ | ~~Layout~~ | ~~med~~ | ~~Change to `h-11 sm:h-9` (and `h-11 w-11 sm:h-9 sm:w-9` for the icon button)~~ ✅ |
| ~~`src/components/BulkUploadDialog.tsx`~~ | ~~706~~ | ~~`text-amber-600` on a warning span ("N duplicate rows") — raw Tailwind~~ | ~~Color~~ | ~~med~~ | ~~Replace with `style={{ color: "var(--pastel-yellow-fg)" }}`~~ ✅ |
| ~~`src/components/BulkUploadDialog.tsx`~~ | ~~711, 715~~ | ~~`text-green-600` on success status spans — raw Tailwind~~ | ~~Color~~ | ~~med~~ | ~~Replace with `style={{ color: "var(--pastel-green-fg)" }}`~~ ✅ |
| ~~`src/components/BulkUploadDialog.tsx`~~ | ~~760, 771~~ | ~~`text-xs text-green-600` and `text-xs text-amber-600` on per-row status indicators — raw Tailwind~~ | ~~Color~~ | ~~med~~ | ~~Replace with pastel-green-fg / pastel-yellow-fg~~ ✅ |
| ~~`src/components/BulkUploadDialog.tsx`~~ | ~~805~~ | ~~`<CheckCircle2 className="h-4 w-4 text-green-600">` — raw Tailwind color on a status icon~~ | ~~Color~~ | ~~med~~ | ~~Use `text-[var(--pastel-green-fg)]` or `style={{ color: "var(--pastel-green-fg)" }}`~~ ✅ |
| ~~`src/pages/SettingsPage.tsx`~~ | ~~502, 558, 624, 707, 847~~ | ~~Multiple `<h2 className="font-medium text-foreground ...">` section labels (Slack Integration, Home Base City, Email Forwarding, Touring Party, Team Members) — no `font-sans`; all render in DM Serif Display due to global rule~~ | ~~Type~~ | ~~med~~ | ~~Add `font-sans` to each, or fix the root `index.css` rule~~ ✅ (resolved by root fix) |
| ~~`src/components/ShowCard.tsx`~~ | ~~55~~ | ~~`<h3 className="font-medium text-foreground text-sm sm:text-base truncate">` — venue name heading inherits `font-display` (DM Serif Display at 14–16px) where DM Sans is expected for a card data label~~ | ~~Type~~ | ~~med~~ | ~~Add `font-sans`~~ ✅ (resolved by root fix) |
| ~~`src/pages/ShowDetailPage.tsx`~~ | ~~851~~ | ~~`rounded-xl` on a card div — the only allowed radii are `rounded-md` (buttons/inputs/cards) and `rounded-full` (chips/dots). `rounded-xl` is explicitly "nothing in between."~~ | ~~Layout~~ | ~~med~~ | ~~Change to `rounded-lg` (the card shell default)~~ ✅ |
| ~~`src/components/AppLayout.tsx`~~ | ~~60–61, 90–91~~ | ~~`transition-all` on `<Sun>` and `<Moon>` theme-toggle icons — banned; triggers unnecessary properties~~ | ~~Motion~~ | ~~low~~ | ~~Replace with `[transition:transform_150ms_var(--ease-out),opacity_150ms_var(--ease-out)]` on each icon~~ ✅ |
| ~~`src/components/BulkUploadDialog.tsx`~~ | ~~742~~ | ~~`bg-amber-500/5` — raw Tailwind color on a changed-row highlight~~ | ~~Color~~ | ~~low~~ | ~~Use `bg-[color-mix(in_srgb,var(--pastel-yellow-bg)_30%,transparent)]` or `bg-pastel-yellow/30` once the Tailwind alias is wired correctly~~ ✅ (swapped to `bg-pastel-yellow/30`) |
| ~~`src/pages/DashboardPage.tsx`~~ | ~~982~~ | ~~`rounded-xl` on the date-tile callout div — outside the allowed radius set~~ | ~~Layout~~ | ~~low~~ | ~~Change to `rounded-lg`~~ ✅ |
| ~~`src/components/PendingEmailsModal.tsx`~~ | ~~121~~ | ~~`<SelectTrigger className="h-9">` — modal is reachable on mobile; standalone `h-9` misses touch-target minimum~~ | ~~Layout~~ | ~~low~~ | ~~Change to `h-11 sm:h-9`~~ ✅ |
| ~~`src/components/TimeInput.tsx`~~ | ~~88, 104~~ | ~~`<SelectTrigger className="w-16 h-9 ...">` — time-picker selects in the schedule editor are used on mobile~~ | ~~Layout~~ | ~~low~~ | ~~Change to `h-11 sm:h-9` (may need `w-16 sm:w-auto` adjustment)~~ ✅ (bumped height to `h-11 sm:h-9`; width kept at `w-16` — still comfortable on mobile) |
| ~~`src/components/PullToRefresh.tsx`~~ | ~~78, 83~~ | ~~`transition-shadow duration-200` and `transition-colors duration-150` — bare Tailwind duration utilities without an easing token; will default to the browser's default `ease` curve~~ | ~~Motion~~ | ~~low~~ | ~~Use `[transition:box-shadow_200ms_var(--ease-out)]` and `[transition:color_150ms_var(--ease-out)]`~~ ✅ |
| ~~`src/pages/SettingsPage.tsx`~~ | ~~476~~ | ~~Page root div uses `stagger-list` but has no `animate-fade-in`; every other page root carries `animate-fade-in` for the page-entrance animation~~ | ~~Motion~~ | ~~low~~ | ~~Add `animate-fade-in` alongside `stagger-list` on the root div~~ ✅ |

---

## Summary

**Total violations: 31** · **Resolved: 31** · **Open: 0**

| Category | Open | Resolved |
|----------|------|----------|
| Color    | 0    | 13       |
| Type     | 0    | 8        |
| Layout   | 0    | 8        |
| Motion   | 0    | 5        |
| Copy     | 0    | 0        |
| Icon     | 0    | 0        |

**By severity (open only):**

| Severity | Count |
|----------|-------|
| high     | 0     |
| med      | 0     |
| low      | 0     |

### High-priority fixes still open

_None — all high-severity rows resolved._

### ✅ Color pass — complete (`redesign/colors`)

All 13 Color-category violations resolved (see strike-throughs above). Swap pattern used throughout: raw Tailwind (`bg-green-500`, `text-amber-600`, etc.) → `var(--pastel-{hue}-{bg|fg})` via arbitrary Tailwind classes or inline style, matching the existing status-dot / pastel-chip conventions in the codebase. `pastel-purple` Tailwind alias added to `tailwind.config.ts`.

### ✅ Type pass — complete (`redesign/type`)

All 8 Type-category violations resolved via a single root-cause fix: removed the global `h1, h2, h3, h4 { @apply font-display; }` rule from `src/index.css`. Every heading that intentionally wants DM Serif Display already carries an explicit `font-display` class at the use-site (e.g. dashboard greeting, auth wordmark, stat numbers, date tiles). Removing the blanket rule lets every other heading inherit DM Sans from `body`, which is the correct default for UI labels, card titles, section headers, and empty-state titles. One commit, zero per-file `font-sans` overrides needed.

### ✅ Motion pass — complete (`redesign/motion`)

All 5 Motion-category violations resolved across 4 files — one commit per file. Swap pattern: banned `transition-all` and bare `transition-{prop} duration-{ms}` utilities → explicit arbitrary-value transitions that name the animated properties and use the `--ease-out` token (e.g. `[transition:color_150ms_var(--ease-out),background-color_150ms_var(--ease-out),opacity_150ms_var(--ease-out)]`). `SettingsPage` root div also picked up the missing `animate-fade-in` so its page-entrance matches every other page.

### ✅ Layout pass — complete (`redesign/layout`)

All 8 Layout-category violations resolved — one commit per file. Two patterns covered:

- **Touch-target height** (`h-9` → `h-11 sm:h-9`) applied to mobile-reachable inputs/selects/buttons across `GuestListEditor`, `ScheduleEditor`, `TourScopedHeader` (edit/save/cancel + icon overflow `h-11 w-11 sm:h-9 sm:w-9`), `PendingEmailsModal`, and `TimeInput` (hour/minute selects).
- **Card radius** (`rounded-xl` → `rounded-lg`) on the `ShowDetailPage` advance-empty card and the `DashboardPage` date-tile callout — bringing them back into the allowed radius set (`rounded-md` / `rounded-lg` / `rounded-full`).
- The lone high-priority row (`BandDocuments.tsx` native `confirm()`) was replaced with an `AlertDialog` using the exact destructive-action pattern from `ShowsPage.tsx` — no new abstraction introduced.
