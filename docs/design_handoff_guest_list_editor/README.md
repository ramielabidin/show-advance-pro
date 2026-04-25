# Handoff: Guest List Editor (Show Detail page)

## Overview

The guest list section on the Show Detail page lets a tour manager build the night's comp list — names plus optional "plus N" for guests bringing additional people. This handoff redesigns it to fix three concrete problems with the current implementation:

1. **It's stuck in edit mode.** Every guest renders as a bordered text field by default. The page reads as unfinished and clashes with the rest of `ShowDetail`, which is read-by-default and tap-to-edit.
2. **The `+` glyph between name and number is misaligned.** It's a static character sitting between two inputs of different widths and heights, so it visually drifts row-to-row.
3. **The Save button at the bottom does nothing visible.** Pressing it shows a "Show updated" toast but doesn't change the editor's state — implying a state transition that doesn't exist.

The redesign matches the existing inline-editable pattern used by `FieldRow` and the Notes section: read-by-default, click-to-edit, autosave on commit. **No global Save button.** Pressing **Enter** in the name field commits the current row and immediately opens a fresh row below — the keyboard rhythm a TM expects when entering a list of names.

## About the Design Files

The files under `reference/` are **design references created in HTML** — a working prototype showing the intended look, layout, and interaction model. They are **not production code to copy directly**.

The Advance app is React 18 + TypeScript + Vite + Tailwind + shadcn/Radix. **Recreate this design in that codebase** using its existing patterns: `Button`, `Input`, `Card` from `src/components/ui/*`, the `FieldGroup` / `FieldRow` idiom, the design tokens in `src/index.css` and `tailwind.config.ts`. Do not import the prototype's inline styles; map them to Tailwind classes that consume the existing CSS variables (`hsl(var(--border))`, `bg-card`, `text-muted-foreground`, etc.).

## Fidelity

**High-fidelity (hifi).** Colors, typography, spacing, easing, and interaction states are all final and grounded in the Advance design system. Recreate pixel-perfectly using Tailwind utilities and the existing component library.

## The chosen variant

The user picked **Variant A — Read-then-edit row**. The other two explorations (B chip list, C editorial table) are visible in `reference/index.html` for context but should not be implemented.

## Component: `<GuestList />`

### Props

```ts
type Guest = {
  id: string;        // stable id, used as React key and for editing/deletion
  name: string;
  plus: number;      // number of additional people; 0 means just the named guest
};

type GuestListProps = {
  guests: Guest[];
  onChange: (next: Guest[]) => void;   // called on every commit; persist via existing show-mutation hook
};
```

In the real app, the parent `ShowDetailPage` owns the show object and calls the same mutation hook used by other inline edits (`useUpdateShow` or equivalent) inside `onChange`. There is no local "dirty" state — every commit writes through.

### Layout

The component renders three stacked elements with `space-y-3`:

1. **Section header** (matches existing `SectionLabel`):
   - Left: a 2px × 14px vertical bar, `rounded-sm`, `bg-foreground/25`, then the label `GUEST LIST` in `text-[11px] font-medium tracking-[0.14em] uppercase text-muted-foreground`.
   - Right: a guest count summary — `<UsersRound className="h-3 w-3" />` icon + total number in `font-mono text-xs text-muted-foreground`. The total is `guests.length + sum(guest.plus)`.

2. **List card** — `rounded-lg border bg-card`, no shadow at rest. Children stack with `border-b border-border/60` between rows (no border on the last row).
   - Read row: `grid grid-cols-[1fr_auto_32px] gap-2.5 items-center px-4 py-2.5`. Name in `text-sm`. If `plus > 0`, a `font-mono text-xs text-muted-foreground` showing `+{plus}`. Trailing 28×28 trash button.
   - Edit row: `grid grid-cols-[1fr_56px_32px] gap-2.5 items-center px-3 py-2`, background `bg-muted/35`. Name input + a "+ N" cluster.
   - **Add guest** affordance: a final row with `border-t border-border/60`, `px-4 py-3`, plus icon + `Add guest` label in `text-muted-foreground`, hover → `text-foreground`.

3. **Door list link button** below the card — outline button, size `sm`, `<Link className="h-3.5 w-3.5" />` icon + `Door list link`. (Existing button — leave its handler as a placeholder TODO; the door-list flow is out of scope for this PR.)

### Read-row (default state)

```
  ┌─────────────────────────────────────────────────────────────┐
  │  Melvin                                          +3   [🗑]  │   ← trash hidden until row hover
  └─────────────────────────────────────────────────────────────┘
```

