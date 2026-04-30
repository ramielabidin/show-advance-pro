# Day of Show — Phase 1, 2, 3 refinements

**Date**: 2026-04-29
**Branch**: `claude/day-of-show-phase-refinements`
**Prototype**: `prototypes/day-of-show-phase3/index.html` (gitignored)

## Problem

Day of Show Mode has three time-driven phases (`PhasePreShow`, `PhaseSettle`, `PhasePostSettle`). After shipping the initial design, three issues emerged:

1. **Phase 2** felt crowded — competing serif headlines (venue + "Close the night."), an unnecessary subhead, and a hotel teaser that duplicated information already on Phase 3.
2. **Phase 3** had a fussy done-mark (line check + serif punctuation dot inside a thin circle), and the press-and-hold gesture was redundant friction — the user already committed via the slide-to-settle in Phase 2. Re-opening the overlay after completion ran the celebration again because nothing was persisted.
3. **Phase 1** had no visual through-line with Phase 2/3, and a long schedule (festival lineups, multi-opener nights) would either push critical UI off the device frame or clip silently.

## Goals

- Strip Phase 2 to a single committing gesture; remove competing visual elements.
- Replace the Phase 3 mark with a quieter, Notion-inspired single-stroke check.
- Make the Phase 3 celebration a one-shot, auto-played moment — no gesture required.
- Persist the closed state so re-opens land on a hotel-only view.
- Add a unified serif "footer anchor" that ties Phase 1, 2, 3 together visually.
- Make Phase 1 robust to arbitrarily long schedules.
- Add `hotel_phone` so the hotel-reveal view can offer a tap-to-call action when available.

## Non-goals

- Phase boundaries / `useDayOfShowPhase` logic stays unchanged (still 1 | 2 | 3).
- No changes to the slide-to-settle gesture itself or `SettleShowDialog`.
- No changes to the dashboard floating mic button (it already powers down on `is_settled`; that behavior stays).
- No tier gating, RBAC changes, or migration of existing post-show flows.

## Architecture

### State model — new column

```sql
alter table public.shows
  add column dos_closed_at timestamptz null,
  add column hotel_phone   text        null;
```

- **`dos_closed_at`**: set the moment Phase 3a auto-plays its celebration (i.e. on first mount). Never cleared. Drives the Phase 3a → 3b substate. Setting on mount (rather than at end of animation) means the celebration is "consumed" immediately and a network blip during the 3.6-second sequence can't re-trigger it on next open.
- **`hotel_phone`**: editable on `ShowDetailPage` in the existing hotel section, normalized through `normalizePhone`. Drives the Call front desk chip on Phase 3b.

`useDayOfShowPhase` stays `1 | 2 | 3`. The 3a/3b split lives entirely inside `PhasePostSettle.tsx`, branching on `show.dos_closed_at`.

### Component shape

```
DayOfShowMode (overlay, pinned chrome + chevron, swipe-to-dismiss)
├── PhasePreShow (Phase 1)
│   ├── Hero (pinned top): "UP NEXT" eyebrow, label, big serif time, relative
│   ├── ScheduleScroll (middle, scrolls)
│   │   ├── ScrollFade.top
│   │   ├── ScheduleList
│   │   └── ScrollFade.bottom
│   ├── DOSContact (pinned, always reachable)  ← simplified
│   └── PlaceFooter (pinned, venue name + city, tappable for Maps)
│
├── PhaseSettle (Phase 2)
│   ├── SlideToSettle (centered vertically — only thing on screen)
│   └── PlaceFooter (pinned, venue name + city, tappable for Maps)
│
└── PhasePostSettle (Phase 3) — branches on dos_closed_at
    ├── (null) Phase 3a: Celebration
    │   ├── auto-played sequence:
    │   │   ├── 0–880ms       check draws (single calm stroke)
    │   │   ├── 880–1380ms    holds 500ms
    │   │   ├── 1380–1740ms   check fades out
    │   │   ├── 1740–2060ms   "Good job." rises in
    │   │   ├── 2060–3160ms   "Good job." linger 1.1s
    │   │   ├── 3160–3620ms   "Good job." fades out
    │   │   └── 3620ms        onShowDone() → overlay dismisses
    │   ├── tap-anywhere skips to dismiss
    │   ├── reduced-motion: instant render, 1s hold, dismiss
    │   ├── persists dos_closed_at on mount
    │   └── LineFooter ("Sleep well.")
    │
    └── (set) Phase 3b: Hotel reveal
        ├── HotelHero card (centered vertically)
        │   ├── bed badge + serif name + mono "City, ST"
        │   └── conditional chips:
        │       ├── address present → Open in Maps
        │       └── hotel_phone present → Call front desk
        └── LineFooter ("Sleep well.")
```

### Shared primitives

#### `PlaceFooter` (Phase 1, 2)

