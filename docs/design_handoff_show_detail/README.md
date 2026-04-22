# Handoff: Show Detail Page — Inline Edit & Time Picker Refresh

## Overview

This handoff covers a redesign of the Show Detail page in the Advance app. The goals:

1. **Unify the edit experience.** Replace the mix of "click the row → dedicated edit mode" and "scattered shadcn `Input` controls" with a single inline-edit pattern that works on every field.
2. **Fix the time / AM-PM picker.** The existing `TimeInput` component (two adjacent shadcn buttons for AM/PM) feels visually heavy and doesn't match Advance's editorial brand. Replace with a lighter picker that uses the display typeface for the time value and a vertical AM/PM rail.
3. **Polish the read-mode page** while we're in there: a compact drive-time line under the header, a proper Day-of contact card, and a subtle `SET` marker on the artist-set row of the schedule so the most important line in the day stands out.

The edit-state changes touch every editable field on the page. The read-mode changes are smaller, additive, and optional — they can ship independently.

## About the Design Files

The files in this bundle are **design references created in HTML** — React prototypes rendered via Babel in-browser, not production code to copy directly. The patterns, measurements, typography, and colors are all intended for you to **recreate in the existing `show-advance-pro` codebase** (React + TypeScript + shadcn/ui + Tailwind), using its established components (`FieldRow`, `FieldGroup`, `TimeInput`, `ScheduleEditor`, etc.) and the `colors_and_type.css` design tokens it already has.

**Do not copy the HTML or inline styles.** Use them to understand the intended behavior and visual result, then implement with the existing shadcn primitives and Tailwind classes.

## Fidelity

**High-fidelity.** Typography, spacing, colors, and interaction details are final. The prototype pulls its tokens from `colors_and_type.css` — the same file already in the repo (`src/index.css` and the shadcn theme variables). Colors and fonts should match pixel-for-pixel.

## Files in this Bundle

- `Show Detail - Recommended.html` — the recommended final design showing every change applied together
- `Edit State Explorations.html` *(optional reference)* — a design-canvas document with all five time-picker variants, the three inline-edit treatments, and the schedule-row variants, each shown in-context. Useful if the team wants to reconsider any of the directional choices.
- `components/Base.jsx` — shared primitives (`Icon`, `Eyebrow`, `SectionLabel`, `Chip`, `Card`, `Button`) — reference only, matching shadcn equivalents in the repo
- `components/TimePickers.jsx` — **the key file.** Contains `TimePickerEditorial`, the picker to implement
- `components/InlineEdits.jsx` — reference implementations of the inline-edit field variants
- `components/Fixtures.jsx` — sample show data, only for populating the demo
- `assets/advance-tokens.css` — copy of the repo's `colors_and_type.css` (here just so the prototype renders)

## Component Changes

### 1. `TimeInput` — replace with editorial picker

**File:** `src/components/TimeInput.tsx`

**Current behavior.** Two shadcn `Button`s side-by-side (HH:MM text input + AM/PM toggle pair). Visually heavy.

**New behavior.** A compact inline cluster:
- **Time value** rendered in the display typeface (`DM Serif Display`, 400), ~28px, clickable — on click, flips to a text input with the same type treatment
- **AM / PM** as a vertical rail to the right of the time, each ~11px uppercase tracked letters, one active (full-opacity foreground) and one inactive (40% foreground); clicking flips
- The whole cluster sits on a single baseline; no borders, no backgrounds, no card — just the glyphs

**Layout (measure from prototype):**
- Container: `display: inline-flex; align-items: center; gap: 14px;`
- Time text: `font-family: var(--font-display); font-size: 28px; line-height: 1; font-weight: 400; letter-spacing: -0.015em; color: hsl(var(--foreground));`
- Edit-mode input: same type treatment, transparent background, 1px dashed bottom border at `hsl(var(--foreground)/0.3)`, no other chrome
- AM/PM rail: `display: inline-flex; flex-direction: column; gap: 4px;`
- AM/PM labels: `font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; font-weight: 500; cursor: pointer; color: hsl(var(--muted-foreground)) | hsl(var(--foreground)); transition: color 120ms var(--ease-out);`

**API — keep the current signature so existing callers don't change:**
```ts
type TimeInputProps = {
  value: string;          // "3:00 PM" or "" 
  onChange: (v: string) => void;
  autoFocus?: boolean;
  hideTbd?: boolean;
};
```
Parsing: accept `H:MM` / `HH:MM` with or without AM/PM; on save, normalize via the existing `normalizeTime` helper in `src/lib/timeFormat.ts`. No change to the callers in `ShowDetailPage.tsx` or `ScheduleEditor.tsx`.

**Reference implementation:** see `TimePickerEditorial` in `components/TimePickers.jsx`.