- Click anywhere on the row → switch to edit mode for that row.
- Hovering a row applies `bg-muted/35`.
- The trash button has `opacity-0` at rest, `opacity-100` on row hover, with `transition-opacity duration-150 ease-out`. On hover of the trash itself, color goes to `text-destructive` and background to `bg-destructive/8`. Click stops propagation (don't enter edit mode).

### Edit-row

Two inputs in one row:

- **Name** input — `h-8 rounded-md border border-input bg-background px-2.5 text-sm font-sans`. Auto-focused on entering edit mode.
- **Plus** cluster — fixed 56px column. A muted `+` glyph (12px, `text-muted-foreground`) followed by a number input: `w-[42px] h-8 text-center font-mono text-sm rounded-md border border-input bg-background`. `min={0}`, `max={20}`. Strip native spinners.

Native number-input spinners must be hidden globally:

```css
input[type=number]::-webkit-outer-spin-button,
input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
input[type=number] { -moz-appearance: textfield; }
```

### Keyboard contract (the part the user cares most about)

| Key | In name field | In +N field |
| --- | --- | --- |
| **Enter** | Commit current row → append a new empty row → focus its name input. **Does not** blur the field cursor — the editor stays in flow. | Same. |
| **Escape** | Cancel: close edit mode without writing changes. | Same. |
| **Tab** | Move focus to the +N field of the same row (without committing). | Move focus to the next row's name field, committing the current row on the way (browser default). |
| **Blur** (click elsewhere) | Commit the row. **Exception:** if focus is moving to this row's `+N` input, do NOT commit (use `event.relatedTarget` check). | Commit the row. |

**Empty-name-on-commit deletes the row.** This is how a user removes a guest with the keyboard alone: select all, delete, Enter.

The relatedTarget trick — to avoid an Enter→Tab→commit flicker — is implemented by stamping the +N input with `data-row-sibling={guest.id}` and short-circuiting `onBlur` on the name input when `event.relatedTarget?.dataset.rowSibling === guest.id`. See `reference/GuestListA.jsx` lines 105-117.

### Implementation sketch (state)

```ts
const [editingId, setEditingId] = useState<string | null>(null);
const [draft, setDraft] = useState<{ name: string; plus: number }>({ name: '', plus: 0 });
const inputRef = useRef<HTMLInputElement>(null);
useEffect(() => { if (editingId) inputRef.current?.focus(); }, [editingId]);

// writeBack returns the resulting array so commitAndNext can chain off it
function writeBack(): Guest[] {
  if (!editingId) return guests;
  const name = draft.name.trim();
  const next = !name
    ? guests.filter(g => g.id !== editingId)
    : guests.map(g => g.id === editingId
        ? { ...g, name, plus: Math.max(0, Number(draft.plus) || 0) }
        : g);
  onChange(next);
  return next;
}

function commit() { writeBack(); setEditingId(null); }
function commitAndNext() {
  const after = writeBack();
  const id = crypto.randomUUID();          // or your existing id helper
  onChange([...after, { id, name: '', plus: 0 }]);
  setEditingId(id);
  setDraft({ name: '', plus: 0 });
}
```

The `commitAndNext` flow is the load-bearing piece — without it, Enter just blurs and the user has to click Add guest to keep typing.

## Removed surfaces

- **The bottom `Save` button is gone.** Every other field on `ShowDetail` autosaves; this section now matches.
- **The `+ Add Guest` ghost row at the bottom of the original** is replaced by an in-card "Add guest" row inside the card border (so the affordance is structurally part of the list). Door list link is the only thing below the card now.

## Design Tokens (already in `src/index.css`)

All values reference existing CSS variables — don't introduce new ones.

| Surface | Token / class |
| --- | --- |
| Card background | `bg-card` |
| Card border | `border border-border` (rest); `border-border/60` for inner row dividers |
| Edit-row background | `bg-muted/35` |
| Hovered read-row | `bg-muted/35` |
| Section label color | `text-muted-foreground` |
| Input border | `border-input` |
| Input background | `bg-background` |
| Trash hover bg | `bg-destructive/8` (use the destructive token, not raw red) |
| Trash hover color | `text-destructive` |
| Mono numbers | `font-mono` (JetBrains Mono in the design system) |
| Eyebrow tracking | `tracking-[0.14em]` (or the existing eyebrow utility) |
| Transition easing | `--ease-out` (150ms for hover, 160ms for press) |
| Border radius | `rounded-md` (inputs, buttons) · `rounded-lg` (card) · `rounded-sm` (label bar) |

## Iconography

Lucide React, 1.5px stroke (already the project default):

- `Plus` — Add guest row
- `Trash2` — remove icon (h-3.5 w-3.5)
- `UsersRound` — guest count summary in header
- `Link` — door list link button

Do not introduce custom SVGs.

## Accessibility

- Trash button: `aria-label="Remove {guest.name}"`.
- The `Add guest` row is a button (or has `role="button"`, `tabIndex=0`, Enter/Space handlers). Ensure keyboard users can reach it.
- Read-row click target should be the whole row (already the case in the design); make sure it's keyboard-activatable too — when focused, Enter enters edit mode.
- Respect `prefers-reduced-motion` — already handled globally in `src/index.css`.

## State Management

Wire `onChange` to the existing show-mutation hook used by other inline edits on the page (`useUpdateShow` in `src/hooks/` or whatever it's currently called — the prototype doesn't know). The toast that the original `Save` button fired should now fire from inside the mutation's `onSuccess` and only on the underlying field changing — i.e. don't toast on every keystroke, only on successful commits. Match the toast copy used by Notes/FieldRow saves (`"Saved"`).

## Files

`screenshots/` — visual references of variant A:
- `01-default.png` — the list at rest (read mode)
- `02-row-hover.png` — hovering a row reveals the trash button
- `03-edit-mode.png` — clicking a row swaps it for the name + plus inputs

`reference/`:

- `index.html` — open this to see the prototype. Use the **Tweaks** panel (bottom-right) to switch between variants A/B/C; the chosen one is **A**.
- `GuestListA.jsx` — the component to recreate. Read this first.
- `App.jsx` — host page wiring, including the seed data.
- `Primitives.jsx` — `Button`, `Card`, `Chip`, `Icon` — these mirror the equivalents in the real app's `src/components/ui/*`. The styling values are the source of truth where the design system doc is silent.
- `colors_and_type.css` — the token sheet; same token names as the real `src/index.css`.
- `tweaks-panel.jsx` — design-only tooling, ignore for implementation.

## Out of scope

- Door list link behavior (button is present, handler is a TODO).
- Drag-to-reorder guests.
- Bulk paste (e.g., paste a CSV / newline-separated list of names into the Add guest row). Worth filing as a follow-up — pasting a list is the single fastest way for a TM to import a comp list.
- Per-guest notes (e.g. `"label & manager"`). Not in current data model.
