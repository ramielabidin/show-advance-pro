# Handoff: Day of Show Mode

## Overview

**Day of Show Mode** is a focused, glanceable mobile surface for tour managers on the day of a show. It collapses today's show detail into one screen that **reshapes itself as the night progresses** — pre-show countdown → settle → post-settle hotel reveal.

Tour managers live on their phone the day of show. Today they navigate dashboard → show detail → hunt for the schedule moment they need. Day of Mode replaces that with a single surface where the next moment is always the largest thing on screen.

The user enters Day of Show Mode from a glowing **mic chip** in the dashboard header. The chip is present **only on a show day that hasn't been settled** — never on non-show days, and never after the show resolves (next app open past 5am local after settle). Label is `Day of Show` (mixed case) on the dashboard chip; the in-surface eyebrow is `DAY OF SHOW` (all caps).

---

## About the Design Files

The HTML files in this bundle are **design references** — high-fidelity prototypes built in HTML/React/Babel that show the intended look and behavior. **They are not production code to copy directly.**

The task is to recreate these designs in the **`show-advance-pro`** codebase (React 18 + TypeScript + Vite + Tailwind + shadcn/Radix), following the existing conventions in `src/components/`, `src/pages/`, and `src/lib/`. The CSS tokens in `colors_and_type.css` mirror what's already in `src/index.css` — reuse those, don't redefine them.

If you ever build this in a fresh codebase, pick the framework that fits the project; the structure described below is framework-agnostic.

---

## Fidelity

**High-fidelity.** Final colors, typography, spacing, copy, and interactions are all locked. Recreate the UI pixel-close in the existing codebase.

Caveats:
- Lucide icon names are exact; sizing follows the kit's `h-3.5 / h-4 / h-5` scale.
- All copy is final and follows the Advance voice (sentence case for actions, ALL CAPS eyebrows, never emoji).

---

## Out of scope (per the original prompt)

- Running-late broadcast
- Multi-show days
- Financial detail / deal terms
- Set list editor
- Full party list
- **Inline settle** — the settle CTA buttons out to the existing settle surface; v1 does not embed it
- **Light mode** — dark only for v1; light parity is a follow-up

---

## Files in this bundle

| File | Purpose |
| --- | --- |
| `Day of Show Mode.html` | Main interactive prototype — phone frame, dashboard entry, three phases, scrubber, Tweaks |
| `Day of Show — Variants.html` | Side-by-side canvas — four end-states + variant explorations |
| `dos-data.jsx` | Show data shape + time/phase helpers (`computePhase`, `computeScheduleState`) |
| `dos-dashboard.jsx` | Dashboard. Mic chip is canonical in the header; three placements supported behind a prop for the variants canvas. Visibility gated by `isShowDay && !isSettled`. |
| `dos-mode.jsx` | The Day of Show surface — three phase components |
| `dos-primitives.jsx` | `Icon`, `Eyebrow`, `Chip`, `MicChip`, `StatusBar` |
| `dos-app.jsx` | Root: phone frame stage + scrubber + Tweaks wiring |
| `canvas-frames.jsx` | Variants canvas composition |
| `colors_and_type.css` | Design tokens (mirrors `src/index.css`) |
| `tweaks-panel.jsx`, `design-canvas.jsx` | Demo scaffolding only — **do not port to the app** |
| `assets/logo.svg` | Existing brand asset, reuse from repo |

---

## Entry — the glowing mic chip

A pill-shaped chip with a pulsing blue glow lives in the dashboard header on a show day. Tapping it enters Day of Show Mode.

### Canonical placement: dashboard header, beside the greeting

The chip sits to the right of the `"Good evening."` greeting, on the same row as the date eyebrow / day name. It reads as a status badge for *today* — not bolted onto a specific show card. Three placements were explored in review; **header was chosen**, the other two were rejected (see below).

```
Layout: header row is flex, space-between, align-items: center, gap 12, flex-wrap wrap
Left:   <h1>Good evening.</h1>   (DM Sans 500 26px/-0.02em)
Right:  <MicChip label="Day of Show" onClick={enterDOS}/>   (when chipVisible)
```

### Visibility rules

The chip renders only when `isShowDay && !isSettled`:

| State | Chip |
| --- | --- |
| Today is **not** a show day | **Hidden** — no placeholder, no slot. The greeting subhead reads e.g. "No show today — Paper Tiger in 2 days." |
| Today **is** a show day, `is_settled === false` | **Visible**, pulsing blue glow. Subhead: "Tonight you're in Austin." |
| Today is a show day, `is_settled === true` | **Hidden** until auto-resolve at 5am next day. Subhead: "Show settled. Drive safe." |