---

### 2. Inline edit — "invisible chrome" pattern for all text/number fields

**Affected:** every `editField()` call in `src/pages/ShowDetailPage.tsx` that currently renders a shadcn `Input` or `Textarea` when `inlineField === key`.

**Current behavior.** Click a `FieldRow` → it swaps to a shadcn `Input` with full border, ring, and a trailing ✓ button (`InlineSaveIcon`). Visually heavy, makes the page feel like a form when you're editing.

**New behavior.**
- Value text in read mode is unchanged — it's still a clickable `FieldRow` with the existing mono/normal type treatment
- On click, it swaps to an `<input>` (or `<textarea>`) with **no border, no background, no ring** — only a 1px dashed bottom border at `hsl(var(--foreground)/0.4)` that runs the full width of the value cell
- **No trailing save button.** Replace with keyboard affordance text on the right: `⏎ save   esc` — 10px mono, `hsl(var(--muted-foreground)/0.7)`, with each key rendered in a tiny `<kbd>` (1px border `hsl(var(--border))`, 4px radius, 10px mono, 1px/5px padding, muted background)
- **Save behavior.** `Enter` (or `Cmd+Enter` for multiline) or blur saves; `Escape` cancels. On hover in read mode, a 1px dashed bottom border fades in at `hsl(var(--foreground)/0.15)` to hint clickability.
- Multiline fields use `<textarea>` with the same treatment, `min-height: 72px`, `resize: vertical`.

**Styling — edit mode input:**
```css
flex: 1;
min-width: 120px;
background: transparent;
border: none;
border-bottom: 1px dashed hsl(var(--foreground) / 0.4);
outline: none;
padding: 3px 0;
font-family: var(--font-sans);   /* or var(--font-mono) if mono row */
font-size: 13px;
color: hsl(var(--foreground));
line-height: 1.55;
```

**Styling — read-mode value (hover hint):**
```css
border-bottom: 1px dashed transparent;
transition: border-color 120ms var(--ease-out);
/* on row hover: */
border-bottom-color: hsl(var(--foreground) / 0.15);
```

**Reference implementation:** `EditableText` and `Row` in the root `<script type="text/babel">` of `Show Detail - Recommended.html` (and mirrored in `components/InlineEdits.jsx`).

**Scope.** Apply to every call site in `ShowDetailPage.tsx` that currently renders the heavy inline input: `venue_name`, `date`, `dos_contact_name`, `dos_contact_phone`, `departure_notes`, `load_in_details`, `parking_notes`, `green_room_info`, `wifi_network`, `wifi_password`, `hospitality`, `hotel_name`, `hotel_address`, `hotel_confirmation`, and all textareas. The `InlineSaveIcon` component can be deleted.

---

### 3. `ScheduleEditor` — per-row inline edit, editorial time, `SET` marker

**File:** `src/components/ScheduleEditor.tsx`

**Current behavior.** One global "Edit Schedule" button that swaps the whole block into an edit form.

**New behavior.**
- **Rows are individually clickable.** Clicking a row enters edit mode for just that row (the rest stay in read mode).
- **In read mode:** each row is `display: grid; grid-template-columns: 92px 1fr auto; gap: 14px; align-items: center; padding: 10px 0;` — time in the left column (mono, 13px, 500 weight), label in the middle (14px), right column reserved for the `SET` marker on artist rows.
- **Artist-set row gets three visual accents:**
  1. Time color changes to `var(--pastel-green-fg)` from `colors_and_type.css`
  2. A 11px `mic` Lucide icon precedes the label, also in `var(--pastel-green-fg)`
  3. Right column shows `SET` — 10px mono, `hsl(var(--muted-foreground)/0.7)`, `letter-spacing: 0.1em`
  4. Label weight bumps to 500
- **Row hover state:** `background: hsl(var(--muted)/0.3)` with a 120ms fade, `border-radius: 6px`
- **In edit mode:** grid becomes `auto 1fr auto` — `TimePickerEditorial` on the left, label `<input>` (dashed-underline treatment), and a button cluster on the right: mic-toggle (marks as artist set), trash, Done. Done button is filled: `background: hsl(var(--foreground)); color: hsl(var(--background));` with a `check` icon.
- **"Add entry" button** at the bottom: ghost button, `plus` icon + "Add entry", 12px muted-foreground.

The `band` flag on a schedule entry already exists in the repo's `ScheduleRow` type — no schema change needed. The artist-set detection currently uses `isLoadInLabel` and similar heuristics; continue to set/clear `band` explicitly when the user toggles the mic button.

**Reference implementation:** `ScheduleRow`, `Schedule` in `Show Detail - Recommended.html`.

---

### 4. Day-of contact — card treatment

