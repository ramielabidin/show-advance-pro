# Day of Show — Phase 1, 2, 3 Refinements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the three Day of Show phases — strip Phase 2 to the slide-to-settle, replace Phase 3 with a quiet auto-played celebration that splits into a hotel reveal on subsequent opens, and make Phase 1 robust to long schedules — tied together by a shared serif footer.

**Architecture:** Add two columns to `shows` (`dos_closed_at`, `hotel_phone`). Create two new components (`PlaceFooter`, `HotelReveal`) and rewrite the three `PhaseXxx` files. Keep `useDayOfShowPhase` unchanged. The 3a/3b split lives inside `PhasePostSettle` branching on `dos_closed_at`. Phase 1 uses native `overflow-y: auto` with `min-height: 0` on the flex chain and absolutely-positioned fade siblings (no `mask-image` — it breaks pointer events).

**Tech Stack:** React 18 + TypeScript, TanStack React Query v5, Supabase JS client (RLS), Tailwind, shadcn UI primitives, Lucide icons, DM Sans / DM Serif Display / JetBrains Mono. Supabase migrations applied through the Supabase MCP server.

**Spec:** `docs/superpowers/specs/2026-04-29-day-of-show-phase-refinements-design.md`

**Prototype:** `prototypes/day-of-show-phase3/index.html` (gitignored).

---

## File map

### New files
- `supabase/migrations/20260429120000_dos_closed_at_and_hotel_phone.sql`
- `src/components/DayOfShow/PlaceFooter.tsx`
- `src/components/DayOfShow/HotelReveal.tsx`

### Modified files
- `src/integrations/supabase/types.ts` (regenerated)
- `src/lib/types.ts`
- `src/components/DayOfShow/PhasePreShow.tsx`
- `src/components/DayOfShow/PhaseSettle.tsx`
- `src/components/DayOfShow/PhasePostSettle.tsx`
- `src/index.css`
- `src/pages/ShowDetailPage.tsx`

### Untouched (verify, do not modify)
- `src/hooks/useDayOfShowPhase.ts`
- `src/components/DayOfShow/DayOfShowFloatingButton.tsx`
- `src/components/DayOfShow/DayOfShowMode.tsx`
- `src/components/SettleShowDialog.tsx`
- `src/components/DayOfShow/ScheduleList.tsx`
- `src/components/DayOfShow/ActionCard.tsx`

---

## Task 1: Database migration — `dos_closed_at` and `hotel_phone`

**Files:**
- Create: `supabase/migrations/20260429120000_dos_closed_at_and_hotel_phone.sql`
- Regenerate: `src/integrations/supabase/types.ts`

- [ ] **Step 1: Apply the migration via Supabase MCP**

Use the `mcp__plugin_supabase_supabase__apply_migration` tool with:

- `name`: `dos_closed_at_and_hotel_phone`
- `query`:

```sql
ALTER TABLE public.shows
  ADD COLUMN dos_closed_at timestamptz NULL,
  ADD COLUMN hotel_phone   text         NULL;

COMMENT ON COLUMN public.shows.dos_closed_at IS
  'Set when the user closes the Day of Show overlay after settling. Drives the Phase 3a (celebration) → Phase 3b (hotel reveal) split inside PhasePostSettle.';

COMMENT ON COLUMN public.shows.hotel_phone IS
  'Optional hotel front desk phone number. Drives the "Call front desk" chip on the Day of Show hotel reveal (Phase 3b).';
```

Expected: tool succeeds and reports the migration applied.

- [ ] **Step 2: Save the migration file locally**

Write the same SQL to `supabase/migrations/20260429120000_dos_closed_at_and_hotel_phone.sql` so the migration is tracked in git. Body of the file is exactly the SQL from Step 1 (no need to wrap in a transaction; Supabase migrations run atomically).

- [ ] **Step 3: Regenerate Supabase types**

Use the `mcp__plugin_supabase_supabase__generate_typescript_types` tool. Overwrite `src/integrations/supabase/types.ts` with the returned types.

Verify the generated file contains `dos_closed_at: string | null` and `hotel_phone: string | null` under `Database["public"]["Tables"]["shows"]["Row"]`, `Insert`, and `Update`.

- [ ] **Step 4: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: Exit 0, no errors.

- [ ] **Step 5: Commit**

Verify branch first:
```bash
git branch --show-current
# expect: claude/day-of-show-phase-refinements
```

Then:
```bash
git add supabase/migrations/20260429120000_dos_closed_at_and_hotel_phone.sql src/integrations/supabase/types.ts
git commit -m "$(cat <<'EOF'
db: add dos_closed_at and hotel_phone columns to shows

dos_closed_at marks the moment a user closes the Day of Show
overlay after settling — drives the celebration → hotel-reveal
split inside Phase 3. hotel_phone is the optional front-desk
number used by the Phase 3b Call front desk action.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Update `Show` domain type

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add the new fields to the `Show` interface**

In `src/lib/types.ts`, find the `Show` interface. Add `dos_closed_at: string | null;` adjacent to `is_settled` and `hotel_phone: string | null;` adjacent to the other `hotel_*` fields (around line 60–65 based on existing layout). Final relevant block should look like:

```ts
  // ...other fields...
  is_settled: boolean;
  dos_closed_at: string | null;
  // ...
  hotel_name: string | null;
  hotel_address: string | null;
  hotel_phone: string | null;
  hotel_confirmation: string | null;
  hotel_checkin: string | null;
  hotel_checkin_date: string | null;
  hotel_checkout: string | null;
  hotel_checkout_date: string | null;
  // ...
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: Exit 0.

- [ ] **Step 3: Commit**

```bash
git branch --show-current
git add src/lib/types.ts
git commit -m "$(cat <<'EOF'
types: surface dos_closed_at and hotel_phone on Show

Mirrors the columns added in the previous migration. Required
before any Day of Show component can read or write either field.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add shared CSS — keyframes and footer / scroll classes

**Files:**
- Modify: `src/index.css`

This task is CSS-only. We add the new keyframes and classes used by `PlaceFooter`, the Phase 3a celebration, and the Phase 1 scroll layout. Old `.done-mark` / `.done-circle` / `.done-check` classes will be removed in Task 10 once we've confirmed they're no longer referenced.

- [ ] **Step 1: Append the new CSS block at the bottom of `src/index.css`**

Append (do not replace existing content):

```css
/* ── Day of Show — shared footer + Phase 3a celebration + Phase 1 scroll ── */

/* Gentle breathe used by both flavors of the phase footer. */
@keyframes dos-gentle-breathe {
  0%, 100% { opacity: 0.85; }
  50%      { opacity: 1; }
}

