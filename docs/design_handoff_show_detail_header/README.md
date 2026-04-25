# Handoff: Show Detail Page — Header Redesign

## Overview

This package replaces the current `ShowDetailPage` header in the Advance PWA. The original header crowded nine elements into the top of the mobile screen — back arrow, tour pill, date, venue, status chip, address, drive callout, three action buttons, and tabs — which made the venue title compete with secondary metadata and gave the page no clear primary action.

The redesign keeps every piece of information but rebalances the hierarchy:

- **Eyebrow** combines tour + date in a single ALL CAPS line
- **Title** (venue) gets unobstructed weight at `DM Serif Display` ~28–36px
- **Meta** (city, address, drive time) drops to a quiet line / muted strip
- **Primary action** is a single full-width Settle button on mobile (with `⋯` overflow); desktop restores the full Settle / Import / Share row
- **Advanced status** is silent on the happy path — *no chip*. When a show is **not** advanced, a soft amber banner appears above the header with a "Mark advanced" affordance.

## About the design files

The files in this bundle are **design references created in HTML** — interactive prototypes showing the intended look and behavior, not production code to copy directly. The task is to **recreate these designs in the Advance codebase's existing React + TypeScript + Tailwind + shadcn environment**, using the established patterns under `src/components/`. The `ShowDetailPage.tsx` page and the `Button`, `Card`, `Chip`, and `FieldGroup` primitives already exist; this work updates the header region of `ShowDetailPage` only.

## Fidelity

**High-fidelity.** Spacing, type sizes, colors, and motion are taken directly from `src/index.css` and `tailwind.config.ts`. Reproduce pixel-exactly using the existing tokens — do not introduce new colors or fonts.

## Files in this bundle

| File | Purpose |
| --- | --- |
| `mobile.html` | V13 — mobile header, both states (advanced + not advanced) side by side |
| `desktop.html` | V9 — desktop header, full button row, drive time inline in meta |
| `advance-tokens.css` | All design tokens — colors, type, motion, radii (verbatim from `src/index.css`) |
| `ios-frame.jsx` | iOS device frame used to wrap the mobile prototype |
| `README.md` | This file |

Open `mobile.html` and `desktop.html` in a browser to see the live designs.

---

## Screens / States

### 1. Mobile · Show advanced (happy path)

**Layout** — single column, 16px horizontal padding.

| Region | Content | Spec |
| --- | --- | --- |
| App bar | `←` icon · "Advance" wordmark (left) · `⋯` (right) | 12px / 18px padding · 1px bottom border `hsl(var(--border))` |
| Header block | Eyebrow → Title → City → Drive strip → Action row | 18px top padding · 14px bottom padding |
| Eyebrow | `JUICE SPRING TOUR 2026 · APR 25 SAT` | `DM Sans` 500 / 10.5px · uppercase · letter-spacing 0.14em · color `hsl(var(--muted-foreground))` · 8px margin-bottom |
| Title | `Portland House of Music` | `DM Serif Display` 400 / 28px / 1.05 line-height · letter-spacing -0.02em |
| City | `Portland, ME` | `DM Sans` 13px · color `hsl(var(--muted-foreground))` · 6px margin-top |
| Drive strip | 🚗 `3 hr 53 min` from Burlington · `257 mi` (right-aligned) | bg `hsl(var(--muted) / 0.55)` · radius 8px · padding 8/10px · 12.5px text · mono numerals · 12px margin-top |
| Action row | `[Settle show]` (flex 1, h40) + `⋯` (40×40 outline) | 14px margin-top · 8px gap |
| Settle button | green | bg `hsl(var(--success))` (`152 60% 40%`) · color #fff · radius 8px · 14px medium · `<CheckCircle2 size=15>` icon |
| Overflow button | dots | bg `hsl(var(--background))` · 1px border `hsl(var(--input))` · color `hsl(var(--muted-foreground))` |

**No "Advanced" chip is rendered when `show.advanced === true`.**

### 2. Mobile · Show not advanced

Identical to (1) except an **amber banner** sits between the app bar and the header block:

| Spec | Value |
| --- | --- |
| Background | `var(--pastel-yellow-bg)` (`#fbf3db` light, dark variant in tokens) |
| Foreground | `var(--pastel-yellow-fg)` (`#956400` light) |
| Padding | 9px / 16px |
| Bottom border | 1px `hsl(var(--border))` |
| Content | 6px dot · "Show hasn't been advanced yet" · `Mark advanced` underlined link (right) |
| Type | 12.5px / 500 |

The Settle button still renders (a TM may want to settle without ever marking advanced — keep both actions available). Optionally swap the primary button to "Mark as advanced" if product wants to force ordering.

### 3. Desktop · Show advanced

**Layout** — `max-width: 880px` centered, 32px horizontal padding, 28px top.

| Region | Spec |
| --- | --- |
| Top nav | 14px / 32px padding · `hsl(var(--background) / 0.8)` + `backdrop-blur(6px)` · "Advance" 20px serif + Home / **Shows** / Settings nav links + Sign out (right) |
| Back link | `← All shows` · 13px muted · 18px margin-bottom |
| Header row | flexbox · `align-items: flex-end` · `gap: 24px` · wraps |
| Left column | Eyebrow → H1 (36px serif) + inline `Advanced` chip → meta row |
| Meta row | `📍 25 Temple St, Portland, ME 04101` · 3px dot separator · `🚗 3 hr 53 min from Burlington · 257 mi` · all 13px muted · 10px margin-top |
| Right column | `[Settle show]` `[Import]` `[Share]` — three full buttons, h38, 8px gap |
| Tabs | `Show info` (active) / `Deal info` / `Contacts` / `Set list` · 13.5px · 1px bottom border · 28px margin-top · 12px padding-bottom · active tab = `hsl(var(--foreground))` + 2px underline |