**Affected:** the `dosEditor` block in `ShowDetailPage.tsx` (currently a `FieldGroup` + two `FieldRow`s).

**New behavior.** Same data, rendered as a small `Card`:
- 38×38px avatar circle on the left: `background: var(--pastel-blue-bg); color: var(--pastel-blue-fg);` with the contact's initials in `DM Serif Display` 15px
- To the right: name (14px, 500) over role (12px muted)
- A 10px `paddingTop` rule separator (`1px solid hsl(var(--border)/0.6)`), then two stacked rows:
  - `phone` Lucide icon (12px, muted) + phone value (inline-edit, mono)
  - `mail` Lucide icon (12px, muted) + email value (inline-edit, mono)

**Empty state.** If both phone and email are absent, the whole card uses the existing `EmptyFieldPrompt` inside — matches the repo's existing pattern.

**Reference implementation:** `ContactCard` in `Show Detail - Recommended.html`.

---

### 5. Drive-time line — compact variant

**Affected:** the top of the `Show Info` tab, above `FieldGroup` pairs.

**Current behavior.** `DriveTimeCallout` component renders a full card with title, driving time, dismissal X, and an optional "suggested departure" inline CTA.

**New behavior.** A single compact line, no card:
- `car` Lucide icon (13px, muted)
- Drive duration (e.g. "5h 48m") — mono 13px, foreground color
- "drive from {origin}" — 13px, muted
- `·` separator
- "leave by {recommendedDeparture} for {loadIn} load in" — 13px, with the time itself in mono/foreground

Keep the existing "Use {recommendedDeparture}" pill inside the Departure empty state for when departure is unset — that part is well-designed and doesn't change. This just replaces the heavy top card.

**Reference implementation:** the `driveTimeLabel` row near the top of `ShowInfoTab` in `Show Detail - Recommended.html`.

---

## Design Tokens

All values come from the existing `src/index.css` / `colors_and_type.css` in the repo. Do not introduce new tokens.

- `--font-display: "DM Serif Display", serif;`
- `--font-sans: "Inter Tight", system-ui, sans-serif;`
- `--font-mono: "JetBrains Mono", ui-monospace, monospace;`
- `--ease-out: cubic-bezier(0.2, 0.8, 0.25, 1);`
- `--pastel-green-bg`, `--pastel-green-fg` — artist-set row accent
- `--pastel-blue-bg`, `--pastel-blue-fg` — DoS avatar
- All HSL semantic tokens: `--foreground`, `--muted-foreground`, `--muted`, `--border`, `--background`, etc.

## Interactions & Behavior

- **Click any read-mode value → enter inline edit** for just that value. No scroll, no focus shift beyond the one field.
- **Enter saves** (multiline: Cmd/Ctrl+Enter). **Blur saves.** **Escape cancels.**
- **Only one inline editor open at a time** — use the existing `inlineField` gate in `ShowDetailPage.tsx`. Opening a second field cancels the first.
- **Time picker:** clicking the time text swaps to an editable time input with the same type treatment; clicking AM or PM directly toggles without leaving read mode.
- **Schedule row:** clicking anywhere in a row (time, label, or blank) enters edit mode for that row. Done button or clicking outside commits.
- **Tab navigation:** preserve existing `viewTab` state machine (`"show" | "deal"`) with localStorage persistence — no changes.

## Out of Scope

- `FieldGroup` / `FieldRow` visual design — unchanged; these are the containers the new patterns plug into
- The `Show Info` tab's top-level section order (DoS + Departure → Arrival → Schedule → Venue → Accommodations → Guest list → Notes) — unchanged, matches repo
- `Deal Info` tab — unchanged; the Recommended prototype shows it with a revenue projection card as a possible enhancement but that's a follow-up, not part of this handoff
- `ParseAdvanceForShowDialog`, `SlackPushDialog`, `EmailBandDialog`, `ExportPdfDialog`, `SettleModal` — untouched
- Mobile responsive treatment — the desktop prototype is canonical; existing mobile behavior (stacked single-column at `md:` breakpoint) should be preserved

## Acceptance Checklist

- [ ] Every editable text/number field on Show Detail enters inline edit with dashed-underline treatment, no visible border/ring
- [ ] Keyboard hint `⏎ save   esc` appears while editing
- [ ] `TimeInput` renders time in DM Serif Display with a vertical AM/PM rail
- [ ] Schedule rows are individually clickable → per-row edit
- [ ] Artist-set schedule row shows green time, mic icon, `SET` marker
- [ ] Drive-time line is a compact single row at the top, not a card
- [ ] Day-of contact renders as a card with avatar + phone/email icon rows
- [ ] No console errors; existing mutations (`updateMutation`, `dosEditor.save`, etc.) still fire the same payloads
- [ ] Enter / Escape / blur behavior matches the prototype