/* Single-line footer (Phase 3a, 3b) */
.dos-phase-footer {
  text-align: center;
  font-family: 'DM Serif Display', Georgia, serif;
  font-size: 22px;
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: hsl(var(--foreground));
  padding-top: 24px;
  animation: dos-gentle-breathe 4.2s ease-in-out infinite;
}

/* Place footer (Phase 1, 2): serif venue name + mono City, ST. */
.dos-phase-footer-place {
  display: block;
  text-align: center;
  text-decoration: none;
  color: inherit;
  padding-top: 24px;
  animation: dos-gentle-breathe 4.2s ease-in-out infinite;
  transition: opacity 200ms cubic-bezier(.2,.8,.2,1),
              transform 160ms cubic-bezier(.2,.8,.2,1);
  -webkit-tap-highlight-color: transparent;
}
.dos-phase-footer-place:hover { opacity: 0.85; }
.dos-phase-footer-place:active { transform: scale(0.99); }
.dos-phase-footer-place .pf-name {
  font-family: 'DM Serif Display', Georgia, serif;
  font-size: 22px;
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: hsl(var(--foreground));
}
.dos-phase-footer-place .pf-addr {
  margin-top: 4px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11.5px;
  line-height: 1.4;
  color: hsl(var(--muted-foreground));
  letter-spacing: 0;
}

/* Phase 1 scrollable schedule region */
.dos-p1-scroll-wrap {
  flex: 1;
  min-height: 0;
  position: relative;
  display: flex;
}
.dos-p1-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  padding-bottom: 12px;
}
.dos-p1-scroll::-webkit-scrollbar { width: 0; height: 0; }
.dos-p1-scroll-fade {
  position: absolute;
  left: 0;
  right: 0;
  height: 28px;
  pointer-events: none;
  z-index: 2;
}
.dos-p1-scroll-fade.top {
  top: 0;
  background: linear-gradient(
    to top,
    hsl(var(--background) / 0) 0%,
    hsl(var(--background) / 1) 100%
  );
}
.dos-p1-scroll-fade.bottom {
  bottom: 0;
  background: linear-gradient(
    to bottom,
    hsl(var(--background) / 0) 0%,
    hsl(var(--background) / 1) 100%
  );
}

/* Phase 3a celebration — single-stroke check + "Good job." rise. */
@keyframes dos-check-draw {
  to { stroke-dashoffset: 0; }
}
.dos-check-mark {
  position: relative;
  width: 96px;
  height: 96px;
  pointer-events: none;
}
.dos-check-mark .check-stroke {
  fill: none;
  stroke: hsl(var(--foreground));
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 60;
  stroke-dashoffset: 60;
  animation: dos-check-draw 760ms cubic-bezier(.16,1,.3,1) 120ms forwards;
  transition: opacity 460ms cubic-bezier(.2,.8,.2,1);
}
.dos-check-mark.fading .check-stroke { opacity: 0; }

.dos-good-job {
  position: absolute;
  font-family: 'DM Serif Display', Georgia, serif;
  font-size: 38px;
  line-height: 1;
  letter-spacing: -0.02em;
  color: hsl(var(--foreground));
  opacity: 0;
  transform: translateY(6px);
  pointer-events: none;
  transition:
    opacity 320ms cubic-bezier(.16,1,.3,1),
    transform 320ms cubic-bezier(.16,1,.3,1);
}
.dos-good-job.show {
  opacity: 1;
  transform: translateY(0);
}
.dos-good-job.fading {
  opacity: 0;
  transform: translateY(-4px);
  transition-duration: 460ms;
}

/* Reduced motion — disable the draw + rise transitions, just fade. */
@media (prefers-reduced-motion: reduce) {
  .dos-check-mark .check-stroke {
    stroke-dashoffset: 0;
    animation: none;
  }
  .dos-good-job {
    transition-duration: 200ms;
    transform: none;
  }
  .dos-phase-footer,
  .dos-phase-footer-place {
    animation: none;
  }
}
```

- [ ] **Step 2: Verify dev server compiles**

Run: `npm run dev` (background)
Expected: Vite reports "ready" with no CSS parse errors. Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git branch --show-current
git add src/index.css
git commit -m "$(cat <<'EOF'
css: add shared Day of Show footer + scroll + celebration classes

Adds the keyframes and classes used by the upcoming PlaceFooter
primitive, the Phase 3a celebration mark, and the Phase 1
scrollable schedule layout. Old .done-* classes will be removed
in a follow-up commit once they're no longer referenced.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Create `PlaceFooter` shared primitive

**Files:**
- Create: `src/components/DayOfShow/PlaceFooter.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { formatCityState } from "@/lib/utils";

interface PlaceFooterProps {
  venueName: string | null;
  city: string | null;
  /** Optional full street address, used when building the Maps href.
   *  Display only ever shows City, State — keeping it short. */
  address?: string | null;
}

/**
 * Bottom anchor for Phase 1 + Phase 2 of Day of Show. Renders the
 * venue name in display serif and `City, ST` in mono underneath, the
 * whole element being a tap-target that opens Google Maps. Pinned to
 * the bottom of the phase body via flex-column ordering — caller is
 * responsible for placing it as the last child.
 *
 * Maps href prefers the full street address when available so the pin
 * lands on the venue precisely, falls back to "venue name, city" when
 * we don't have a street.
 */
export default function PlaceFooter({ venueName, city, address }: PlaceFooterProps) {
  if (!venueName) return null;

  const cityDisplay = formatCityState(city ?? "");
  const queryParts = [venueName];
  if (address?.trim()) queryParts.push(address.trim());
  else if (cityDisplay) queryParts.push(cityDisplay);
  const href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryParts.join(", "))}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="dos-phase-footer-place"
    >
      <div className="pf-name">{venueName}</div>
      {cityDisplay && <div className="pf-addr">{cityDisplay}</div>}
    </a>
  );
}
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: Exit 0.

- [ ] **Step 3: Commit**

```bash
git branch --show-current
git add src/components/DayOfShow/PlaceFooter.tsx
git commit -m "$(cat <<'EOF'
feat(dos): add PlaceFooter primitive

Shared bottom anchor for Phase 1 and Phase 2 of Day of Show.
Renders the venue name in display serif and City, ST in mono;
whole element is a tappable Maps link. Display intentionally
omits the street address (the venue name + city already
identifies the place; Maps gets the full address via the link).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Simplify Phase 2 (`PhaseSettle.tsx`)

Strip everything but the slider — no eyebrow, no headline, no subhead, no hotel teaser, no night timeline. The slider is the only thing on screen, vertically centered. The `PlaceFooter` carries the venue identity.

**Files:**
- Modify: `src/components/DayOfShow/PhaseSettle.tsx`

- [ ] **Step 1: Replace the entire `PhaseSettle` component body**

Open `src/components/DayOfShow/PhaseSettle.tsx`. Replace the file contents with:

```tsx
import { useState, useRef, useEffect, useCallback } from "react";
import { ArrowRight, Check } from "lucide-react";
import SettleShowDialog from "@/components/SettleShowDialog";
import PlaceFooter from "./PlaceFooter";
import type { Show } from "@/lib/types";

