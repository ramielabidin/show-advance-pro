# Dashboard Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip financial/progress UI and scope filtering from the dashboard so it becomes a clean "what's next" view: header → today's featured show → flat infinite-scroll list of upcoming shows. Add a floating Day of Show pill on show day and a search icon in the mobile top bar.

**Architecture:** All changes are client-side React. No schema changes, no edge function changes, no new dependencies. The existing `useQuery(["shows"])` data already has everything we need. Behaviorally we delete more than we add — `DashboardPage.tsx` shrinks ~70%. The two new components (`FeaturedShowCard` extracted, `DayOfShowFloatingButton` new) are small and self-contained.

**Tech Stack:** React 18 + TypeScript, React Router v6, TanStack Query v5, Tailwind, shadcn/Radix, lucide-react. `IntersectionObserver` (browser API) for infinite scroll, no library.

**Spec:** `docs/superpowers/specs/2026-04-28-dashboard-simplification-design.md`

**Branch:** `claude/dashboard-simplification` (already exists on remote, currently has the spec commit only). Implementation commits land on this same branch; PR #202 grows from "spec only" into "spec + implementation".

**Testing approach:** This work is UI-bound — no new pure logic worth isolating. The codebase's test suite is intentionally sparse (per `CLAUDE.md`: *"don't gate feature work on backfilling tests for untouched code"*). We rely on manual QA per the spec's verification checklist. Type-check and lint must pass.

---

## File Structure

### Files created

| Path | Responsibility |
|------|----------------|
| `src/components/FeaturedShowCard.tsx` | The big "Tonight" / "Next Show" hero card. Extracted from inline in `DashboardPage.tsx`, takes a new `tour` prop for inline tour chip. |
| `src/components/DayOfShow/DayOfShowFloatingButton.tsx` | Mobile-only fixed-position pill at bottom-right that opens `DayOfShowMode`. Owns its own open/close state. |

### Files modified

| Path | Change |
|------|--------|
| `src/pages/DashboardPage.tsx` | Major reduction. Strip scope, progress, revenue, past-tour cards, scope-pill subcomponents. Render header → featured → infinite-scroll list → floating DOS button. |
| `src/components/AppLayout.tsx` | Add `Search` icon button to mobile top bar between wordmark and theme toggle. Navigates to `/shows` with `{ focusSearch: true }` location state. |
| `src/pages/ShowsPage.tsx` | On mount, if `location.state?.focusSearch`, focus the search `Input` via a ref and clear the state to prevent re-focus on refresh. |

### Files deleted

None.

---

## Task 1: Preflight — switch branches and verify clean state

**Files:** none

- [ ] **Step 1: Stash any uncommitted work on the current branch**

```bash
git status
```