The chip never appears on a future show's card (e.g. May 2 White Oak in the upcoming list). Day-of state is *only* for today.

### Label conventions

- Dashboard chip text: `Day of Show` — mixed case, sentence-style
- In-surface top chrome eyebrow: `DAY OF SHOW` — all caps with `0.18em` tracking

### Mic chip component spec

```
size:       padding 6px 12px 6px 8px,   border-radius 999px
default     font  500 12px/1 DM Sans, letter-spacing 0.02em
size=big:   padding 10px 16px 10px 12px, font 13px

bg:         hsl(var(--badge-new) / 0.15)        // tinted blue
border:     1px solid hsl(var(--badge-new) / 0.4)
fg:         hsl(var(--badge-new))               // blue text — #aed4ee in dark

inner mic dot:
  width 18×18 (default) / 22×22 (big), border-radius 999px
  background hsl(var(--badge-new))    // solid blue
  icon: Lucide "mic", size 10/12, stroke 2.2, color #fff

glow animation (CSS keyframe `mic-pulse`, 2.4s ease-in-out infinite):
  0%, 100%: box-shadow 0 0 0 0 hsl(var(--badge-new) / 0.55),
                       0 0 16px 0 hsl(var(--badge-new) / 0.45)
  50%:      box-shadow 0 0 0 6px hsl(var(--badge-new) / 0),
                       0 0 22px 2px hsl(var(--badge-new) / 0.7)
```

The glow runs continuously while the show is "today." If a user finds it too loud, it can be tuned to a slower or one-shot animation — easy follow-up.

### Placements explored & rejected (in `Day of Show — Variants.html`)