interface PhaseSettleProps {
  show: Show;
}

/**
 * Phase 2 surface — the show is done, time to wrap. Single dominant
 * Settle CTA centered on the screen, plus the shared place footer
 * underneath. Financial inputs live in SettleShowDialog (mounted on
 * demand). The screen has only one job — settle — so we don't crowd
 * it with eyebrows, headlines, subheads, or hotel teasers. The hotel
 * has its own dedicated surface in Phase 3b.
 */
export default function PhaseSettle({ show }: PhaseSettleProps) {
  const [settleOpen, setSettleOpen] = useState(false);

  return (
    <div className="px-[22px] pt-2 pb-7 flex-1 flex flex-col">
      <div className="flex-1 flex items-center">
        <SlideToSettle onConfirm={() => setSettleOpen(true)} />
      </div>

      <PlaceFooter
        venueName={show.venue_name}
        city={show.city}
        address={show.venue_address}
      />

      <SettleShowDialog show={show} open={settleOpen} onOpenChange={setSettleOpen} />
    </div>
  );
}

/**
 * Slide-to-settle — physical confirm gesture. Drag the green knob
 * right past 92% of the track to fire `onConfirm`. Below threshold
 * the knob snaps back. Idle knob has the mic-chip-pulse halo so the
 * affordance reads as "active / try me"; once dragging, the halo
 * disappears and the track fill follows progress.
 *
 * Why a slide instead of a tap: settle is the only money-touching
 * commit in Day of Show. The drag gesture makes accidental triggering
 * essentially impossible while still feeling like a single satisfying
 * motion. Keyboard fallback (Enter / Space on the focused knob) is
 * the escape hatch for users who can't drag.
 */
const KNOB = 52;
const PAD = 4;

function SlideToSettle({ onConfirm }: { onConfirm: () => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [usable, setUsable] = useState(0);

  useEffect(() => {
    const measure = () => {
      const el = trackRef.current;
      if (!el) return;
      setUsable(
        Math.max(0, el.getBoundingClientRect().width - KNOB - PAD * 2),
      );
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const updateFromClient = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el || usable <= 0) return;
      const r = el.getBoundingClientRect();
      const x = Math.max(
        0,
        Math.min(usable, clientX - r.left - PAD - KNOB / 2),
      );
      setProgress(x / usable);
    },
    [usable],
  );

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => updateFromClient(e.clientX);
    const up = () => {
      setDragging(false);
      setProgress((p) => {
        if (p >= 0.92) {
          setConfirmed(true);
          window.setTimeout(() => onConfirm(), 220);
          return 1;
        }
        return 0;
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [dragging, updateFromClient, onConfirm]);

  const start = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(true);
    updateFromClient(e.clientX);
  };

  const fillAlpha = 0.18 + progress * 0.42;
  const fillStop = Math.max(20, 60 - progress * 30);
  const knobX = progress * usable;

  return (
    <div
      ref={trackRef}
      className="w-full relative overflow-hidden rounded-full border select-none"
      style={{
        height: 60,
        background: "hsl(var(--card))",
        borderColor: "hsl(var(--border))",
        touchAction: "none",
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `linear-gradient(90deg, hsl(var(--success) / ${fillAlpha}) 0%, hsl(var(--success) / 0) ${fillStop}%)`,
          transition: dragging ? "none" : "background 220ms ease",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 flex items-center justify-center text-[11px] uppercase font-medium leading-none"
        style={{
          letterSpacing: "0.22em",
          color: "hsl(var(--muted-foreground))",
          paddingLeft: 56,
          opacity: 1 - Math.min(1, progress * 1.6),
          transition: dragging ? "none" : "opacity 220ms ease",
        }}
      >
        <span>{confirmed ? "Opening…" : "Slide to settle"}</span>
        <ArrowRight
          className="ml-2.5 h-[15px] w-[15px]"
          strokeWidth={1.6}
          style={{ opacity: 0.55 }}
        />
      </div>
      <div
        role="slider"
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={progress}
        aria-label="Slide to settle"
        tabIndex={0}
        onPointerDown={start}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setConfirmed(true);
            setProgress(1);
            window.setTimeout(() => onConfirm(), 220);
          }
        }}
        className={progress > 0.05 || dragging ? "" : "mic-chip-pulse"}
        style={{
          position: "absolute",
          top: PAD,
          left: PAD,
          width: KNOB,
          height: KNOB,
          borderRadius: 999,
          background: "hsl(var(--success))",
          color: "hsl(var(--success-foreground))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: dragging ? "grabbing" : "grab",
          boxShadow: "0 6px 18px hsl(152 60% 30% / 0.5)",
          transform: `translateX(${knobX}px)`,
          transition: dragging
            ? "none"
            : "transform 260ms cubic-bezier(.2,.8,.2,1)",
          touchAction: "none",
        }}
      >
        {confirmed ? (
          <Check className="h-5 w-5" strokeWidth={2.2} />
        ) : (
          <ArrowRight className="h-5 w-5" strokeWidth={2.2} />
        )}
      </div>
    </div>
  );
}
```

The `SlideToSettle` function body is unchanged from the previous file — only the imports were trimmed (no more `Bed`, `ChevronRight`, no more time-utils imports). The outer `PhaseSettle` component is now ~16 lines instead of ~80.

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: Exit 0.

- [ ] **Step 3: Verify lint passes**

Run: `npm run lint`
Expected: Exit 0, no warnings about unused imports.

- [ ] **Step 4: Visual check in dev server**

Run: `npm run dev`. Navigate the app to a settled show's Day of Show overlay (or temporarily fake a Phase 2 by setting a show's set time +90min in the past). Confirm:
- Slider sits centered vertically
- No top eyebrow, no headline, no subhead, no hotel teaser, no night timeline
- Place footer at bottom shows venue name + City, ST and is tappable to Maps

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git branch --show-current
git add src/components/DayOfShow/PhaseSettle.tsx
git commit -m "$(cat <<'EOF'
feat(dos): simplify Phase 2 to slider + place footer

Strips the eyebrow, headline, subhead, hotel teaser, and night
timeline. The slider is the only thing on screen, vertically
centered. The shared PlaceFooter carries the venue identity.

Phase 3b is the dedicated hotel surface, so surfacing the hotel
on Phase 2 was duplicating future state into present state.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Restructure Phase 1 (`PhasePreShow.tsx`) for scrollable schedule

The schedule is the only variable-length element. Pin everything else (hero at top, DOS contact + place footer at bottom). The schedule scrolls in the middle with soft fades on top and bottom.

**Files:**
- Modify: `src/components/DayOfShow/PhasePreShow.tsx`

- [ ] **Step 1: Restructure `PhasePreShow.tsx`**

Open `src/components/DayOfShow/PhasePreShow.tsx`. Replace the file contents with:

```tsx
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Phone } from "lucide-react";
import { to24Hour } from "@/lib/timeFormat";
import type { Show, ScheduleEntry } from "@/lib/types";
import ScheduleList from "./ScheduleList";
import PlaceFooter from "./PlaceFooter";
import { fmt12parts, formatRelative, showDayMinutes } from "./timeUtils";