If there are uncommitted changes (likely, given the user's `start-work` skill in progress on `claude/session-hooks-and-start-work-skill`):

```bash
git stash push -u -m "WIP before dashboard impl"
```

- [ ] **Step 2: Check out the dashboard branch**

```bash
git fetch origin
git checkout claude/dashboard-simplification
git pull --ff-only origin claude/dashboard-simplification
```

Expected: branch is at the spec commit (`97081ee` or whatever the current head is). Working tree clean.

- [ ] **Step 3: Verify the spec exists**

```bash
ls -la docs/superpowers/specs/2026-04-28-dashboard-simplification-design.md
```

Expected: the file is present.

- [ ] **Step 4: Install deps (if not already) and run typecheck**

```bash
npm install
npx tsc --noEmit
npm run lint
```

Expected: clean. If not clean before our changes, that's a pre-existing issue — note it but don't fix here.

---

## Task 2: Extract `FeaturedShowCard` to its own file with `tour` prop

**Files:**
- Create: `src/components/FeaturedShowCard.tsx`
- Modify: `src/pages/DashboardPage.tsx` (remove inline component, import new one)

The current `FeaturedShowCard` lives inline at the bottom of `DashboardPage.tsx`. We extract it verbatim, then add a new `tour` prop that renders an inline pill next to the venue name.

- [ ] **Step 1: Create the new file with extracted component + tour chip**

Create `src/components/FeaturedShowCard.tsx`:

```tsx
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatCityState } from "@/lib/utils";
import { to12Hour, to24Hour } from "@/lib/timeFormat";
import { isLoadInLabel, isDoorsLabel } from "@/lib/scheduleMatch";
import StatusDot from "@/components/StatusDot";
import type { Show } from "@/lib/types";

interface FeaturedShowCardProps {
  show: Show;
  mode: "next" | "final";
  tour?: { id: string; name: string } | null;
}

export default function FeaturedShowCard({ show, mode, tour }: FeaturedShowCardProps) {
  const date = parseISO(show.date);
  const daysAway = differenceInCalendarDays(date, new Date());

  const daysLabel =
    daysAway <= 0
      ? "Today"
      : daysAway === 1
        ? "Tomorrow"
        : daysAway < 7
          ? `${daysAway} days away`
          : daysAway < 14
            ? "Next week"
            : `${Math.ceil(daysAway / 7)} weeks away`;

  const isUrgent = daysAway >= 0 && daysAway < 7;
  const showFinalDate = mode === "final";

  const entries = show.schedule_entries ?? [];
  const loadInEntry = entries
    .filter((e) => isLoadInLabel(e.label))
    .sort((a, b) => (to24Hour(a.time) ?? "").localeCompare(to24Hour(b.time) ?? ""))[0];
  const doorsEntry = entries.find((e) => isDoorsLabel(e.label));
  const bandEntry = entries.find((e) => e.is_band);

  const loadInTime = to12Hour(loadInEntry?.time);
  const doorsTime = to12Hour(doorsEntry?.time);
  const setTime = to12Hour(bandEntry?.time);

  const capRaw = show.venue_capacity;
  const capNum = capRaw ? parseInt(String(capRaw).replace(/[^\d]/g, ""), 10) : NaN;
  const capDisplay = Number.isFinite(capNum) ? capNum.toLocaleString() : null;

  const footerCells: { label: string; value: string | null }[] = [
    { label: "Load-in", value: loadInTime },
    { label: "Doors", value: doorsTime },
    { label: "Set", value: setTime },
    { label: "Capacity", value: capDisplay },
  ];
  const hasAnyFooterData = footerCells.some((c) => !!c.value);

  return (
    <Link to={`/shows/${show.id}`} className="block group card-pressable">
      <Card className="overflow-hidden hover:border-foreground/20 [transition:border-color_160ms_var(--ease-out),box-shadow_200ms_var(--ease-out)]">
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-start gap-4 sm:gap-5">
            {/* Calendar stub */}
            <div className="shrink-0 flex flex-col items-center justify-center rounded-lg border border-border bg-muted/50 w-14 h-[4.5rem] select-none">
              <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold leading-none mb-0.5">
                {format(date, "MMM")}
              </span>
              <span className="text-3xl font-display text-foreground leading-none tracking-[-0.03em]">{format(date, "d")}</span>
              <span className="text-[9px] text-muted-foreground mt-0.5">{format(date, "EEE")}</span>
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-display text-foreground truncate tracking-[-0.02em] min-w-0">
                  {show.venue_name}
                </h2>
                {tour && (
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium shrink-0"
                    style={{ backgroundColor: "var(--pastel-blue-bg)", color: "var(--pastel-blue-fg)" }}
                  >
                    {tour.name}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{formatCityState(show.city)}</span>
              </div>
              {showFinalDate ? (
                <span className="inline-flex items-center mt-2 text-[10px] uppercase tracking-widest font-medium px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                  {format(date, "MMM d, yyyy")}
                </span>
              ) : daysAway > 0 ? (
                <span
                  className={cn(
                    "inline-flex items-center mt-2 text-[10px] uppercase tracking-widest font-medium px-2 py-0.5 rounded-full",
                    !isUrgent && "bg-secondary text-muted-foreground",
                  )}
                  style={
                    isUrgent
                      ? { backgroundColor: "var(--pastel-yellow-bg)", color: "var(--pastel-yellow-fg)" }
                      : undefined
                  }
                >
                  {daysLabel}
                </span>
              ) : null}
            </div>

            {/* Advance status dot */}
            <StatusDot show={show} className="mt-1.5" />
          </div>
        </CardContent>
        {hasAnyFooterData && (
          <div className="grid grid-cols-4 border-t bg-muted/40">
            {footerCells.map((cell, i) => (
              <div
                key={cell.label}
                className={cn("py-3 px-3 sm:px-4", i < 3 && "border-r")}
                style={i < 3 ? { borderRightWidth: "0.5px" } : undefined}
              >
                <div className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">
                  {cell.label}
                </div>
                <div
                  className={cn(
                    "text-sm mt-1 whitespace-nowrap",
                    cell.value ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {cell.value ?? "—"}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </Link>
  );
}
```

- [ ] **Step 2: Remove the inline `FeaturedShowCard` from `DashboardPage.tsx`**

In `src/pages/DashboardPage.tsx`, delete the entire `function FeaturedShowCard(...)` block at the bottom of the file (lines around 965–1084 today).

- [ ] **Step 3: Add the import at the top of `DashboardPage.tsx`**

Find the import block near the top of `DashboardPage.tsx` and add (in alphabetical order with the other component imports):

```ts
import FeaturedShowCard from "@/components/FeaturedShowCard";
```

- [ ] **Step 4: Typecheck and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: clean.

- [ ] **Step 5: Smoke-test in the dev server**

```bash
npm run dev
```

Open the dashboard. Verify the featured "Next Show" / "Tonight" card still renders identically. The dashboard otherwise looks unchanged in this task — we haven't passed `tour` to the new component yet, so the chip won't appear.

- [ ] **Step 6: Commit**

```bash
git add src/components/FeaturedShowCard.tsx src/pages/DashboardPage.tsx
git commit -m "$(cat <<'EOF'
Dashboard: extract FeaturedShowCard to its own file with tour-chip prop

No behavior change yet — the chip only renders when the tour prop is
passed, which the dashboard will start doing in the upcoming rewrite.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Create `DayOfShowFloatingButton`

**Files:**
- Create: `src/components/DayOfShow/DayOfShowFloatingButton.tsx`

Mobile-only fixed pill that opens `DayOfShowMode`. Owns its own open state so the dashboard doesn't need to.

- [ ] **Step 1: Read `DayOfShowMode` to understand its props**

```bash
head -40 src/components/DayOfShow/DayOfShowMode.tsx
```

Confirm it takes `{ showId: string; onClose: () => void }`. (If the prop names differ, update the new component to match — names below assume those.)

- [ ] **Step 2: Create the new file**

Create `src/components/DayOfShow/DayOfShowFloatingButton.tsx`:

```tsx
import { useState } from "react";
import { Mic } from "lucide-react";
import DayOfShowMode from "@/components/DayOfShow/DayOfShowMode";

interface DayOfShowFloatingButtonProps {
  showId: string;
}

/**
 * Mobile-only fixed pill at the bottom-right that launches Day of Show Mode.
 * Owns its own open state. Mounts only when caller decides there's a show
 * "today" — see DashboardPage's showToday logic.
 */
export default function DayOfShowFloatingButton({ showId }: DayOfShowFloatingButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Enter Day of Show Mode"
        className="md:hidden fixed bottom-20 right-4 z-40 day-of-active-pulse inline-flex items-center gap-2 h-11 pl-3 pr-4 rounded-full bg-background border border-[hsl(var(--day-of-active))]/40 text-[hsl(var(--day-of-active))] shadow-lg [transition:transform_160ms_var(--ease-out)] active:scale-[0.97]"
        style={{
          paddingBottom: "max(0px, env(safe-area-inset-bottom, 0px))",
        }}
      >
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-full"
          style={{ backgroundColor: "hsl(var(--day-of-active) / 0.15)" }}
        >
          <Mic className="h-4 w-4" strokeWidth={2.4} />
        </span>
        <span className="text-sm font-medium tracking-tight">Day of Show</span>
      </button>
      {open && <DayOfShowMode showId={showId} onClose={() => setOpen(false)} />}
    </>
  );
}
```

Key positioning notes (call these out if a reviewer asks):
- `md:hidden` — mobile only; desktop intentionally has no DOS entry (Day of Show is a phone-in-venue surface)
- `fixed bottom-20 right-4` — sits 80px above the bottom edge, clearing the mobile bottom tab bar (~52–60px tall + safe area)
- `safe-area-inset-bottom` padding handles iOS notch/home indicator
- `day-of-active-pulse` — existing CSS class in `src/index.css` that matches the current mic-pulse on the show-day headline
- `--day-of-active` — existing CSS color token

- [ ] **Step 3: Typecheck and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: clean. The new component isn't yet rendered anywhere, but it compiles standalone.

- [ ] **Step 4: Commit**

```bash
git add src/components/DayOfShow/DayOfShowFloatingButton.tsx
git commit -m "$(cat <<'EOF'
Day of Show: add mobile floating-pill button component