Anchored to the bottom of the phase body. Whole element is an `<a>` to Google Maps (built from full venue address — display is short, link is precise).

```
<a class="phase-footer phase-footer-place" href={mapsHref}>
  <div class="pf-name">{venue_name}</div>
  <div class="pf-addr">{city}, {state}</div>
</a>
```

- `pf-name`: DM Serif Display, 22px, foreground.
- `pf-addr`: JetBrains Mono, 11.5px, muted.
- gentle-breathe animation (`@keyframes gentleBreathe { 0%,100% { opacity: 0.85 } 50% { opacity: 1 } }`).
- City/state derives from the existing `formatCityState()` helper in `src/lib/utils.ts`.
- Maps href reuses the same pattern as the existing hotel teaser code: `https://www.google.com/maps/search/?api=1&query=…`.

#### `LineFooter` (Phase 3a, 3b)

Single line of display serif. Same pinned-bottom + gentle-breathe rhythm.

```
<div class="phase-footer">Sleep well.</div>
```

- Sleep-well sign-off pool (existing `SIGN_OFFS` array in `PhasePostSettle.tsx`) is preserved — the deterministic per-show pick still applies.

The asymmetry between two-line and one-line footers is intentional: place footers (1, 2) tell you *where* you are operationally; line footers (3) mark the moment as resolved.

### Phase 1 scrollable layout

The schedule is the only variable-length element on Phase 1. Pinning everything else means the schedule can grow without breaking the layout.

```css
.phase-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;        /* CRITICAL — without this the scroll child
                            won't shrink below content size, and the
                            schedule overflows the device frame */
  gap: 16px;
}
.p1-scroll-wrap {
  flex: 1;
  min-height: 0;
  position: relative;
  display: flex;
}
.p1-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;        /* hidden — but real native scroll, not custom */
  -webkit-overflow-scrolling: touch;
}
```

- Top + bottom fade overlays sit in absolutely-positioned siblings of `.p1-scroll`, **not** as `mask-image` on the scroll container itself. `mask-image` on a scroll container breaks pointer/touch events in Chromium and Safari.
- Hero, DOS contact, and place footer are siblings of the scroll wrap and stay pinned.

### Phase 3a celebration

A *passive* sequence — no gesture, no buttons. The slider was the commitment in Phase 2; Phase 3a is the bow.

#### Animation timing (refs lifted from prototype, in ms)

| Time   | Event                                                    |
| ------ | -------------------------------------------------------- |
| 0      | Phase 3a mounts. `dos_closed_at` mutation fires.         |
| 120    | Check stroke begins drawing (CSS animation-delay)        |
| 880    | Check fully drawn (760ms ease-out-expo)                  |
| 880    | Hold beat begins                                         |
| 1380   | Check begins fading out (360ms ease-out)                 |
| 1740   | Check fully gone                                         |
| 1740   | "Good job." begins rising in (320ms fade-up)             |
| 2060   | "Good job." at full opacity, linger begins               |
| 3160   | "Good job." begins fading out (460ms ease-out)           |
| 3620   | `onShowDone()` fires → overlay dismisses                 |

Constants live in one place in the component so they match the spec exactly.

#### Skip + reduced-motion

- Tap-anywhere on the Phase 3a body cancels the sequence and triggers the fade + dismiss path immediately (~460ms to dismissal).
- `prefers-reduced-motion`: skip the draw + hold; render the check static for 800ms with no animation, then run a 200ms cross-fade to "Good job.", linger 600ms, dismiss. Total ~1.6s.

#### Persistence

The mutation that sets `dos_closed_at` runs on Phase 3a's first mount (inside a `useEffect` with empty deps). Optimistic update: write the timestamp into the React Query cache locally, then await the network round-trip. If the mutation fails, log it but do **not** roll back the UI — re-running the celebration on a subsequent open would be a worse outcome than missing the persistence on a flaky network.

### Phase 3b hotel reveal

Centered card with two action chips, conditional on data presence:

| `hotel_address` | `hotel_phone` | Chips rendered                |
| --------------- | ------------- | ----------------------------- |
| set             | set           | Open in Maps + Call front desk |
| set             | null          | Open in Maps only              |
| null            | set           | Call front desk only           |
| null            | null          | (no chips — fall back to single-card with name only) |

Tap targets: chips use the same touch sizing as the rest of the app (44×44 minimum implicit via padding + gap).

### Phase 2

Strip everything but the slider. The slider is the only thing on screen, vertically centered. No top eyebrow, no headline, no subhead, no hotel teaser. The place footer carries the venue identity.

The hotel teaser was redundant once Phase 3b exists as the dedicated hotel surface — surfacing it on Phase 2 was duplicating future state into present state.

### `hotel_phone` editing surface