interface PhasePreShowProps {
  show: Show;
  /** Current local time as minutes past midnight. Drives the hero + dim states. */
  nowMin: number;
}

/**
 * Phase 1 surface — pre-show. Three regions, top-to-bottom:
 *
 *   - Hero (pinned top): "UP NEXT" eyebrow + label + big serif time +
 *     relative countdown. Single-column; the venue lives in the place
 *     footer below.
 *   - Schedule (scrolls): the operative artifact. Soft fades top and
 *     bottom keep the edges from hard-clipping. The schedule grows
 *     freely without breaking the layout — long festival schedules
 *     just scroll inside the device frame.
 *   - DOS contact + place footer (pinned bottom): always reachable
 *     regardless of how long the schedule is.
 *
 * The flex chain on every column container needs `min-height: 0` so
 * the scroll child can shrink below content size. Without it, the
 * schedule pushes the contact + footer off-screen.
 */
export default function PhasePreShow({ show, nowMin }: PhasePreShowProps) {
  const navigate = useNavigate();
  const sortedEntries = useMemo<ScheduleEntry[]>(() => {
    const entries = [...(show.schedule_entries ?? [])];
    entries.sort((a, b) => {
      const am = showDayMinutes(a.time);
      const bm = showDayMinutes(b.time);
      if (am === null && bm === null) return a.sort_order - b.sort_order;
      if (am === null) return 1;
      if (bm === null) return -1;
      if (am !== bm) return am - bm;
      return a.sort_order - b.sort_order;
    });
    return entries;
  }, [show.schedule_entries]);

  const heroIndex = useMemo(() => {
    const idx = sortedEntries.findIndex((e) => {
      const m = showDayMinutes(e.time);
      return m !== null && m >= nowMin;
    });
    if (idx !== -1) return idx;
    return sortedEntries.length > 0 ? sortedEntries.length - 1 : null;
  }, [sortedEntries, nowMin]);

  const hero = heroIndex !== null ? sortedEntries[heroIndex] : null;
  const heroMin = hero ? showDayMinutes(hero.time) : null;
  const remaining = heroMin !== null ? heroMin - nowMin : null;
  const isFuture = remaining !== null && remaining > 0;
  const heroParts = hero ? fmt12parts(to24Hour(hero.time) ?? hero.time) : null;

  const dosContact = useMemo(
    () => (show.show_contacts ?? []).find((c) => c.role === "day_of_show") ?? null,
    [show.show_contacts],
  );

  return (
    <div
      className="px-[22px] pt-2 pb-7 flex-1 flex flex-col gap-4"
      // min-height: 0 is critical — without it the scroll region below
      // can't shrink below content size, and the schedule pushes the
      // pinned footer + contact card off the device frame.
      style={{ minHeight: 0 }}
    >
      {/* Hero (pinned top) */}
      <div className="pt-[10px] pb-1" data-stagger="0">
        <div
          className="text-[11px] uppercase font-medium leading-none mb-2.5"
          style={{ letterSpacing: "0.18em", color: "hsl(var(--muted-foreground))" }}
        >
          {isFuture ? "Up next" : "Now"}
        </div>
        {hero && (
          <>
            <div
              className="text-[22px] font-medium leading-[1.05]"
              style={{ letterSpacing: "-0.02em", color: "hsl(var(--foreground))" }}
            >
              {hero.label}
            </div>
            {heroParts && (
              <div
                className="mt-3 flex items-baseline gap-2 tabular-nums"
                style={{ letterSpacing: "-0.03em" }}
              >
                <span
                  className="font-display"
                  style={{
                    fontSize: 64,
                    lineHeight: 0.92,
                    color: "hsl(var(--foreground))",
                  }}
                >
                  {heroParts.n}
                </span>
                <span
                  className="font-display"
                  style={{
                    fontSize: 22,
                    lineHeight: 0.92,
                    letterSpacing: "-0.02em",
                    color: "hsl(var(--muted-foreground))",
                  }}
                >
                  {heroParts.u}
                </span>
              </div>
            )}
            {remaining !== null && (
              <div
                className="mt-2.5 text-[13px] font-medium leading-[1.2]"
                style={{ color: "hsl(var(--muted-foreground))" }}
              >
                {isFuture ? formatRelative(remaining) : "now"}
              </div>
            )}
          </>
        )}
      </div>

      {/* Schedule (scrolls in middle) */}
      {sortedEntries.length > 0 && (
        <div className="dos-p1-scroll-wrap" data-stagger="2">
          <div className="dos-p1-scroll-fade top" />
          <div className="dos-p1-scroll">
            <ScheduleList
              entries={sortedEntries}
              nowMin={nowMin}
              heroIndex={heroIndex}
            />
          </div>
          <div className="dos-p1-scroll-fade bottom" />
        </div>
      )}

      {/* DOS contact (pinned, simplified) */}
      <a
        href={dosContact?.phone ? `tel:${dosContact.phone}` : undefined}
        onClick={
          dosContact?.phone
            ? undefined
            : (e) => {
                e.preventDefault();
                navigate(`/shows/${show.id}?tab=contacts`);
              }
        }
        className="flex items-center gap-3 rounded-[12px] border bg-card px-3.5 py-2.5 transition-transform active:scale-[0.985]"
        style={{ borderColor: "hsl(var(--border))" }}
        data-stagger="3"
      >
        <div className="flex-1 min-w-0">
          <div
            className="text-[14px] font-medium leading-tight truncate"
            style={{
              color: dosContact?.name
                ? "hsl(var(--foreground))"
                : "hsl(var(--muted-foreground))",
            }}
          >
            {dosContact?.name ?? "Add a day-of contact"}
          </div>
          <div
            className="mt-1 text-[11px] uppercase font-medium leading-none"
            style={{ letterSpacing: "0.14em", color: "hsl(var(--muted-foreground))" }}
          >
            Day of Show contact
          </div>
        </div>
        <div
          aria-hidden
          className="shrink-0 inline-flex items-center justify-center rounded-full"
          style={{
            width: 34,
            height: 34,
            background: "hsl(152 60% 22% / 0.55)",
            color: "hsl(152 60% 78%)",
          }}
        >
          <Phone className="h-[15px] w-[15px]" strokeWidth={1.7} />
        </div>
      </a>

      {/* Place footer (pinned bottom) */}
      <PlaceFooter
        venueName={show.venue_name}
        city={show.city}
        address={show.venue_address}
      />
    </div>
  );
}
```

Notes for the implementer:
- The `ActionCard` import is gone. The simplified DOS contact is inlined here because its shape no longer matches `ActionCard`'s eyebrow/title/sub model (no phone number rendered, role is the eyebrow now).
- The `ArrowUpRight` icon, `roleLabel`, `normalizePhone`, and `formatCityState` imports are gone — `PlaceFooter` handles the venue + city; the contact no longer shows the phone.
- `addressLines` helper is gone (was only used by the old two-column hero).
- `data-stagger` attributes preserved for the existing entrance choreography in `phase-morph` CSS.

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: Exit 0, no errors about unused imports or missing references.

- [ ] **Step 3: Verify lint passes**

Run: `npm run lint`
Expected: Exit 0.

- [ ] **Step 4: Manual visual check (short schedule)**

Start dev server, open Day of Show on a show with 5 schedule entries. Verify:
- Hero pinned at top
- Schedule renders normally (no scrollbar; with only 5 entries it should fit)
- Simplified DOS contact card visible at bottom (name + "DAY OF SHOW CONTACT" eyebrow + circular green phone glyph). No phone number rendered.
- Place footer pinned at the very bottom (venue name + City, ST)

Tap the contact → should open phone dialer (or fall back to navigating to `/shows/:id?tab=contacts` if no phone is set).

- [ ] **Step 5: Manual visual check (long schedule)**

On the same show, temporarily insert ~12 schedule entries via the show detail page (or use a real festival show if available). Re-open the Day of Show overlay. Verify:
- Schedule scrolls inside the device frame
- Top edge fades into the hero (no hard line)
- Bottom edge fades into the contact card (no hard clip)
- Contact card + place footer stay pinned and reachable
- Hero stays pinned at the top

Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git branch --show-current
git add src/components/DayOfShow/PhasePreShow.tsx
git commit -m "$(cat <<'EOF'
feat(dos): restructure Phase 1 — scrollable schedule + pinned footer

Three pinned regions, one scrollable middle: hero on top,
schedule scrolls (with soft top/bottom fades), DOS contact +
place footer pinned at the bottom. The hero is now single-column
(time + countdown) — venue moved to the shared place footer.
DOS contact simplified: name + role label + circular phone
glyph; phone number no longer rendered on screen.

The two-column hero with the venue mirror is gone; the place
footer takes the role of "where you are." Long schedules
(festival lineups, multi-opener nights) scroll inside the device
frame instead of pushing critical UI off-screen.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Build the Phase 3b `HotelReveal` component

Centered hotel card with conditional chips. Renders only what's available — both fields → both chips, address only → Maps, phone only → Call.

**Files:**
- Create: `src/components/DayOfShow/HotelReveal.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { Bed, MapPin, Phone } from "lucide-react";
import { formatCityState, normalizePhone } from "@/lib/utils";
import type { Show } from "@/lib/types";