Self-contained component that owns its own open state and launches the
existing DayOfShowMode overlay. Will replace the tappable-headline-with-
mic pattern on the dashboard in the upcoming rewrite.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Add search icon to mobile top bar

**Files:**
- Modify: `src/components/AppLayout.tsx`

The mobile top bar today has wordmark + theme + sign-out. We add a `Search` icon between the wordmark and theme toggle that navigates to `/shows` with `{ focusSearch: true }` location state.

- [ ] **Step 1: Update imports in `AppLayout.tsx`**

In the import block at the top, add `Search` to the lucide imports and add `useNavigate` from react-router-dom:

```ts
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Calendar, Settings, LogOut, Moon, Sun, FileText, Search } from "lucide-react";
```

- [ ] **Step 2: Get the navigate function inside the component**

In the `AppLayout` function, near the top alongside `useTheme` and `useQueryClient`:

```ts
const navigate = useNavigate();
```

- [ ] **Step 3: Insert the search button into the mobile top bar**

Find the mobile header block (the one inside `<header className="... md:hidden">`). Inside its right-hand `<div className="flex items-center gap-1">`, prepend a search button **before** the theme toggle:

```tsx
<Button
  variant="ghost"
  size="icon"
  className="h-8 w-8 text-muted-foreground"
  aria-label="Search shows"
  onClick={() => navigate("/shows", { state: { focusSearch: true } })}
>
  <Search className="h-4 w-4" />
</Button>
```