- **Pinned to next-show card** (`position: absolute; top: -12px; left: 14px` on today's show card) — reads as a *tab on the card* rather than a status for *today*. Also created an awkward dependency on the card always being the top-most surface. Rejected.
- **Floating action button** (larger chip, bottom-right, `right: 18px; bottom: 96px` above the tab bar) — most visible but felt bolted on; competes with the existing tab bar. Rejected.

---

## The surface — three phases, content morphs in place

Same screen, content swaps as state changes. The phase is computed from `state` — never set directly:

```ts
function computePhase(state: { nowMin: number; settled: boolean; checked?: Record<string, boolean> }): 1 | 2 | 3 {
  if (state.settled) return 3;
  const setEntry = schedule.find(s => s.is_band);
  const setTimeMin = hmToMinutes(setEntry.time);
  if (state.checked?.['load-out']) return 2;
  if (state.nowMin >= setTimeMin + 90) return 2;  // 90 min after band's set start
  return 1;
}
```

Phase swap animation: `key={phase}`, fade + 8px translate, 380ms `cubic-bezier(0.77, 0, 0.175, 1)` (`--ease-in-out`).

### Top chrome (all phases)

```
Height: ~36px
Padding: 4px 18px 0
Layout: flex, space-between, align-items: center

Left:  small mic dot (22×22, --badge-new bg, white mic icon, mic-pulse glow)
       + "DAY OF SHOW" eyebrow (DM Sans 500, 10.5px, 0.18em tracking, --muted-foreground)

Right: X dismiss button
       32×32 round, hsl(var(--secondary)), 1px hsl(var(--border)) border,
       Lucide "x" 14px stroke 2 in --muted-foreground
       onClick: returns to dashboard. Mic chip on dashboard keeps glowing.
```

The dismiss is **temporary** — it does not turn off Day of Show Mode permanently. The next app open past 5am local after the show is settled is what auto-resolves it.

---

## Phase 1 — Pre-show

**Trigger:** show day, before band's set time + 90 min, not settled.

### Layout (top to bottom)

1. **Top chrome** (above)
2. **Hero countdown block** — padding `8px 22px 4px`
3. **Schedule card** — padding `0 22px`, margin-top 24
4. **Action grid** — 2-up DOS contact + Guest list, then full-width Venue navigate

### Hero block — time is the operative info, countdown is supporting context

Tour managers think in clock time, not deltas. The serif typography flex sits on the **time itself**; the countdown is demoted to a small subtitle that answers "do I have time to grab food."

```
Eyebrow:        "Up next" (or "Now" if no future entry)
                500 11px/1.2 DM Sans, 0.18em tracking, uppercase, --muted-foreground
                margin-bottom 10

Entry label:    "Doors" / "Soundcheck" / "Load out" / etc.
                500 28px/1.05 DM Sans, -0.02em tracking, --foreground

TIME (the hero, margin-top 18):
  Display: DM Serif Display, line-height 0.9, letter-spacing -0.05em
  Number:  e.g. "4" or "6:30" — 110px, --foreground
  Period:  "PM" / "AM" — 38px, --muted-foreground, uppercase
  font-variant-numeric: tabular-nums  (no shift as the surface re-renders)
  Layout: flex, align-items: baseline, gap 10

Subtitle (margin-top 8):
  "in 1 hr 10 min · 90 min before doors"
  500 14px/1.2 DM Sans, --muted-foreground
  - Distance comes first ("in <h>h <m>m" or "in <m> min")
  - When remaining <= 0, swap distance to "now"
  - Schedule entry's `note` (if present) appears after " · "
```

Use a small helper that splits a `HH:MM` string into `{ n: "4", u: "PM" }` (or `{ n: "6:30", u: "PM" }` when the entry isn't on the hour). 12pm and 12am normalize correctly. See `fmt12parts` in `dos-mode.jsx`.

### Schedule card

```
Container: hsl(var(--card)), 1px hsl(var(--border)), border-radius 12, padding 4px 12px

Each row (8 rows for the demo show):
  display: grid; grid-template-columns: 62px 1fr auto; gap: 10; align-items: center;
  padding: 9px 0;
  border-bottom: 1px solid hsl(var(--border) / 0.5)  (none on last)

  Time:    JetBrains Mono 12px 500
  Label:   DM Sans 13.5px
           - is_band rows have a Lucide "mic" 11px icon in --badge-new color before label
  "Next" chip on the hero row (tone="new")
  Right cell: on the band row only, a print/share button (Lucide "printer" 13px,
              --muted-foreground, opens 200px-wide menu with Print / Share / Copy)

State:
  - past entries (time <= nowMin) and the hero row excluded:
    opacity 0.42, time gets line-through
  - hero row: time + label go to --foreground, weight 600 (time) / 500 (label)
```

### Action cards

```
Layout:
  Row 1: 2-column grid, gap 10
    Left:  ActionCard icon="phone"        eyebrow="Day-of contact"  title=DOS name
                                          sub="<role> · <phone>"
    Right: ActionCard icon="users"        eyebrow="Guest list"      title=count (mono)
                                          sub="confirmed names"
  Row 2 (margin-top 10): full-width
    ActionCard icon="navigation"          eyebrow="Venue"           title=venue name
                                          sub=address
                                          + arrow-up-right on right edge

ActionCard chrome:
  bg: hsl(var(--card))  (or hsl(var(--muted) / 0.5) for the navigate variant)
  1px hsl(var(--border)), border-radius 12, padding 12px 14px, min-height 100

  Icon tile: 32×32, border-radius 9, hsl(var(--secondary)) bg, --foreground icon

  Eyebrow:  500 9.5px/1, 0.14em tracking, uppercase, --muted-foreground
  Title:    500 13.5px/1.25 (14px on full-width), --foreground
            DOS name uses DM Sans, guest count uses DM Mono
  Sub:      11.5px, --muted-foreground, line-height 1.35
```

Press state: `transform: scale(0.98)` on `:active`, transition 160ms `--ease-out`.

---

## Phase 2 — Settle

**Trigger:** band's set time + 90 min has passed, OR the load-out schedule entry is checked, AND not yet settled.

### Layout

1. Top chrome (small mic + X)
2. Eyebrow `"Show's done."` (margin 24px 22px 18px)
3. **Big Settle CTA** (full-width)
4. **Hotel teaser** (margin-top 22)
5. **Tonight footer** (margin-top auto, pushed to bottom)

### Settle CTA

```
Width: 100%
Background: hsl(var(--success))   // 152 60% 40% — the brand green
Border-radius: 18, padding 34px 22px
Box-shadow: 0 14px 40px hsl(152 60% 30% / 0.45),
            inset 0 1px 0 hsl(0 0% 100% / 0.15)
Text-align: left
Color: #fff

Inner stack (gap 14):
  Eyebrow:    "Wrap it up"  500 11px 0.18em tracking, white/78
  Title:      "Settle this show"  DM Serif Display 44px/1, -0.03em
  Sub:        "Count the door, close the night, save your numbers. Five minutes."
              13.5px, white/85, line-height 1.4
  Action row: "Open settle →"  500 13px white/95
              + Lucide "arrow-right" 14px

onClick: opens existing settle surface (button-out, v1).
```

### Hotel teaser

```
Eyebrow: "Up next"
Card: hsl(var(--card)), 1px --border, radius 12, padding 12px 14px,
      flex row gap 12

Left:    38×38 radius-10 tile, var(--pastel-blue-bg) bg, var(--pastel-blue-fg) fg,
         Lucide "bed" 17px
Middle:  hotel name (500 14px DM Sans), then sub
         "<distance> away · <room block>" (12px, --muted-foreground)
Right:   Lucide "chevron-right" 14px, --muted-foreground

Pulls only from the Show row's hotel fields. No invented data.
```

### Tonight footer

```
Pushed to bottom with margin-top: auto + padding-top: 22

Eyebrow: "Tonight" (10px, 0.18em tracking)
Below: a wrapping list of all schedule entries as completed strings
  Format: <check> 6:30 pm Doors    (gap '4px 14px', font 11.5 mono)
  Each: Lucide "check" 9px in var(--pastel-green-fg) + time + label
  Color: --muted-foreground
```

---

## Phase 3 — Post-settle (Hotel reveal)

**Trigger:** `is_settled === true` on the show.

### Layout

1. Top chrome
2. Eyebrow + 1-line copy
3. *Optional:* stylized map (variant B only)
4. **Hotel hero** (huge)
5. **Navigate button** (full-width, dark)
6. **Booking detail card**
7. **Sign-off** (centered, pushed to bottom)

### Hero copy

```
Eyebrow:  "Settled · Drive safe"  10.5px, 0.18em tracking, --muted-foreground
Sub:      "Tonight's done. Here's where you're sleeping."
          13px, --muted-foreground, line-height 1.45
```

### Hotel hero

```
Eyebrow:  "Hotel"
Name:     DM Serif Display 46px/1.02, -0.03em, --foreground
          margin: 10px 0 14px

Address:  JetBrains Mono 14px, --foreground, line-height 1.5
Distance: "3.2 mi from the venue" — 12.5px, --muted-foreground, margin-top 6
```

### Navigate button

```
margin-top: 22
Background: hsl(var(--foreground))  // inverted — light pill on dark
Color:      hsl(var(--background))
Border: 0, border-radius 14, padding 16px 18px

Layout: flex row, space-between
  Left:  Lucide "navigation" 16px stroke 2 + "Navigate" (500 15px DM Sans)
  Right: Lucide "arrow-up-right" 16px stroke 2

onClick: opens system maps with hotel address.
```

### Booking card

Three rows in a card (`hsl(var(--card))`, 1px border, radius 12, padding `4px 14px`):

```
Row format: grid 120px / 1fr, gap 10, padding 10px 0,
            border-bottom: 1px hsl(var(--border) / 0.5)

  Check-in        18:00          (mono)
  Confirmation    CARP-04251     (mono)
  Room block      4 rooms · "Mohawk band"   (sans)

Use ONLY fields that exist on the Show row. Don't invent.
```

### Sign-off

```
margin-top: auto, padding-top: 30, text-align: center

Line 1: "Good night."  DM Serif Display 22px/1.2, -0.02em, --foreground
Line 2: "This view closes itself in the morning."  12px, --muted-foreground
```

### Hotel variant B — with stylized map

Variant B adds an inline 160px-tall stylized map preview above the hotel hero. The map is **not interactive** — it's a visual anchor showing venue → hotel route. SVG: 40×40 grid pattern, three abstract road curves, venue dot (4r, --muted-foreground), hotel dot (6r --badge-new with 14r ring), dashed route between them. See `dos-mode.jsx` `FakeMap` component.

In production, replace with a real static map (Mapbox/Apple Maps static API).

---

## Interactions wired in the prototype

Per the original spec, these are the only tappable affordances:

| Element | Behavior |
| --- | --- |
| Dashboard mic chip | Enters Day of Show Mode |
| X (top right) | Dismisses back to dashboard. Mic on dashboard keeps glowing. |
| Print/share icon (band schedule row) | Opens 3-item menu (Print, Share to crew, Copy as text) |
| Venue navigate row (Phase 1) | Press state only — no nav wired |
| Hotel navigate button (Phase 3) | Press state only — no nav wired |
| Settle CTA | Triggers a state change to `settled = true` (Phase 3) — in production this routes to the existing settle surface |

Tap-to-call DOS contact, schedule-row tap-to-complete, and other interactions are **not wired** per the user's selection. Press state on `.pressable` (transform scale 0.98, 160ms `--ease-out`) is universal.

---

## State management

The Day of Show surface takes a single `state` prop:

```ts
type DOSState = {
  nowMin: number;            // current clock time as minutes past midnight (local)
  settled: boolean;          // Show.is_settled
  checked?: Record<string, boolean>;  // schedule entry id → checked (load-out is the only one that affects phase)
};
```

Phase is **derived**, never stored. Anything UI-driven (e.g. countdown ticks) should compute `nowMin` from the real wall clock; the prototype lets you scrub it via a slider.

The mic chip on the dashboard pulses whenever today is a show day and the show is not yet auto-resolved (see Exit below).

### Exit / auto-resolve

> Auto-resolves on next app open past 5am local time after the show is settled.
> Persists overnight until then (load-outs run late). User can dismiss any time
> with the X — temporary, not permanent.

Implementation hint: store `dosShownForShowId: string | null` per user. On app open, if `now() > settledAt + (next 5am local)`, clear the flag. The X button is purely client-state — it does not clear the flag.

---

## Animation tokens

All from the existing `src/index.css`:

| Use | Easing | Duration |
| --- | --- | --- |
| Phase morph (in-place swap) | `--ease-in-out` cubic-bezier(0.77, 0, 0.175, 1) | 380ms |
| Page fade-in | `--ease-editorial` cubic-bezier(0.16, 1, 0.3, 1) | 320ms |
| List stagger | `--ease-editorial` | 320ms with 50ms cascade |
| Press | `--ease-out` cubic-bezier(0.23, 1, 0.32, 1) | 160ms |
| Mic glow | ease-in-out | 2.4s loop |

Respect `prefers-reduced-motion: reduce` globally — the existing app already does this in `src/index.css`. Don't re-implement per component.

---

## Design tokens (from `colors_and_type.css` / `src/index.css`)

### Colors used in this design (all dark mode)

| Token | Value | Usage |
| --- | --- | --- |
| `--background` | `30 10% 8%` | App canvas |
| `--foreground` | `40 20% 92%` | Primary text |
| `--card` | `30 10% 10%` | Card surfaces |
| `--muted` | `30 8% 16%` | Muted surfaces (e.g. navigate variant) |
| `--muted-foreground` | `30 8% 55%` | Secondary text, eyebrows, icons |
| `--secondary` | `30 8% 16%` | Icon tiles, dismiss button |
| `--border` | `30 8% 18%` | All borders |
| `--success` | `152 60% 40%` | Settle CTA bg |
| `--badge-new` | `210 80% 52%` | Mic chip glow, "Next" chip |
| `--pastel-blue-bg` | `hsla(205, 50%, 22%, 0.5)` | Hotel teaser tile bg |
| `--pastel-blue-fg` | `#aed4ee` | Hotel teaser tile fg, mic chip text |
| `--pastel-green-fg` | `#b5d1b0` | Tonight footer check icons |

### Typography

- **DM Serif Display** — Hero countdown (90/110px), hotel name (46px), Settle title (44px), sign-off (22px), all dates on cards
- **DM Sans 500** — All UI body, labels, eyebrows, button text. 11–28px
- **JetBrains Mono 500** — Times, addresses-as-data, confirmation codes, guest count. 11.5–14px

Eyebrow style: `500 11px/1 DM Sans, uppercase, letter-spacing 0.18em, --muted-foreground`. Note: the prototype uses `0.18em` (slightly wider than the system's `0.14em`) for the Day-of mic eyebrow specifically — this gives the surface its hushed, late-night feel. Other eyebrows on the surface follow the standard `0.14em`.

### Radii / spacing

- Cards: `border-radius: 12px`
- Settle CTA: `border-radius: 18px` (slightly softer for the hero)
- Navigate button: `border-radius: 14px`
- Chips / dots / mic chip: `border-radius: 999px`
- Standard padding: 14–22px horizontal on the surface, 12–14px on cards
- Section spacing: `margin-top: 22–24px` between major blocks

---

## Data shapes

Lifted from `src/lib/types.ts` — use what's already there.

```ts
type Show = {
  id: string;
  date: string;            // YYYY-MM-DD, local
  venue: string;
  city: string;
  address: string;
  cap?: string;
  guestList?: number;
  tour?: string | null;
  is_settled: boolean;

  // hotel — only fields that actually exist
  hotel?: {
    name: string;
    address: string;
    distance?: string;
    checkIn?: string;       // HH:MM 24h
    confirmation?: string;
    roomBlock?: string;
  };

  schedule: ScheduleEntry[];
  contacts: ShowContact[];
};

type ScheduleEntry = {
  id: string;
  time: string;             // HH:MM 24h
  label: string;
  kind?: 'load_in' | 'soundcheck' | 'meal' | 'doors' | 'opener' | 'set' | 'curfew' | 'load_out' | string;
  is_band?: boolean;
  note?: string;
};

type ShowContact = {
  name: string;
  role?: string;
  phone?: string;
  email?: string;
};
```

The Day-of-Show contact is the contact in `show.contacts` flagged as `is_dos: true` (or however the existing app marks it — match `ShowDetailPage.tsx`). The band's set is the `ScheduleEntry` with `is_band === true`.

For schedule label detection (which row is doors/load-in/load-out), reuse `src/lib/scheduleMatch.ts` — don't reimplement.

---

## Assets

- `assets/logo.svg` — already in repo, no change
- Lucide icons used: `mic`, `x`, `printer`, `share-2`, `copy`, `phone`, `users`, `navigation`, `arrow-up-right`, `arrow-right`, `chevron-right`, `bed`, `check`, `map-pin`, `signal`, `wifi`, `calendar`, `file-text`, `settings`, `bell`, `search`, `sparkles`. All standard 1.5px stroke (1.75 for default in this surface to read warmer).

No custom illustrations, no photos, no gradients besides the mic-chip glow halo and the Settle CTA inset highlight. The map preview is a stylized SVG placeholder — production should use a real static map.

---

## Recommended component structure (in `show-advance-pro`)

```
src/
  components/
    DayOfShow/
      DayOfShowMode.tsx           // top-level surface, takes Show + onClose
      PhasePreShow.tsx
      PhaseSettle.tsx
      PhasePostSettle.tsx
      MicChip.tsx                 // dashboard entry chip
      Countdown.tsx               // memoized, ticks once a minute
      ScheduleList.tsx            // reused inside PhasePreShow
      ActionCard.tsx              // 2-up + full-width variants
      HotelCard.tsx               // teaser (P2) + hero (P3)
  hooks/
    useDayOfShowPhase.ts          // wraps computePhase against live show + clock
    useNowMinutes.ts              // tickless wall-clock subscriber
  pages/
    ShowDetailPage.tsx            // gains the mic chip; entry replaces "Today" badge
    DashboardPage.tsx             // gains the mic chip on the next-show card
```

### Implementation notes

- The countdown should re-render at most once per minute; use `useNowMinutes()` that ticks on the minute boundary.
- Phase state is derived from `(show, now)` — never store it. A `useDayOfShowPhase(show, now)` hook returning `1 | 2 | 3` keeps logic in one place.
- Phase swap: keyed `<motion.div key={phase}>` wrapper using Framer Motion (already in repo, see existing usage in `ShowDetailPage`). Otherwise CSS `key`-based remount fade works fine.
- Mic chip pulse: pure CSS keyframe — no JS ticker.
- Respect `prefers-reduced-motion`. The app already has the listener; just gate the pulse + phase morph behind it.

---

## Open questions for the dev

1. **Where does the mic chip flag live on the Show?** Per the visibility rules above, derived as `show.date === today && !is_settled`. After settle, the chip is hidden immediately — the auto-resolve at 5am next day is for the *Day of Show surface itself* (so the X-dismissed flag clears), not the chip. Confirm against the existing app's "today" detection logic.
2. **Settle handoff.** The Settle CTA needs to route to whatever the existing settle flow is — confirm that path with whoever owns settling.
3. **Does the existing app surface a phone tap-to-call helper?** If yes, wire the DOS contact ActionCard to it. If no, this is a v1 follow-up.
4. **Static map provider** for hotel variant B — Mapbox? Apple? Confirm before implementing.

---

## How to view the prototypes

Open `Day of Show Mode.html` in a browser. Tap the glowing mic chip on the dashboard to enter. Use the **scrubber above the phone** to jump between phases (Auto / Pre-show / Settle / Post-settle), or open the **Tweaks panel** (bottom-right) for fine control — clock slider, load-out toggle, settled toggle, mic placement, hotel variant.

Open `Day of Show — Variants.html` for the side-by-side canvas with all four end-states + variant explorations.