interface HotelRevealProps {
  show: Show;
}

/**
 * Phase 3b surface — hotel reveal. Mounts when `dos_closed_at` is
 * set on the show (the celebration in Phase 3a has already played
 * once). The card is centered vertically; the line footer ("Sleep
 * well." picked from the deterministic SIGN_OFFS pool by
 * PhasePostSettle) sits at the bottom. Same vertical rhythm as the
 * other phases.
 *
 * Action chips render conditionally:
 *
 *   address + phone → Open in Maps  +  Call front desk
 *   address only    → Open in Maps
 *   phone only      → Call front desk
 *   neither         → no chips (name-only fallback)
 *
 * The whole hotel section degrades gracefully — if there's not even
 * a hotel name, the parent renders just the line footer instead.
 */
export default function HotelReveal({ show }: HotelRevealProps) {
  const hasAddress = !!show.hotel_address?.trim();
  const hasPhone = !!show.hotel_phone?.trim();

  const cityDisplay = formatCityState(show.city ?? "");
  const addrSubline = (() => {
    if (show.hotel_address?.trim()) {
      const parts = show.hotel_address.split(",").map((s) => s.trim()).filter(Boolean);
      return parts.length > 1 ? parts.slice(1).join(", ") : (cityDisplay || parts[0]);
    }
    return cityDisplay || null;
  })();

  const mapsHref = hasAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        [show.hotel_name, show.hotel_address].filter(Boolean).join(", "),
      )}`
    : undefined;

  const phoneHref = hasPhone ? `tel:${(show.hotel_phone ?? "").replace(/[^\d+]/g, "")}` : undefined;

  return (
    <div className="flex-1 flex items-center">
      <div
        className="w-full rounded-[18px] border p-6 flex flex-col gap-2.5"
        style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
      >
        <div
          className="inline-flex items-center justify-center rounded-[12px] mb-1"
          style={{
            width: 48,
            height: 48,
            background: "var(--pastel-blue-bg)",
            color: "var(--pastel-blue-fg)",
          }}
        >
          <Bed className="h-[22px] w-[22px]" strokeWidth={1.6} />
        </div>
        <div
          className="font-display"
          style={{
            fontSize: 26,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            color: "hsl(var(--foreground))",
          }}
        >
          {show.hotel_name}
        </div>
        {addrSubline && (
          <div
            className="font-mono text-[12.5px]"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            {addrSubline}
          </div>
        )}

        {(hasAddress || hasPhone) && (
          <div className="mt-3 flex gap-2.5">
            {hasAddress && (
              <a
                href={mapsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 h-[42px] rounded-[12px] border text-[13px] font-medium transition-colors hover:bg-muted active:scale-[0.985]"
                style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }}
              >
                <MapPin className="h-[14px] w-[14px]" strokeWidth={1.6} />
                Open in Maps
              </a>
            )}
            {hasPhone && (
              <a
                href={phoneHref}
                className="flex-1 inline-flex items-center justify-center gap-2 h-[42px] rounded-[12px] border text-[13px] font-medium transition-colors hover:bg-muted active:scale-[0.985]"
                style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }}
                aria-label={`Call ${show.hotel_name} front desk at ${normalizePhone(show.hotel_phone ?? "")}`}
              >
                <Phone className="h-[14px] w-[14px]" strokeWidth={1.6} />
                Call front desk
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: Exit 0.

- [ ] **Step 3: Commit**

```bash
git branch --show-current
git add src/components/DayOfShow/HotelReveal.tsx
git commit -m "$(cat <<'EOF'
feat(dos): add HotelReveal (Phase 3b) component