Surfaced on `ShowDetailPage` in the existing hotel section as an inline-editable field. Uses the `editField()` helper already in place. Normalized through `normalizePhone()` from `src/lib/utils.ts` on save.

The field renders alongside `hotel_name`, `hotel_address`, `hotel_confirmation`, `hotel_checkin_date`, `hotel_checkout_date` — adjacent in the form, no UX redesign of the hotel section needed.

## Files affected

### New / modified
- **`supabase/migrations/<ts>_dos_closed_at.sql`** (new) — single migration adding both columns. Single migration since they ship together.
- **`src/integrations/supabase/types.ts`** — regenerate after migration.
- **`src/lib/types.ts`** — add `dos_closed_at: string | null` and `hotel_phone: string | null` to `Show`.
- **`src/components/DayOfShow/PhasePreShow.tsx`** — restructure for pinned hero / scroll / pinned contact + footer; simplify DOS contact card; add place footer.
- **`src/components/DayOfShow/PhaseSettle.tsx`** — strip headline/subhead/hotel-teaser; center slider; add place footer.
- **`src/components/DayOfShow/PhasePostSettle.tsx`** — replace `DoneMark` with new auto-played celebration; branch on `dos_closed_at`; render 3a or 3b; persist on mount.
- **`src/components/DayOfShow/PlaceFooter.tsx`** (new) — shared primitive, tappable Maps link.
- **`src/components/DayOfShow/HotelReveal.tsx`** (new) — Phase 3b card with conditional chips.
- **`src/index.css`** — keyframes + classes for new check stroke, "Good job." rise, place / line footer, scroll fade overlays. Remove the existing `.done-mark` / `.done-circle` / `.done-check` rules and `done-check-completed` if no longer used.
- **`src/pages/ShowDetailPage.tsx`** — add `hotel_phone` field to the hotel section using existing `editField()` helper.
- **`src/components/DayOfShow/DayOfShowMode.tsx`** — fetch `dos_closed_at` and `hotel_phone` (the existing `select("*, …")` already pulls them once they're on `Show`).

### Untouched (verify)
- `useDayOfShowPhase.ts` — stays `1 | 2 | 3`.
- `DayOfShowFloatingButton.tsx` — already powers down on `is_settled`. No change needed.
- `SettleShowDialog.tsx` — slide-to-settle UX unchanged.

## Risks & mitigations

| Risk | Mitigation |
| ---- | ---------- |
| Setting `dos_closed_at` on mount could persist on a brief mis-mount during phase transitions. | The phase transitions are hard-keyed (re-mount on phase change), so 3a only mounts when the user is genuinely on it. Belt-and-suspenders: gate the mutation behind `is_settled = true && dos_closed_at IS NULL`. |
| The auto-play timing might feel either too long or too short on first ship. | Constants in one place; ship the spec'd timings; tune via a single PR if needed. |
| Phase 3b with no `hotel_address` AND no `hotel_phone` produces an empty card. | Fall back to a name-only card (no chips). If `hotel_name` is also missing, render the line footer "Sleep well." in the center of the body — same as 3a's dismissed state but persistent. Cleanest degenerate case. |
| Long schedule scroll on iOS Safari. | Native scroll only (no JS scroll). `-webkit-overflow-scrolling: touch` for inertia. Fades are CSS-only siblings — don't break events. |
| Existing `done-mark` CSS classes are referenced elsewhere. | Grep before deletion. Likely scoped to `PhasePostSettle.tsx` since they're prefixed `done-*`. |

## Testing plan

- Unit-ish: `useDayOfShowPhase` unchanged; existing tests (if any) still pass.
- Visual: prototype already validates the four phase states. Manual QA on real device for:
  - Phase 1 short schedule (5 cues) — looks normal, no scrollbar visible, no fades visible.
  - Phase 1 long schedule (12+ cues) — scrolls inside the device frame, hero/contact/footer pinned.
  - Phase 2 — single slider, vertically centered.
  - Phase 3a — celebration auto-plays, dismisses, sets `dos_closed_at`.
  - Reopen after Phase 3a finished → lands directly on Phase 3b, never re-runs celebration.
  - Phase 3b chips — toggle `hotel_phone` on `ShowDetailPage`, verify chip appears/disappears.
- Reduced-motion: macOS System Settings → Accessibility → Display → Reduce Motion. Phase 3a should still complete and persist.
- Tap-skip on Phase 3a — confirmed skips to dismiss without running full sequence; `dos_closed_at` still gets persisted (since the mutation fires on mount, not on completion).

## Out of scope

- Per-show "Sleep well." copy variations beyond the existing `SIGN_OFFS` pool.
- Animation customization in user settings.
- Mobile haptics on Phase 3a completion (could be added later via `navigator.vibrate`, not in this scope).
- Phase 3b extra actions (driving directions, room number, check-in QR, etc.).