The final mobile-header right cluster looks like: `[Search] [Theme toggle] [Sign out]`.

- [ ] **Step 4: Typecheck and lint**

```bash
npx tsc --noEmit
npm run lint
```

- [ ] **Step 5: Smoke-test in dev server**

```bash
npm run dev
```

On a mobile-width viewport (DevTools narrow, or actual phone), tap the new search icon. Expect: navigation to `/shows`. Don't worry about focus yet — that's the next task. Theme and sign-out should still work.

- [ ] **Step 6: Commit**

```bash
git add src/components/AppLayout.tsx
git commit -m "$(cat <<'EOF'
AppLayout: add search icon to mobile top bar

Navigates to /shows with focusSearch state; the next change wires
ShowsPage to consume the state and focus its search input.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Wire `focusSearch` on `ShowsPage`

**Files:**
- Modify: `src/pages/ShowsPage.tsx`

Read `location.state.focusSearch` on mount, focus the search `Input` via a ref, and clear the state so a refresh doesn't re-focus.

- [ ] **Step 1: Update imports**

In `src/pages/ShowsPage.tsx`, the existing imports include `useSearchParams`. We need `useLocation`, `useNavigate`, `useEffect`, and `useRef`:

```ts
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
```

(Adjust the merge with whatever's already imported — `useState` and `useMemo` are already there; add `useEffect` and `useRef`.)

- [ ] **Step 2: Get location, navigate, and a ref to the input**

Inside the `ShowsPage` function, alongside `searchParams`:

```ts
const location = useLocation();
const navigate = useNavigate();
const searchInputRef = useRef<HTMLInputElement | null>(null);
```

- [ ] **Step 3: Add the focus effect**

Add this `useEffect` near the top of the component body, after the state setup:

```ts
useEffect(() => {
  const state = location.state as { focusSearch?: boolean } | null;
  if (state?.focusSearch) {
    searchInputRef.current?.focus();
    // Clear the state so a refresh doesn't re-focus.
    navigate(location.pathname + location.search, { replace: true, state: null });
  }
}, [location, navigate]);
```

- [ ] **Step 4: Attach the ref to the search Input**

Find the `<Input ... type="search" ... />` element and add `ref={searchInputRef}`:

```tsx
<Input
  ref={searchInputRef}
  type="search"
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
  placeholder="Search venue or city"
  aria-label="Search shows"
  className="pl-9 pr-9"
/>
```

- [ ] **Step 5: Typecheck and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: clean. (The shadcn `Input` forwards refs.)

- [ ] **Step 6: Smoke-test**

`npm run dev`. On mobile width, tap the search icon in the top bar. Expect: navigated to `/shows` and the search input is focused (cursor blinking, ready to type). Refresh the `/shows` page — focus should NOT re-acquire (state cleared).

- [ ] **Step 7: Commit**

```bash
git add src/pages/ShowsPage.tsx
git commit -m "$(cat <<'EOF'
ShowsPage: focus search input when arriving with focusSearch state