Centered hotel card with conditional action chips. Renders
"Open in Maps" only when hotel_address is set, "Call front desk"
only when hotel_phone is set. Both → both chips. Neither → card
with name only. Uses normalizePhone for the tel: href to strip
formatting characters.

Not yet wired — PhasePostSettle still exports the legacy
celebration. The 3a/3b branch lands in the next commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Rewrite `PhasePostSettle` — branch on `dos_closed_at`, add celebration

Replace the legacy `DoneMark` press-and-hold with the new auto-played celebration AND branch on `dos_closed_at` so subsequent opens land directly on the hotel reveal. On Phase 3a mount, fire the persistence mutation. The mount-time `useState(() => ...)` snapshot prevents the celebration from being interrupted when the query refetches with the now-set timestamp.

Strict timing for the celebration:

```
0       Phase 3a mounts (mutation fires)
120     check stroke begins drawing (CSS animation-delay)
880     check fully drawn (760ms ease-out-expo)
1380    check begins fading out (after 500ms hold beat)
1740    check fully gone
1740    "Good job." rises in (320ms fade-up)
2060    "Good job." at full opacity, linger begins
3160    "Good job." begins fading out (460ms)
3620    onShowDone() fires → overlay dismisses
```

Reduced motion is handled by the `@media (prefers-reduced-motion: reduce)` block already added to `src/index.css` in Task 3 — the timeline still runs (so persistence and dismiss fire on schedule), but visually it's a quiet cross-fade.

**Files:**
- Modify: `src/components/DayOfShow/PhasePostSettle.tsx`

- [ ] **Step 1: Replace the file's main export and remove the legacy `DoneMark`**

Replace the file's contents entirely with:

```tsx
import { useEffect, useRef, useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Show } from "@/lib/types";
import HotelReveal from "./HotelReveal";

/**
 * Pool of sign-offs picked deterministically by show date so the same
 * show always shows the same line (stable across re-opens) but the
 * line varies day-to-day across a tour.
 */
const SIGN_OFFS = [
  "Good night.",
  "Sleep well.",
  "Until tomorrow.",
  "Rest up.",
  "See you in the morning.",
  "Until the next one.",
];

function signOffFor(date: string | null | undefined): string {
  if (!date || typeof date !== "string") return "See you soon.";
  const seed = date.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return SIGN_OFFS[seed % SIGN_OFFS.length];
}

interface PhasePostSettleProps {
  show: Show;
  onShowDone?: () => void;
}

/**
 * Phase 3 — settled. Branches into:
 *
 *   3a (celebration) — runs once, on first open after settle. Persists
 *      `dos_closed_at` on mount so subsequent opens land on 3b. Auto-
 *      plays a ~3.6s sequence (check draws, holds, fades; "Good job."
 *      rises, lingers, fades). Tap-anywhere skips to dismiss.
 *
 *   3b (hotel reveal) — runs on every subsequent open. Centered hotel
 *      card with conditional Maps + Call chips, then the line footer.
 *
 * The branch is captured ONCE at first render via useState(() => ...)
 * so a successful mutation that updates `dos_closed_at` mid-sequence
 * can't swap the surface to 3b while the celebration is still playing.
 *
 * Degenerate case: if there's no hotel name, both 3a (after dismiss)
 * and 3b would have nothing to show. Phase 3a still plays normally.
 * Phase 3b in the no-hotel case renders just the line footer.
 */
export default function PhasePostSettle({ show, onShowDone }: PhasePostSettleProps) {
  // Capture the closed state at mount time so subsequent re-fetches
  // (e.g. the mutation success cache invalidation) don't swap the
  // surface mid-celebration.
  const [wasClosedAtMount] = useState(() => !!show.dos_closed_at);

  if (!wasClosedAtMount) {
    return <Phase3aCelebration show={show} onDone={onShowDone ?? (() => {})} />;
  }

  return (
    <div className="px-[22px] pt-2 pb-7 flex-1 flex flex-col">
      {show.hotel_name ? <HotelReveal show={show} /> : <div className="flex-1" />}
      <div className="dos-phase-footer">{signOffFor(show.date)}</div>
    </div>
  );
}

// ─── Phase 3a — celebration (auto-played, ~3.6s) ────────────────

const T_CELEBRATION = {
  checkDrawEnd:   880,
  checkHoldBeat:  500,
  checkFadeOut:   360,
  goodJobIn:      320,
  goodJobLinger: 1100,
  goodJobFadeOut: 460,
} as const;
const T_CHECK_GONE   = T_CELEBRATION.checkDrawEnd + T_CELEBRATION.checkHoldBeat + T_CELEBRATION.checkFadeOut;
const T_GOODJOB_PEAK = T_CHECK_GONE + T_CELEBRATION.goodJobIn;
const T_GOODJOB_FADE = T_GOODJOB_PEAK + T_CELEBRATION.goodJobLinger;
const T_DISMISS      = T_GOODJOB_FADE + T_CELEBRATION.goodJobFadeOut;

function Phase3aCelebration({ show, onDone }: { show: Show; onDone: () => void }) {
  const [checkFading, setCheckFading] = useState(false);
  const [goodJobShow, setGoodJobShow] = useState(false);
  const [goodJobFading, setGoodJobFading] = useState(false);

  const skippedRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // Persist dos_closed_at on first mount. Optimistic update writes
  // the timestamp into the cached show immediately so any subsequent
  // refetch sees the closed state. Failures are logged but don't
  // roll the UI back — re-running the celebration on a later open
  // is a worse outcome than dropping a single network hit.
  const queryClient = useQueryClient();
  const closeMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("shows")
        .update({ dos_closed_at: new Date().toISOString() })
        .eq("id", show.id)
        .is("dos_closed_at", null);
      if (error) throw error;
    },
    onMutate: async () => {
      const key = ["show", show.id];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Show>(key);
      if (previous) {
        queryClient.setQueryData<Show>(key, {
          ...previous,
          dos_closed_at: new Date().toISOString(),
        });
      }
      return { previous };
    },
    onError: (err) => {
      // No rollback — see comment above.
      console.warn("dos_closed_at persistence failed", err);
    },
  });

  // Fire the mutation exactly once on mount.
  const closedRef = useRef(false);
  useEffect(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    closeMutation.mutate();
    // We intentionally don't list closeMutation in deps — it's stable
    // for the lifetime of this component, and listing it would risk
    // re-running the effect on a re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Run the celebration timeline.
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    timers.push(setTimeout(() => {
      if (skippedRef.current) return;
      setCheckFading(true);
    }, T_CELEBRATION.checkDrawEnd + T_CELEBRATION.checkHoldBeat));

    timers.push(setTimeout(() => {
      if (skippedRef.current) return;
      setGoodJobShow(true);
    }, T_CHECK_GONE));

    timers.push(setTimeout(() => {
      if (skippedRef.current) return;
      setGoodJobShow(false);
      setGoodJobFading(true);
    }, T_GOODJOB_FADE));

    timers.push(setTimeout(() => {
      if (skippedRef.current) return;
      onDoneRef.current();
    }, T_DISMISS));

    return () => {
      timers.forEach(clearTimeout);
    };
  }, []);

  const skip = useCallback(() => {
    if (skippedRef.current) return;
    skippedRef.current = true;
    setCheckFading(true);
    setGoodJobShow(false);
    setGoodJobFading(true);
    window.setTimeout(() => onDoneRef.current(), T_CELEBRATION.goodJobFadeOut);
  }, []);

  return (
    <div
      className="px-[22px] pt-2 pb-7 flex-1 flex flex-col"
      onClick={skip}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          skip();
        }
      }}
      aria-label="Tap to dismiss"
    >
      <div className="flex-1 flex items-center justify-center">
        <div className="relative flex flex-col items-center">
          <div className={`dos-check-mark${checkFading ? " fading" : ""}`}>
            <svg viewBox="0 0 72 72" width="96" height="96" className="block overflow-visible">
              <path className="check-stroke" d="M 19 38 L 31 50 L 55 24" />
            </svg>
          </div>
          <div
            className={`dos-good-job${goodJobShow ? " show" : ""}${goodJobFading ? " fading" : ""}`}
            style={{ top: 28 }}
          >
            Good job.
          </div>
        </div>
      </div>

      <div className="dos-phase-footer">{signOffFor(show.date)}</div>
    </div>
  );
}
```