**Note:** desktop *does* keep an `Advanced` chip inline with the H1 because there's room for it without crowding. If you'd rather make desktop fully consistent with mobile (no chip on happy path), drop it — both readings are defensible.

### 4. Desktop · Show not advanced

Same banner pattern as mobile, full-width across the page background (above the back link, or above the entire `max-w-880` content well — pick what fits the existing page chrome).

---

## Interactions & Behavior

| Action | Behavior |
| --- | --- |
| Tap `Settle show` | Opens existing settle modal (no design change) |
| Tap `Mark as advanced` (or banner CTA) | `useUpdateShow.mutate({ advanced: true })` — toast `"Marked as advanced"`. Banner unmounts, no other UI change. |
| Tap `⋯` (mobile) | Opens `DropdownMenu` containing: Import · Share · Export PDF · Delete (destructive) |
| Tap drive strip | (Optional) deep-link to `maps://` with `daddr=<venue>&saddr=<previous show>` |
| Scroll | When the header has scrolled past, a sticky 48px collapsed bar takes its place: `← <venue>` + `[Settle]`. (Add only if it tests well — the simpler approach is no sticky, just rely on page nav.) |

## Motion

All easings/durations are in `advance-tokens.css`.

- Banner mount/unmount: 220ms `var(--ease-editorial)` · fade + 4px slide
- Button press: `transform: scale(0.97)` · 160ms `var(--ease-out)` (already baked into existing `Button`)
- No animation on routine state toggles — silent per the design system

## Design tokens used

Pulled directly from `src/index.css` — do not inline raw hex.

```css
--background:        40 30% 97%;     /* warm off-white */
--foreground:        30 10% 12%;
--muted:             35 15% 94%;
--muted-foreground:  30 8% 50%;
--border:            35 18% 90%;
--input:             35 18% 90%;
--success:           152 60% 40%;
--pastel-yellow-bg:  #fbf3db;
--pastel-yellow-fg:  #956400;
--pastel-green-bg:   #edf3ec;
--pastel-green-fg:   #346538;

--font-display:      "DM Serif Display", Georgia, serif;
--font-sans:         "DM Sans", system-ui, sans-serif;
--font-mono:         "JetBrains Mono", ui-monospace, monospace;

--radius:            0.5rem;
```

## Suggested implementation outline

In `src/pages/ShowDetailPage.tsx`, replace the existing header JSX with:

```tsx
<>
  {!show.advanced && (
    <div className="flex items-center gap-2.5 px-4 py-2.5 bg-[var(--pastel-yellow-bg)] text-[var(--pastel-yellow-fg)] text-xs font-medium border-b">
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      <span>Show hasn't been advanced yet</span>
      <button onClick={markAdvanced} className="ml-auto underline">
        Mark advanced
      </button>
    </div>
  )}

  <header className="px-4 pt-4 pb-3.5 sm:px-8 sm:pt-7">
    <p className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground mb-2">
      {show.tour} · {format(show.date, 'MMM d EEE')}
    </p>
    <h1 className="font-display text-[28px] sm:text-4xl leading-tight tracking-tight">
      {show.venue}
      {show.advanced && <AdvancedChip className="hidden sm:inline-flex ml-3" />}
    </h1>

    <div className="hidden sm:flex items-center gap-4 mt-2.5 text-sm text-muted-foreground">
      <MetaRow icon={MapPin} text={show.address} />
      <span className="w-[3px] h-[3px] rounded-full bg-muted-foreground/50" />
      <DriveMeta show={show} />
    </div>

    <p className="sm:hidden text-sm text-muted-foreground mt-1.5">{show.city}</p>
    <DriveStrip show={show} className="sm:hidden mt-3" />

    <ActionRow show={show} className="mt-3.5 sm:mt-0 sm:absolute sm:right-8 sm:top-7" />
  </header>
</>
```

Component breakdown:
- `<DriveStrip>` — mobile-only muted bar; mono numerals
- `<DriveMeta>` — desktop inline version
- `<ActionRow>` — renders `[Settle]` + `⋯` on mobile, `[Settle][Import][Share]` on desktop (use `useMediaQuery('(min-width: 640px)')` or a Tailwind `sm:` flex pattern)
- `<AdvancedChip>` — existing pastel green chip; only rendered on desktop happy path

Banner copy is finalized; everything else uses existing toast / button / dropdown patterns.

## Assets

No new assets. Icons are existing `lucide-react` imports: `ArrowLeft`, `MoreHorizontal`, `MapPin`, `Car`, `CheckCircle2`, `Check`, `FileText`, `Share2`, `ChevronRight`.

## Open questions for the developer

1. Sticky collapsed scroll bar — ship it, or skip for v1?
2. Does the existing `ShowDetailPage` already wrap meta in a component, or is it inline JSX? If wrapped, update the wrapper; if inline, the snippet above is a drop-in.
3. Banner above app bar or below it? The mock places it below; check what reads better against your real `AppLayout`.