Pairs with the new mobile top-bar search icon. Clears the state after
focus so refresh doesn't re-focus.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Audit inbound dashboard scope links (verification only)

**Files:** none

The spec calls out auditing inbound `/?scope=` and `/?tourId=` links. We already grepped during planning and found none, but confirm again post-checkout.

- [ ] **Step 1: Grep for any scope-param links pointing at the dashboard**

```bash
grep -rn "scope=tour\|scope=standalone\|scope=upcoming" src/ supabase/ scripts/ 2>/dev/null
grep -rn 'to="/[?]' src/ 2>/dev/null
grep -rn "navigate(['\"]/['\"]" src/ 2>/dev/null
```

Expected: no `scope=...` matches. The `to="/"` and `navigate("/")` patterns are fine — they go to the canonical dashboard.

- [ ] **Step 2: Note the result and move on**

If any matches surface (e.g., a stale link this plan didn't anticipate), open it and convert to either a plain `/` or a `/shows?view=...` URL as appropriate. Likely no commit needed for this task.

---

## Task 7: Rewrite `DashboardPage`

**Files:**
- Modify: `src/pages/DashboardPage.tsx` (whole-file rewrite)

The big task. Replace the current `DashboardPage.tsx` (~1100 lines) with a focused version (~250–300 lines). We strip scope, progress, revenue, past-tour cards, scope-pill subcomponents, and inline featured card. We add infinite scroll and the floating DOS button consumer.

Because we extracted `FeaturedShowCard` already (Task 2), this rewrite mostly deletes code rather than relocating it.

- [ ] **Step 1: Replace the entire contents of `src/pages/DashboardPage.tsx`**

Overwrite the file with the new implementation:

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format, parseISO, isPast, isToday, subDays } from "date-fns";
import { Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import CreateShowDialog from "@/components/CreateShowDialog";
import BulkUploadDialog from "@/components/BulkUploadDialog";
import SectionLabel from "@/components/SectionLabel";
import ShowCard from "@/components/ShowCard";
import StatusLegend from "@/components/StatusLegend";
import FeaturedShowCard from "@/components/FeaturedShowCard";
import DayOfShowFloatingButton from "@/components/DayOfShow/DayOfShowFloatingButton";
import { useAuth } from "@/components/AuthProvider";
import { useTeam } from "@/components/TeamProvider";
import type { Show } from "@/lib/types";

type ShowWithTour = Show & { tours?: { id: string; name: string } | null };

const PAGE_SIZE = 10;

function isUpcomingDate(date: string): boolean {
  const d = parseISO(date);
  return isToday(d) || !isPast(d);
}

export default function DashboardPage() {
  const { session } = useAuth();
  const { isArtist } = useTeam();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const { data: shows = [], isLoading: showsLoading } = useQuery<ShowWithTour[]>({
    queryKey: ["shows"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shows")
        .select("*, schedule_entries(*), tours(id, name)")
        .order("date", { ascending: true });
      if (error) throw error;
      return data as ShowWithTour[];
    },
  });

  const today = new Date();
  const hour = today.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const userFullName =
    (session?.user?.user_metadata?.full_name as string | undefined)?.trim() ||
    (session?.user?.user_metadata?.name as string | undefined)?.trim() ||
    "";
  const userFirstName = userFullName.split(/\s+/)[0] || null;
  const todayStr = format(today, "yyyy-MM-dd");

  // "Today's show" — matches today's calendar date, OR yesterday's date if
  // we're in the post-midnight early-morning window (before 4 AM). Load-outs
  // and after-show wind-down run late; the chip should persist past midnight
  // until the show day naturally ends (~4 AM cliff).
  const showToday = useMemo(() => {
    const now = new Date();
    if (now.getHours() < 4) {
      const yesterdayStr = format(subDays(now, 1), "yyyy-MM-dd");
      const yesterdayShow = shows.find((s) => s.date === yesterdayStr);
      if (yesterdayShow) return yesterdayShow;
    }
    return shows.find((s) => s.date === todayStr) ?? null;
  }, [shows, todayStr]);

  const headerLine = showToday
    ? userFirstName
      ? `Have a great show, ${userFirstName}`
      : "Have a great show tonight"
    : userFirstName
      ? `${greeting}, ${userFirstName}`
      : greeting;

  const upcoming = useMemo(
    () => shows.filter((s) => isUpcomingDate(s.date)),
    [shows],
  );

  // Featured: today's show if there is one, otherwise the next upcoming
  // unsettled show. No scope, no past-tour mode.
  const featured = useMemo<{ show: ShowWithTour; mode: "next" } | null>(() => {
    if (showToday) return { show: showToday as ShowWithTour, mode: "next" };
    const next = upcoming.find((s) => !s.is_settled);
    return next ? { show: next, mode: "next" } : null;
  }, [showToday, upcoming]);

  // The list excludes the featured show.
  const listShows = useMemo(() => {
    if (!featured) return upcoming;
    return upcoming.filter((s) => s.id !== featured.show.id);
  }, [upcoming, featured]);

  const visibleListShows = useMemo(
    () => listShows.slice(0, visibleCount),
    [listShows, visibleCount],
  );

  const hasMore = visibleCount < listShows.length;

  // Infinite scroll: when the sentinel intersects the viewport, reveal more.
  useEffect(() => {
    if (!hasMore) return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((c) => Math.min(c + PAGE_SIZE, listShows.length));
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, listShows.length]);

  const dateEyebrow = `${format(today, "EEEE")} · ${format(today, "MMM d")}`.toUpperCase();

  const header = (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span
          className="text-[11px] uppercase font-medium leading-none truncate"
          style={{ letterSpacing: "0.18em", color: "hsl(var(--muted-foreground))" }}
        >
          {dateEyebrow}
        </span>
        {!isArtist && (
          <div className="flex items-center gap-2 shrink-0">
            <BulkUploadDialog triggerClassName="h-9" iconOnlyMobile />
            <CreateShowDialog triggerClassName="h-9" iconOnlyMobile />
          </div>
        )}
      </div>

      <h1 className="min-w-0 flex-1 font-display text-3xl md:text-4xl tracking-[-0.02em] leading-[1.1] text-foreground">
        {headerLine}
      </h1>
    </div>
  );

  if (showsLoading) {
    return (
      <div className="animate-fade-in space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  // Empty state — user has no shows at all.
  if (shows.length === 0) {
    return (
      <div className="animate-fade-in space-y-6 sm:space-y-8">
        {header}
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No shows yet — add your first one to get started.</p>
          </CardContent>
        </Card>
        {showToday && <DayOfShowFloatingButton showId={showToday.id} />}
      </div>
    );
  }

  // Has shows but none upcoming — "all caught up" empty.
  const noUpcoming = upcoming.length === 0;

  return (
    <div className="animate-fade-in space-y-6 sm:space-y-8">
      {header}

      {noUpcoming ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Calendar className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              All caught up — no upcoming shows on the calendar.
            </p>
            {!isArtist && (
              <div className="mt-4 inline-flex">
                <CreateShowDialog />
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {featured && (
            <div>
              <SectionLabel>
                {featured.show.date === todayStr ? "Tonight" : "Next Show"}
              </SectionLabel>
              <FeaturedShowCard
                show={featured.show}
                mode={featured.mode}
                tour={featured.show.tours ?? null}
              />
            </div>
          )}

          {listShows.length > 0 && (
            <div>
              <SectionLabel
                action={
                  <div className="flex items-center gap-2">
                    <StatusLegend />
                    <Link
                      to="/shows"
                      className="text-[11px] uppercase tracking-widest font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      View all →
                    </Link>
                  </div>
                }
              >
                Upcoming Shows
              </SectionLabel>
              <div className="stagger-list space-y-2">
                {visibleListShows.map((show) => (
                  <ShowCard
                    key={show.id}
                    show={show}
                    chip={show.tour_id ? "tour" : "none"}
                  />
                ))}
              </div>
              {hasMore && (
                <div ref={sentinelRef} aria-hidden className="h-8" />
              )}
            </div>
          )}
        </>
      )}

      {showToday && <DayOfShowFloatingButton showId={showToday.id} />}
    </div>
  );
}
```

Notes:
- **Scope removed**: no scope pills, no `useSearchParams`, no `tours` query, no `setScope*` helpers.
- **Progress/revenue removed**: no `dashCards` memo, no `ProgressCard` / `RevenueCard` / `PastTourCard`.
- **Featured mode**: only `next` (or no featured at all). Section label switches between `Tonight` (if today's show) and `Next Show`.
- **Tour chip on featured**: passed via `tour={featured.show.tours ?? null}`. The query already includes `tours(id, name)`, so this is free.
- **List chip**: tour shows get `chip="tour"` (renders the tour name pill); standalone shows get `chip="none"` (no chip). No "Standalone" pill.
- **Infinite scroll**: client-side. Initial 10, +10 on sentinel intersection. Sentinel unmounts when fully drawn.
- **Floating DOS button**: rendered at the end, gated on `showToday`. The component is internally `md:hidden`, so desktop is automatically excluded.
- **Show-day headline**: returns to a plain `h1` (not a button). The floating pill is now the entry.
- **Artist gating preserved**: `BulkUploadDialog`, `CreateShowDialog`, and the empty-state CTA are admin-only.

- [ ] **Step 2: Typecheck and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: clean. If `noUnusedLocals` flags anything, remove the dead import.

- [ ] **Step 3: Smoke-test in dev server**

```bash
npm run dev
```

Walk through:
- **Dashboard with no shows** — renders empty state with Calendar icon. No floating button.
- **Dashboard with upcoming shows but none today** — `Next Show` featured + `Upcoming Shows` list. No floating button. Tour chip on featured if it belongs to a tour.
- **Dashboard with a show today** — `Tonight` featured + list of subsequent upcoming. Floating "Day of Show" pill at bottom-right (mobile only). Tap pill → `DayOfShowMode` overlay opens.
- **>10 upcoming shows** — initial 10 render, scroll near bottom, the next 10 reveal. No flicker, no duplicate render.
- **Desktop** — same content; floating button is hidden by `md:hidden`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/DashboardPage.tsx
git commit -m "$(cat <<'EOF'
Dashboard: simplify to a focused "what's next" view

Strip scope pills, progress card, revenue card, and past-tour recap.
Replace tappable-headline-with-mic on show day with a floating Day of
Show pill (bottom-right, mobile only). Add client-side infinite scroll
on the upcoming list (10 at a time). Featured card now shows the tour
chip inline with the venue name.

Spec: docs/superpowers/specs/2026-04-28-dashboard-simplification-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Final cleanup and build verification

**Files:** any with leftover unused imports

- [ ] **Step 1: Run a strict typecheck and lint**

```bash
npx tsc --noEmit
npm run lint
```

Both should be clean. The `noUnusedLocals` / `noUnusedParameters` settings in `tsconfig.app.json` will catch any orphaned imports from the rewrite.

- [ ] **Step 2: Run a production build**

```bash
npm run build
```

Expected: clean build, no TypeScript errors, no warnings about missing exports. If there's an error referencing `parseDollar`, `RevenueSimulator`, `Progress`, etc., it's a leftover import — remove it.

- [ ] **Step 3: If any cleanup commits are needed**

```bash
git add <files>
git commit -m "$(cat <<'EOF'
Dashboard: remove unused imports after rewrite

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

If nothing to clean, skip the commit.

---

## Task 9: Manual QA pass (per spec verification checklist)

**Files:** none

Walk through each item from the spec's Verification section. For each, note pass/fail; fix any failure before merge.

- [ ] Dashboard with **no shows** → empty state with "No shows yet" copy.
- [ ] Dashboard with shows but **none upcoming** → "All caught up" copy + Create Show CTA (admin only).
- [ ] Dashboard with **one upcoming** → featured card only, no list section.
- [ ] Dashboard with **11+ upcoming** → initial 10 in list + sentinel triggers next 10 on scroll.
- [ ] **Featured label** → `Tonight` when today's show exists; `Next Show` otherwise.
- [ ] **Tour chip on featured card** → renders for tour shows, absent for standalone.
- [ ] **Tour chip on list rows** → renders for tour shows, no chip for standalone.
- [ ] **Mobile, show day** → floating "Day of Show" pill at bottom-right; pulses; tap opens overlay.
- [ ] **Mobile, no show today** → no floating button.
- [ ] **Desktop** → no floating button regardless.
- [ ] **Mobile top bar search icon** → tap navigates to `/shows`, the search input is focused.
- [ ] **Refreshing `/shows`** after focus → does NOT re-focus.
- [ ] **Theme toggle and sign-out on mobile** → still work, no visual regression.
- [ ] **Artist role** → no admin-only CTAs (Bulk Upload, Create Show, empty-state Create button) visible. Day of Show pill still works for artists (artists also use DOS, just skip Phase 2 internally).
- [ ] **No `?scope=`** appears in URL on dashboard navigation.

---

## Task 10: Push and update PR #202

**Files:** none

- [ ] **Step 1: Push the branch**

```bash
git push origin claude/dashboard-simplification
```

- [ ] **Step 2: Update PR #202 title and body**

```bash
gh pr edit 202 --title "Dashboard simplification — strip financial/progress UI" --body "$(cat <<'EOF'
## Summary
- Strips financial info, progress bars, and scope pills from the dashboard
- Dashboard becomes a focused "what's next" view: header → today's featured show → flat chronological list with client-side infinite scroll
- Adds a floating Day of Show pill (mobile, show-day only) replacing the tappable-headline-with-mic pattern
- Adds a search icon to the mobile top bar that navigates to /shows with the search input focused
- Aggregate financials drop everywhere; tour-scoped financials remain on /shows via the existing simulator (untouched in this work)

## Design
- Spec: \`docs/superpowers/specs/2026-04-28-dashboard-simplification-design.md\`
- Plan: \`docs/superpowers/plans/2026-04-29-dashboard-simplification.md\`

## Test plan
- [ ] Dashboard renders cleanly across no-shows / no-upcoming / 1 / 11+ states
- [ ] Featured card label switches between Tonight / Next Show correctly
- [ ] Tour chip on featured + list rows
- [ ] Mobile show-day floating button pulses and opens DOS overlay
- [ ] Mobile non-show-day shows no floating button; desktop never shows it
- [ ] Mobile top-bar search icon focuses the /shows search input; refresh doesn't re-focus
- [ ] Artist role sees no admin-only CTAs

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Verify CI**

```bash
gh pr checks 202
```

If checks fail, fix and push another commit; do not merge until green.

- [ ] **Step 4: Hand back to user for review and merge**

Do NOT self-merge. Report PR URL and CI status.

---

## Self-review

### Spec coverage

| Spec section | Task |
|---|---|
| Drop scope pills | Task 7 |
| Drop progress card | Task 7 |
| Drop revenue card | Task 7 |
| Drop past-tour recap | Task 7 |
| Drop tappable-headline-with-mic pattern | Task 7 (replaced by floating button) |
| Tour chip on featured card | Task 2 (prop) + Task 7 (passed) |
| Tour chip on list rows | Task 7 |
| Client-side infinite scroll | Task 7 |
| Floating Day of Show pill | Task 3 (component) + Task 7 (consumer) |
| Search icon in mobile top bar | Task 4 |
| `focusSearch` mount-effect on `/shows` | Task 5 |
| Theme toggle + sign-out stay on mobile | Task 4 (untouched in the change) |
| Audit inbound `?scope=` links | Task 6 |
| Empty states (no shows / no upcoming) | Task 7 |
| Show-day cliff (4 AM rule) | Task 7 (preserved verbatim from existing logic) |
| Artist-role gating | Task 7 (admin-only CTAs preserved) |
| Branch off main, separate from day-of-show | Task 1 (preflight) |
| Manual QA per verification checklist | Task 9 |

All spec sections accounted for.

### Type/name consistency

- `FeaturedShowCard` props: `show: Show`, `mode: "next" | "final"`, `tour?: { id: string; name: string } | null` — defined in Task 2, used in Task 7 (passes `tour={featured.show.tours ?? null}`, where `tours` comes from the Supabase select `tours(id, name)`). Shapes match.
- `DayOfShowFloatingButton` props: `showId: string` — defined in Task 3, used in Task 7 with `showId={showToday.id}`. Match.
- `DayOfShowMode` props (`showId`, `onClose`) — referenced in Task 3; verified at Task 3 Step 1.
- `ShowCard` `chip` prop values: `"tour" | "standalone" | "none"` — Task 7 passes `"tour" | "none"`. Subset of allowed values. Match.
- Location state shape `{ focusSearch?: boolean }` — produced in Task 4 (`navigate("/shows", { state: { focusSearch: true } })`), consumed in Task 5 (`location.state as { focusSearch?: boolean } | null`). Match.

### Placeholder scan

No TBDs, no "implement later", no "similar to Task N", no abstract "add error handling" steps. All code blocks are complete and runnable.