This deletes the legacy `DoneMark` function and the legacy `PhasePostSettle` body. The new file is a single export with two internal components and the persistence mutation.

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: Exit 0.

- [ ] **Step 3: Verify lint passes**

Run: `npm run lint`
Expected: Exit 0. (The eslint-disable for the empty-deps useEffect on `closeMutation.mutate()` is intentional — see the inline comment.)

- [ ] **Step 4: Manual test — celebration flow**

Start `npm run dev`. On a settled show, open Day of Show. The phase resolves to 3 (because `is_settled = true`). Because `dos_closed_at` is null, you should see Phase 3a:
- Check stroke draws itself in (~760ms), holds, fades.
- "Good job." rises in (~320ms), holds, fades.
- Overlay dismisses back to dashboard.
- Reload the dashboard. Tap the powered-down mic icon. Day of Show re-opens.
- This time `dos_closed_at` is set → you should see Phase 3b directly: hotel card centered, line footer at bottom. The celebration does NOT play.

- [ ] **Step 5: Manual test — tap-skip**

Reset `dos_closed_at` for testing (via Supabase MCP `execute_sql`):

```sql
UPDATE public.shows SET dos_closed_at = NULL WHERE id = '<test-show-id>';
```

Reload, open Day of Show. While the check is drawing or holding, tap anywhere on the body. Confirm:
- Sequence skips immediately.
- Overlay dismisses (~460ms).
- Re-open: `dos_closed_at` IS still set (the mutation fires on mount, not at end of sequence) → 3b renders.

- [ ] **Step 6: Manual test — reduced motion**

macOS System Settings → Accessibility → Display → Reduce Motion → ON. Reset `dos_closed_at` again. Re-open Day of Show:
- Check renders static (no draw animation).
- "Good job." cross-fades in/out.
- Sequence completes; dismiss happens; `dos_closed_at` persists.

Turn Reduce Motion back OFF.

Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git branch --show-current
git add src/components/DayOfShow/PhasePostSettle.tsx
git commit -m "$(cat <<'EOF'
feat(dos): split Phase 3 into 3a celebration / 3b hotel reveal

Branches on dos_closed_at captured at mount time. First open
after settle plays the auto-played celebration and persists the
timestamp via an optimistic mutation. Subsequent opens render
the HotelReveal (Phase 3b) directly with no celebration.

Capturing wasClosedAtMount once via useState(() => ...) prevents
the cache invalidation from the same mutation from interrupting
the celebration mid-sequence.

The legacy press-and-hold DoneMark is removed; the slider in
Phase 2 is the only commitment gesture in the flow now.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Add `hotel_phone` field to `ShowDetailPage`

Surface the phone number in the existing hotel section as an inline-editable field. Edit form gets a row between Confirmation # and the Check-in/Check-out grid. Read-only display shows the number under the address with a tappable `tel:` link.

**Files:**
- Modify: `src/pages/ShowDetailPage.tsx`

- [ ] **Step 1: Add `hotel_phone` to the hotel group editor keys**

Find the `useGroupEditor` call for the hotel group (around line 699–707 based on the existing layout). Update the `keys` and `isEmpty` to include `hotel_phone`:

```ts
const hotelEditor = useGroupEditor({
  groupKey: "hotel_group",
  keys: ["hotel_name", "hotel_address", "hotel_phone", "hotel_confirmation", "hotel_checkin", "hotel_checkin_date", "hotel_checkout", "hotel_checkout_date"] as const,
  show,
  inlineField,
  setInlineField,
  updateMutation,
  isEmpty: s => !s.hotel_name && !s.hotel_address && !s.hotel_phone && !s.hotel_confirmation && !s.hotel_checkin && !s.hotel_checkin_date && !s.hotel_checkout && !s.hotel_checkout_date,
});
```

Also update the `defaultOpen` prop on the Section that wraps this editor (around line 1713) to include `hotel_phone`:

```tsx
defaultOpen={!!(show.hotel_name || show.hotel_address || show.hotel_phone || show.hotel_confirmation || show.hotel_checkin || show.hotel_checkin_date || show.hotel_checkout || show.hotel_checkout_date)}
```

- [ ] **Step 2: Add the editable `Front desk phone` row to the edit form**

Find the edit-mode block that renders the hotel form (around line 1721–1779). Add a new row immediately after the `Confirmation #` block and before the check-in/check-out grid:

```tsx
<div className="space-y-1">
  <Label className="text-sm text-muted-foreground">Front desk phone</Label>
  <InlineField
    value={hotelEditor.get("hotel_phone")}
    onChange={(v) => hotelEditor.setField("hotel_phone", v)}
    type="tel"
    mono
    placeholder="(555) 123-4567"
  />
</div>
```

Note: `useGroupEditor`'s `setField` handles the trim-and-set; `normalizePhone` normalization can run on save, but we'll keep it simple and let the InlineField pass raw text through. The `tel:` href in `HotelReveal` uses `.replace(/[^\d+]/g, "")` to strip formatting at call time, which handles raw input fine.

- [ ] **Step 3: Surface the phone in the read-only display block**

Find the read-only display block (around line 1795–1815, the section that renders `show.hotel_name` and `show.hotel_address`). Add a phone row right after the address:

```tsx
{show.hotel_phone && (
  <a
    href={`tel:${show.hotel_phone.replace(/[^\d+]/g, "")}`}
    onClick={(e) => e.stopPropagation()}
    className={cn(
      "block text-sm text-muted-foreground hover:text-foreground transition-colors",
      (show.hotel_name || show.hotel_address) && "mt-1.5"
    )}
  >
    {normalizePhone(show.hotel_phone)}
  </a>
)}
```

Verify `cn` and `normalizePhone` are imported at the top of the file. They already should be — `cn` is used throughout, `normalizePhone` for other phone fields.

- [ ] **Step 4: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: Exit 0.

- [ ] **Step 5: Verify lint passes**

Run: `npm run lint`
Expected: Exit 0.

- [ ] **Step 6: Manual test**

Start `npm run dev`. Open a show's detail page. In the hotel section:
- Click into edit mode.
- Verify "Front desk phone" row sits between Confirmation # and Check In.
- Enter a phone number (e.g. `(555) 123-4567`). Save.
- Read-only view shows the number formatted via `normalizePhone`.
- Click the number → opens phone dialer.

Then open the show in Day of Show. If the show is settled and `dos_closed_at` is set, Phase 3b should render the "Call front desk" chip. Toggle the phone field on/off via Show Detail to verify the chip appears/disappears correctly.

Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git branch --show-current
git add src/pages/ShowDetailPage.tsx
git commit -m "$(cat <<'EOF'
feat(shows): add hotel_phone field to hotel section

Inline-editable on ShowDetailPage between Confirmation # and the
check-in/check-out dates; read-only display shows the formatted
number via normalizePhone with a tel: link. Drives the "Call
front desk" chip on the Day of Show hotel reveal (Phase 3b).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Final visual verification + housekeeping

The app should now have all the new behavior. This task is a holistic sweep + commit any remaining cleanup.

**Files:**
- Maybe modify: nothing (verification-only by default)

- [ ] **Step 1: Check for orphaned old CSS classes**

Run: `grep -rn "done-mark\|done-circle\|done-check\|done-check-completed" src/`
Expected: only matches inside `src/index.css` (the keyframe rules from the previous design that are no longer referenced from any component).

- [ ] **Step 2: Remove orphaned CSS rules**

If Step 1 confirms only `src/index.css` references remain, find and delete the rules for `.done-mark`, `.done-circle`, `.done-check`, `.done-check-completed`, the `done-circle-draw`, `done-check-draw`, `done-check-fill`, and `done-dot-pop` keyframes (or whichever subset is present). They are exclusive to the prior celebration design and are no longer used.

- [ ] **Step 3: Run the full check suite**

Run all in order:
```bash
npx tsc --noEmit
npm run lint
npm test -- --run
```

Expected: all exit 0.

- [ ] **Step 4: Holistic dev-server sweep**

Start `npm run dev`. Walk through:
1. Phase 1 short schedule — pinned hero, normal scroll behavior, contact + footer pinned, all looks calm.
2. Phase 1 long schedule (insert ~12 entries to a test show) — schedule scrolls inside the device, top + bottom fades visible, contact + footer always reachable.
3. Phase 2 — slider centered, no other UI, place footer at bottom, slide → SettleShowDialog opens. After settling, overlay flips to Phase 3a.
4. Phase 3a — celebration auto-plays (check draws, "Good job." rises, dismiss).
5. Re-open same show in Day of Show — Phase 3b directly with hotel card. Toggle `hotel_phone` via Show Detail to verify chip behavior. Toggle `hotel_address` similarly.
6. Phase 3b with no hotel info — line footer "Sleep well." centered, no card, no errors.
7. Place footer in Phase 1 + Phase 2 → tap → opens Maps in new tab.

Stop the dev server.

- [ ] **Step 5: Commit any cleanup**

If Step 2 deleted any CSS, commit:

```bash
git branch --show-current
git add src/index.css
git commit -m "$(cat <<'EOF'
chore(css): remove orphaned .done-* celebration styles

The previous press-and-hold celebration is gone; these rules
have no remaining references in the codebase.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

If Step 2 was a no-op, skip this step.

- [ ] **Step 6: Push and open PR**

Hand off to the `/pr` skill — it handles push, PR creation, and cleanup with its own branch verification.

```
/pr
```

The PR description should reference the spec at `docs/superpowers/specs/2026-04-29-day-of-show-phase-refinements-design.md` and link the prototype at `prototypes/day-of-show-phase3/index.html` so reviewers have the full design context.

---

## Notes for the implementer

### What stays untouched
- `useDayOfShowPhase` (still 1 | 2 | 3)
- `DayOfShowFloatingButton` (powered-down mic on `is_settled` is the right behavior; nothing changes)
- `DayOfShowMode` (already fetches the full `show.*`; new columns ride along automatically)
- `SettleShowDialog`
- `ScheduleList`
- `ActionCard` (no longer used by Phase 1; if `grep` confirms zero references after the rewrite, optional follow-up to delete the file in a separate PR — out of scope here)

### Why `dos_closed_at` is set on mount, not at end of animation
A network blip during the 3.6-second celebration would otherwise leave the show settled but not closed, re-running the celebration on next open. Setting on mount means the moment is "consumed" the instant the user reaches it — the worst case is a missed persistence (next open replays the celebration once more, no harm done) instead of a confusingly-stuck state.

### Why `useState(() => !!show.dos_closed_at)` instead of just `!!show.dos_closed_at`
The mutation in 3a invalidates the query, which refetches the show with `dos_closed_at` now set. Without the snapshot, the parent would re-render and swap us from 3a to 3b mid-celebration. The `useState` initializer captures the value once per mount and ignores subsequent prop changes for branching purposes.

### Why fades are sibling overlays, not `mask-image`
`mask-image` on a scrollable container breaks pointer/touch events on Chromium and Safari. The fade overlays sit in absolutely-positioned siblings of the scroll container with `pointer-events: none`, so the user's wheel/touch events go straight through to the scroll container.

### `min-height: 0` is not optional
Flex children default to `min-height: auto` (≈ "fit content"). A scroll container inside such a chain can't shrink below its content size, so the schedule pushes everything below it off-screen rather than scrolling internally. Every flex column ancestor of `.dos-p1-scroll` needs `min-height: 0` for native scroll to work.

### Reduced motion is handled by CSS, not React
The `@media (prefers-reduced-motion: reduce)` block in `src/index.css` neutralizes the stroke-draw animation and the rise transform. The component still walks the timeline (so `dos_closed_at` persists and the dismiss happens on schedule), but visually it becomes a quiet cross-fade.
