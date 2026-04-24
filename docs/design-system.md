# Design System

## Design Engineering Philosophy

### Taste is trained, not innate

Good taste is not personal preference. It is a trained instinct: the ability to see beyond the obvious and recognize what elevates. Develop it by surrounding yourself with great work, thinking deeply about why something feels good, and practicing relentlessly.

When building UI, don't just make it work. Study why the best interfaces feel the way they do. Reverse engineer animations. Inspect interactions. Be curious.

### Unseen details compound

Most details users never consciously notice. That is the point. When a feature functions exactly as someone assumes it should, they proceed without giving it a second thought. That is the goal.

Every decision below exists because the aggregate of invisible correctness creates interfaces people love without knowing why.

### Beauty is leverage

People select tools based on the overall experience, not just functionality. Good defaults and good animations are real differentiators. Beauty is underutilized in software. Use it as leverage to stand out.

> The philosophy in this document draws heavily on Emil Kowalski's design engineering work (creator of Sonner and Vaul, both used in this codebase). To go deeper on the craft: [animations.dev](https://animations.dev/).

---

## How to Use This Document

This doc is the single source of truth for visual + interaction design in this codebase. Before writing any component or page code, scan the relevant section. The [Quick Reference Cheat Sheet](#quick-reference-cheat-sheet) at the end is the fastest way to avoid the most common mistakes.

**Priority order when making a decision:**

1. Follow existing patterns in the codebase (grep for similar components first).
2. Apply the rules in this document.
3. Only deviate with a specific, articulable reason.

---

## Design Thinking (Before You Write Code)

Most generic AI-generated UI fails not because of technique but because of absent intentionality. Before writing any new component or page, answer four questions — even briefly:

1. **Purpose.** What problem does this solve? Who uses it, and in what emotional state? (A tour manager refreshing a day sheet at 6pm before doors is a different user than the same person sitting down at their desk in the morning.)
2. **Tone.** This app's tone is already committed: *editorial, warm-monochrome, restrained, musician-first*. Your job is to execute it, not to invent a new direction for this screen. If a component feels like it wants a purple gradient or a pill-shaped CTA, that's a signal the aesthetic is being abandoned, not enhanced.
3. **Differentiation.** What is the one detail on this screen someone will remember? The drive-time callout with a display-font number. The dot-indicator on show rows. The inline-editable everything on the detail page. Every new screen deserves at least one such detail.
4. **Restraint check.** Minimalism and maximalism both work *when intentional*. This app is in the refined-minimalist camp: distinctive typography, tight spacing, muted pastels, borders over shadows. That means elegance comes from precision, not intensity — the craft lives in spacing, type hierarchy, and subtle transitions, not in decorative flourishes.

**Match implementation complexity to the aesthetic direction.** A refined-minimalist component that ships with twelve hover states, three gradient layers, and a particle effect is not sophisticated — it's incoherent. Restraint is a feature.

### The generic-AI smell test

Before committing, ask: *could this exact component appear in any other AI-generated SaaS app?* If yes, it's under-designed. Signs you've drifted into generic territory:

- Default system font stack, or Inter / Roboto / Arial as primary
- Primary button sits on a purple-to-pink gradient
- Cards have both a border and a drop shadow and rounded corners ≥ 16px
- Every section is perfectly centered with identical spacing
- The "empty state" is a lucide icon in a circle with a generic tagline
- Every animation is the same 300ms ease-in-out

Cross-check against the [Anti-Patterns](#anti-patterns-repo-specific) table before shipping.

### Delight in a pro tool

Advance is an operational tool. The user is a tour manager at 6pm before doors, checking a schedule. They're not browsing for fun. Delight here doesn't mean confetti and bouncy animations — it means warmth placed precisely where it lands.

There's real tension with the animation framework: *"no animation for 100x/day actions"* vs. *"add moments of joy."* Both are right. The resolution is placement.

**Where delight belongs:**

- **Genuine achievements** — settling a show after the night is a real moment. A subtle scale pulse on the Settled badge is earned. A full confetti burst is not.
- **First-time moments** — first show created, first tour completed. Meaningful milestones only, not every action.
- **Empty states** — already handled with musician-specific warmth (`"Add people to your touring party"`). Keep it specific; avoid generic AI tone.
- **Time-aware touches** — the `"Good morning / afternoon / evening"` dashboard greeting is already this pattern.
- **Pastel categorization** — using considered color rather than arbitrary palette choices is itself a quiet delight.

**Where delight does not belong:**

- **High-frequency operations** — toggling advanced, saving, scrolling the show list. These must stay fast and silent.
- **Critical errors** — an advance failing to send is not a place for playful copy. Clarity is the warmth.
- **Repeated-use surfaces** — the show detail page gets opened dozens of times per tour. Anything that delights on day 1 grates by day 30.

**The loading-message anti-slop rule.** Never use generic AI whimsy — it's instantly recognizable as machine-generated.

- ❌ "Herding pixels" | "Teaching robots to dance" | "Brewing something special" | "Consulting the magic 8-ball"
- ✅ "Parsing your advance email" | "Pulling this tour's numbers" | "Syncing with your band's schedule" | "Getting the latest from the venue"

Loading copy that references what's actually loading feels intentional. Generic whimsy feels templated. Same rule applies to empty states, success states, and any interstitial copy: be specific about what's happening, stay in the musician's voice, and don't reach for filler.

---

## Review Format

When reviewing UI code, use a markdown table with Before/After columns:

| Before | After | Why |
| --- | --- | --- |
| `transition: all 300ms` | `transition: transform 200ms ease-out` | Specify exact properties; avoid `all` |
| `transform: scale(0)` | `transform: scale(0.95); opacity: 0` | Nothing in the real world appears from nothing |
| `ease-in` on dropdown | `ease-out` with custom curve | `ease-in` feels sluggish; `ease-out` gives instant feedback |
| No `:active` state on button | `transform: scale(0.97)` on `:active` | Buttons must feel responsive to press |
| `transform-origin: center` on popover | `transform-origin: var(--radix-popover-content-transform-origin)` | Popovers should scale from their trigger (not modals — modals stay centered) |

---

## Design Tokens (Source of Truth)

All tokens live in `src/index.css` as CSS variables on `:root` and `.dark`. Never hardcode colors, durations, or easing curves — reference the token.

### Colors (HSL)

The base is **warm monochrome**, never pure black or white. Light mode lives on a warm off-white (`40 30% 97%`), dark mode on a warm near-black (`30 10% 8%`).

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--background` | `40 30% 97%` | `30 10% 8%` | Page canvas |
| `--foreground` | `30 10% 12%` | `40 20% 92%` | Primary text |
| `--card` | `40 25% 99%` | `30 10% 10%` | Elevated surfaces |
| `--muted` | `35 15% 94%` | `30 8% 16%` | Quiet surfaces |
| `--muted-foreground` | `30 8% 50%` | `30 8% 55%` | Secondary text |
| `--border` | `35 18% 90%` | `30 8% 18%` | All borders, dividers |
| `--primary` | `30 10% 12%` | `40 20% 92%` | Primary buttons (inverts in dark) |
| `--accent` | `35 20% 93%` | `30 8% 16%` | Hover backgrounds |
| `--destructive` | `0 72% 51%` | `0 62.8% 30.6%` | Destructive actions |

**Use the Tailwind tokens, not raw HSL.** Classes like `bg-background`, `text-foreground`, `border-border`, `text-muted-foreground` are how you reference these. Only drop to `hsl(var(--token))` when you need a value inside an inline style (e.g. the green Settle button uses `bg-[hsl(var(--success))]`).

### Pastel Accent System

For status indication, categorization, and subtle emphasis. **These are the only "accent colors" allowed.** Never reach for raw Tailwind colors like `bg-blue-500` or `text-red-400`.

| Token | Light BG | Light FG | Use |
| --- | --- | --- | --- |
| `--pastel-blue-bg` / `-fg` | `#e1f3fe` | `#1f6c9f` | Tour chips, information |
| `--pastel-green-bg` / `-fg` | `#edf3ec` | `#346538` | Settled, success |
| `--pastel-yellow-bg` / `-fg` | `#fbf3db` | `#956400` | Not-yet-advanced, warnings, attention |
| `--pastel-red-bg` / `-fg` | `#fdebec` | `#9f2f2d` | Within-7-days, urgent |

Reference via inline style: `style={{ backgroundColor: "var(--pastel-blue-bg)", color: "var(--pastel-blue-fg)" }}`. Dark mode variants are automatic (defined on `.dark`).

**Semantic tokens** (`--success`, `--warning`, `--badge-new`) exist for the loudest status colors — use them for buttons like Settle (`bg-[hsl(var(--success))]`) and for the "New" badge on unreviewed shows.

### Typography

The repo uses three fonts, loaded via Google Fonts and configured in `tailwind.config.ts`:

| Font | Class | Use |
| --- | --- | --- |
| **DM Serif Display** | `font-display` | Display headings, stat numbers, large dates |
| **DM Sans** | `font-sans` (default) | All UI — body, labels, buttons |
| **JetBrains Mono** | `font-mono` | Phone numbers, times, money, confirmation codes, addresses-as-data |

**Hierarchy rules — study these carefully, they're used consistently across the app:**

- Page titles: `text-2xl sm:text-3xl tracking-tight` (sans, not display — subtle)
- Display numbers (stat cards, big dates): `font-display tracking-[-0.03em]`
- Section labels: `text-[11px] uppercase tracking-widest text-muted-foreground font-medium`
- Eyebrow labels above titles: `text-xs uppercase tracking-widest text-muted-foreground font-medium`
- Tiny labels (chip text): `text-[10px] uppercase tracking-widest font-medium`
- Body: `text-sm` (14px) is the default — `text-base` is reserved for content-heavy reading
- Secondary body: `text-sm text-muted-foreground`

**Never use `text-xs` for anything a user needs to read in passing.** Reserve it for captions, meta, timestamps.

### Radii

- `--radius: 0.5rem` is the source of truth
- Buttons, inputs, cards, dialogs → `rounded-md` (derived from `--radius`)
- Chips, pills, status badges → `rounded-full`
- Avatars → `rounded-full`

### Easing Curves

Defined as CSS variables, used with Tailwind arbitrary values. **Never use raw `ease`, `ease-in`, `ease-out`, or `ease-in-out`** — they're too weak.

```css
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);      /* Default for UI */
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1); /* Morphs, moves */
--ease-editorial: cubic-bezier(0.16, 1, 0.3, 1); /* Hero / page entrance */
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);   /* Vaul drawers */
```

Usage in Tailwind: `[transition:transform_160ms_var(--ease-out)]`.

### Durations

| Element | Duration |
| --- | --- |
| Button press (`active:scale-[0.97]`) | 160ms |
| Hover color/bg change | 150ms |
| Tooltips, small popovers | 125–200ms |
| Dropdowns, selects | 150–250ms |
| Page fade-in | 220ms |
| Modals, drawers | 200–500ms |
| Stagger cascade delay between items | 40ms |

**UI animations should stay under 300ms.**

### Perceived performance

Speed in animation is not just about feeling snappy — it directly affects how users perceive the app's performance:

- A **fast-spinning spinner** makes loading feel faster (same load time, different perception).
- A **180ms dropdown** feels more responsive than a 400ms one, even though the difference is 220ms.
- **Instant tooltips after the first one is open** (skip delay + skip animation on adjacent hovers) make a toolbar feel dramatically faster.
- `ease-out` at 200ms *feels* faster than `ease-in` at 200ms because movement starts immediately — at the exact moment the user is watching most closely.

When in doubt, pick the faster option. The cost of "slightly too fast" is far lower than the cost of "slightly too slow."

---

## The Animation Decision Framework

### 1. Should this animate at all?

**Ask:** How often will users see this animation?

| Frequency | Decision |
| --- | --- |
| 100+ times/day (keyboard shortcuts, command palette toggle) | No animation. Ever. |
| Tens of times/day (hover effects, list navigation) | Remove or drastically reduce |
| Occasional (modals, drawers, toasts) | Standard animation |
| Rare/first-time (onboarding, feedback forms, celebrations) | Can add delight |

**Never animate keyboard-initiated actions.** These are repeated hundreds of times daily. Animation makes them feel slow and disconnected.

### 2. What is the purpose?

Every animation must answer "why does this animate?"

Valid purposes:
- **Spatial consistency**: toast enters and exits from the same direction
- **State indication**: a morphing button shows the state change
- **Feedback**: a button scales down on press, confirming the interface heard the user
- **Preventing jarring changes**: elements appearing without transition feel broken

If the purpose is just "it looks cool" and the user will see it often, don't animate.

### 3. What easing should it use?

- Entering/exiting → `--ease-out` (starts fast, feels responsive)
- Moving/morphing on screen → `--ease-in-out` (natural acceleration/deceleration)
- Hover/color change → `--ease-out`
- Constant motion (marquee, progress bar) → `linear`
- Page entrance → `--ease-editorial`

**Never use `ease-in` for UI animations.** It starts slow, making the interface feel sluggish.

### 4. How fast should it be?

See the Durations table above.

---

## Spring Animations

Springs feel more natural than duration-based animations because they simulate real physics.

**When to use springs:**
- Drag interactions with momentum
- Elements that should feel "alive"
- Gestures that can be interrupted mid-animation

The pull-to-refresh indicator (`src/components/PullToRefresh.tsx`) uses a spring curve on release: `cubic-bezier(0.34, 1.56, 0.64, 1)` — the slight overshoot at the end is what makes it feel native.

```jsx
import { useSpring } from 'framer-motion';

// Without spring: feels artificial, instant
const rotation = mouseX * 0.1;

// With spring: feels natural, has momentum
const springRotation = useSpring(mouseX * 0.1, {
  stiffness: 100,
  damping: 10,
});
```

Keep bounce subtle (0.1–0.3). Avoid bounce in most UI contexts.

### Interruptibility advantage

Springs maintain velocity when interrupted — CSS animations and keyframes restart from zero. This makes springs ideal for gestures the user might change mid-motion. When an expanded item is clicked and Escape is pressed mid-animation, a spring reverses smoothly from its current position rather than snapping. For any interaction that can be cancelled in flight (drawer drags, pull-to-refresh, anything gesture-driven), prefer springs or CSS transitions over keyframes.

---

## Component Building Principles

### Buttons must feel responsive

The `Button` component (`src/components/ui/button.tsx`) already bakes in `active:scale-[0.97]` with a 160ms ease-out transition and `motion-reduce:active:scale-100`. Don't override this.

```css
.button {
  transition: transform 160ms var(--ease-out);
}

.button:active {
  transform: scale(0.97);
}
```

### Never animate from scale(0)

```css
/* Bad */
.entering { transform: scale(0); }

/* Good */
.entering {
  transform: scale(0.95);
  opacity: 0;
}
```

### Make popovers origin-aware

Popovers scale from their trigger, not from center. **Exception: modals** stay `transform-origin: center`. Already configured in `src/components/ui/dropdown-menu.tsx` via `var(--radix-dropdown-menu-content-transform-origin)`.

### Tooltips: skip delay on subsequent hovers

Once one tooltip is open, hovering adjacent tooltips should open them instantly. `TooltipProvider` is already configured with `delayDuration={0}` in the sidebar primitive.

### Use CSS transitions over keyframes for interruptible UI

CSS transitions can be retargeted mid-animation. Keyframes restart from zero.

### Use blur to mask imperfect transitions

Add subtle `filter: blur(2px)` during a crossfade when it feels off. Keep blur under 20px.

### Animate enter states with @starting-style

```css
.toast {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 400ms ease, transform 400ms ease;

  @starting-style {
    opacity: 0;
    transform: translateY(100%);
  }
}
```

---

## CSS Transform Mastery

- `translateY(100%)` moves an element by its own height — use percentages, not pixels
- `scale()` scales children too — a feature, not a bug
- `transform-style: preserve-3d` enables real 3D effects
- `transform-origin` defaults to center — set it to match the trigger for origin-aware interactions

---

## clip-path for Animation

### The inset shape

```css
/* Hidden from right */
.hidden { clip-path: inset(0 100% 0 0); }

/* Fully visible */
.visible { clip-path: inset(0 0 0 0); }
```

**Use cases:**
- Tabs with perfect color transitions (duplicate + clip)
- Hold-to-delete pattern (slow fill on `:active`, fast release)
- Image reveals on scroll
- Comparison sliders

---

## Gesture and Drag Interactions

See `src/hooks/usePullToRefresh.ts` for the canonical example. Key principles in use:

- **Momentum-based dismissal**: check velocity (`distance / time > 0.11`), not just distance
- **Damping at boundaries**: the pull uses `resist()` — `(rawDelta * MAX_VISUAL) / (rawDelta + MAX_VISUAL * 1.4)` — approaches the ceiling asymptotically instead of hard-stopping
- **Pointer capture**: capture all pointer events once drag starts
- **Multi-touch protection**: ignore additional touch points after drag begins
- **Friction instead of hard stops**: allow overscroll with increasing resistance
- **Disable native bounce**: `overscroll-behavior-y: contain` on `body` so Safari's rubber-band doesn't conflict with your gesture

---

## Performance Rules

### Only animate transform and opacity

These skip layout and paint, running on the GPU. Never animate `padding`, `margin`, `height`, or `width`.

### Don't use CSS variables for per-frame updates

```js
// Bad: triggers recalc on all children
element.style.setProperty('--swipe-amount', `${distance}px`);

// Good: only affects this element
element.style.transform = `translateY(${distance}px)`;
```

### Framer Motion hardware acceleration

Shorthand props (`x`, `y`, `scale`) are NOT hardware-accelerated. Use full transform strings for smooth animations under load:

```jsx
// NOT hardware accelerated
<motion.div animate={{ x: 100 }} />

// Hardware accelerated
<motion.div animate={{ transform: "translateX(100px)" }} />
```

### CSS animations beat JS under load

CSS animations run off the main thread. Use CSS for predetermined animations; JS for dynamic, interruptible ones.

### WAAPI for programmatic CSS animations

```js
element.animate(
  [{ clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0 0)' }],
  { duration: 1000, fill: 'forwards', easing: 'cubic-bezier(0.77, 0, 0.175, 1)' }
);
```

---

## Accessibility

### prefers-reduced-motion

The codebase handles this globally in `src/index.css` — it disables stagger, card-pressable scaling, and neutralizes Radix `data-state` motion. **Don't duplicate this handling inside components** unless you're introducing a new animation type that isn't covered.

Reduced motion means fewer and gentler animations, not zero. Keep opacity/color transitions; remove movement animations.

```css
@media (prefers-reduced-motion: reduce) {
  .element {
    animation: fade 0.2s ease;
  }
}
```

### Touch device hover states

Wrap hover styles in a media query so tablets and phones don't fire sticky hover states.

```css
@media (hover: hover) and (pointer: fine) {
  .element:hover {
    transform: scale(1.05);
  }
}
```

### Touch target sizing

**Critical rule for this app:** tap targets on mobile must be at least 44×44px. The pattern is `h-11 sm:h-9` for buttons and inputs — 44px on mobile, 36px on desktop. This is used consistently across `SettingsPage`, `ShowDetailPage`, and all dialogs. **Never use `h-9` alone for an action button.**

---

## Stagger Animations

The codebase has a ready-made utility: **`.stagger-list`**. Apply it to any container and its direct children will fade up in sequence. Defined in `src/index.css`:

```html
<div className="stagger-list space-y-2">
  <div>item 1</div>  <!-- 0ms delay -->
  <div>item 2</div>  <!-- 40ms delay -->
  <div>item 3</div>  <!-- 80ms delay -->
  <!-- ...caps at 320ms for item 9+ -->
</div>
```

**Re-triggering on content change:** pass a `key` to the wrapping container that changes when the dataset changes. The dashboard uses this to replay stagger when the user switches scope:

```jsx
<div key={`stats:${scopeKey}`}>
  <div className="stagger-list ...">{cards.map(...)}</div>
</div>
```

For per-item control with a computed delay, use `.stagger-item` on the child and set `animationDelay` inline.

Keep stagger delays short (30–80ms — we use 40ms). Never block interaction while stagger plays.

---

## Asymmetric Enter/Exit Timing

Slow where the user is deciding, fast where the system responds.

```css
/* Release: fast */
.overlay { transition: clip-path 200ms ease-out; }

/* Press: slow and deliberate */
.button:active .overlay { transition: clip-path 2s linear; }
```

---

## Building Loved Components

These principles come from building Sonner (used for toasts in this repo) and Vaul (used for drawers). They apply to any new component worth building well.

1. **Developer experience is the product.** The fewer steps to use something, the more it gets used. Sonner's API is `toast("message")` — no hooks, no context. When building a shared component here, ask: can someone use this in one line?
2. **Good defaults beat options.** Ship a beautiful default. Most callers never customize — the out-of-the-box easing, timing, spacing, and visual design should be genuinely excellent on first render. Every configurable option is a future maintenance tax.
3. **Handle edge cases invisibly.** Sonner pauses timers when the tab is hidden, fills gaps between stacked toasts with pseudo-elements to maintain hover state, captures pointer events during drag. Users never notice any of this, and that's exactly right. The baseline for "good" is that nothing feels broken in any state the user can reach.
4. **Use transitions, not keyframes, for dynamic UI.** Anything that can be triggered rapidly (toasts, list additions, state toggles) needs to be interruptible. Transitions retarget smoothly; keyframes restart from zero.
5. **Cohesion matters more than any individual choice.** Sonner feels satisfying partly because everything agrees — the easing, the duration, the type, the color, even the name all belong to the same vibe. When motion, type, color, and copy disagree, the component feels cheap. When they agree, the whole thing elevates. Match motion to the mood of the surrounding surface. A dashboard should feel crisp and fast; a celebration screen can afford a little bounce.

---

## Debugging Animations

Animations that look fine at full speed often hide problems only visible on closer inspection. When something feels off but you can't name why:

- **Slow motion first.** Temporarily multiply duration by 3–5x, or use the Chrome DevTools Animation panel's playback speed. Look for: colors transitioning through muddy intermediate states, the easing starting or stopping abruptly, wrong transform-origin causing the element to scale from the wrong point, multiple animated properties falling out of sync.
- **Frame by frame.** The DevTools Animations panel lets you step through a single frame at a time. This is how timing issues between coordinated properties (opacity + transform, for example) become visible.
- **Real devices for gesture work.** Pull-to-refresh, drawers, anything touch-based — the simulator lies. Connect a physical phone via USB, hit your local dev server by IP, and use Safari's remote devtools. The feel is different on real hardware.
- **Review with fresh eyes the next day.** The imperfections you couldn't see while building become obvious after sleep. Most polish passes happen not during the initial build but the next morning.

---

## Repo-Specific Component Patterns

These patterns appear throughout the codebase. Match them exactly when building new features.

### Page header

Every page opens with the same pattern: a small uppercase eyebrow, a large sans-serif title, and a muted secondary line.

```jsx
<div>
  <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-0.5">
    {eyebrow}
  </p>
  <h1 className="text-2xl sm:text-3xl tracking-tight">{title}</h1>
  <p className="text-sm text-muted-foreground mt-0.5 sm:mt-1">{subline}</p>
</div>
```

On `DashboardPage` the eyebrow is the time-of-day greeting. On `SettingsPage` it's the word "Settings" directly. On `TourScopedHeader` the eyebrow is "TOUR".

### Section label

Used inside page bodies to head subsections. Not an `<h2>` — it's a styled div with a bottom border:

```jsx
<div className="mb-3 border-b border-border/60 pb-2">
  <span className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
    {children}
  </span>
</div>
```

Or, inside a `FieldGroup`, a smaller variant with a left-side dot accent (see `src/components/FieldGroup.tsx`).

### Card

Borders, not shadows. The default card is `rounded-lg border bg-card`. Shadow use is minimal — `shadow-sm` appears on hover for `card-pressable`, and dropdowns use `shadow-[0_8px_24px_rgba(0,0,0,0.06)]`. Never reach for `shadow-lg` or `shadow-xl`.

For a clickable card, combine with `card-pressable` — it adds `active:scale-[0.97]` and a gentle hover lift:

```jsx
<Link to={...} className="group block card-pressable">
  <Card className="hover:border-foreground/20 [transition:border-color_160ms_var(--ease-out)]">
    <CardContent>...</CardContent>
  </Card>
</Link>
```

### Stat card

Grid of 2 or 4. Small colored pill icon at top-left, tiny uppercase label, large display number. Used on the dashboard.

```jsx
<Card className="overflow-hidden shadow-none">
  <CardContent className="pt-4 pb-3 px-4">
    <div className="flex items-center gap-2 mb-2">
      <div
        className="h-6 w-6 rounded-md flex items-center justify-center shrink-0"
        style={{ backgroundColor: "var(--pastel-blue-bg)", color: "var(--pastel-blue-fg)" }}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <span className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium leading-tight">
        {label}
      </span>
    </div>
    <p className="text-3xl font-display text-foreground leading-none tracking-[-0.03em]">
      {value}
    </p>
  </CardContent>
</Card>
```

### Chip / Badge (pastel)

For tour tags, status chips, and categorization. Always `rounded-full`, uses pastel tokens via inline style.

```jsx
<span
  className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium shrink-0"
  style={{ backgroundColor: "var(--pastel-blue-bg)", color: "var(--pastel-blue-fg)" }}
>
  {label}
</span>
```

The shadcn `Badge` component is available too (`src/components/ui/badge.tsx`) — use it when you want the default ink-on-canvas variants; drop to the pastel pattern when the chip is categorical rather than hierarchical.

### Status dot

Tiny colored circle that communicates state with zero text. Used on show list rows — green for advanced, red for within-7-days, yellow for pending, matching the pastel `-fg` values (not the `-bg`, because the dot is small and needs the saturation).

```jsx
<span
  className="h-2 w-2 rounded-full shrink-0"
  style={{ backgroundColor: "var(--pastel-green-fg)" }}
/>
```

### Empty state

Always use the `EmptyState` component (`src/components/EmptyState.tsx`) — icon in a muted circle, title, description, and optional action. Never roll a new empty state from scratch.

```jsx
<EmptyState
  icon={Calendar}
  title="No upcoming shows"
  description="Add a show manually or paste an advance email to get started."
  action={<CreateShowDialog />}
/>
```

### Empty field prompt

For inline-editable fields that are currently blank. Italic, extra-muted, italic "Tap to add X" text. Component: `src/components/EmptyFieldPrompt.tsx`.

### Inline edit pattern

The detail pages (`ShowDetailPage`) are aggressively inline-editable — there is no separate "Edit" mode or modal for most fields. The pattern:

1. Display the field as a clickable button.
2. On click, swap in an `<Input>`, `<Textarea>`, or specialized picker (`TimeInput`, `GuestListEditor`).
3. Save on blur, Enter, or explicit Save button. Cancel on Escape.
4. Use `InlineActions` (Save/Cancel row) for multi-field groups like hotel or backend deal.
5. Scroll the editor into view on mount (see `inlineRef` pattern).

**Empty fields still show a prompt** (`EmptyFieldPrompt`) rather than just disappearing — users need to know the field exists and is editable. Use `alwaysShow: true` on the `editField` helper for this.

### FieldGroup / FieldRow

The canonical detail-page layout primitive. `FieldGroup` provides the section title with a dot accent and optional incomplete marker; `FieldRow` displays `label: value` with proper mono/sans routing and auto-detects numbered lists in text values.

```jsx
<FieldGroup title="Day of Show Contact" incomplete={!show.dos_contact_name}>
  <FieldRow label="Name" value={show.dos_contact_name} />
  <FieldRow label="Phone" value={show.dos_contact_phone} mono />
</FieldGroup>
```

### Scope / view pill

Segmented-control-like pills used for view toggles (Dashboard scope, Shows view). Active = inverted foreground; inactive = bordered with accent hover. See `ScopePill` in `DashboardPage` and `ViewPill` in `ShowsPage` — they're identical; consider extracting.

```jsx
<button
  onClick={onClick}
  className={cn(
    "inline-flex items-center h-9 px-3 rounded-md border text-sm font-medium transition-colors",
    active
      ? "bg-foreground text-background border-foreground"
      : "bg-background text-foreground border-input hover:bg-accent",
  )}
>
  {label}
</button>
```

### Compact tab bar

For upcoming/past and similar short binary toggles. Rounded container with two inset pills. See `ShowsPage`.

```jsx
<div className="flex items-center gap-1 rounded-md border p-0.5 bg-card">
  {options.map((t) => (
    <button
      key={t}
      onClick={() => setTab(t)}
      className={cn(
        "px-3 py-1 text-xs font-medium rounded-[5px] capitalize transition-colors",
        tab === t
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {t}
    </button>
  ))}
</div>
```

### Dialog

shadcn `Dialog`. Full-screen on mobile, centered lg-max on desktop. Always includes `DialogHeader` with `DialogTitle` and usually `DialogDescription`. Backdrop uses `bg-foreground/40 backdrop-blur-[2px]` — not `bg-black/80`. Already configured.

### Alert Dialog

**Every destructive action is confirmed with `AlertDialog`** — never a browser `confirm()`. The destructive `AlertDialogAction` gets `bg-destructive text-destructive-foreground hover:bg-destructive/90`. See the delete-show and remove-from-tour patterns in `ShowsPage.tsx`.

### Drive-time card / data callout

A recurring pattern: `border + bg-muted/30` rounded container with a lucide icon, display-font number, and tiny uppercase metadata below. Self-contained unit of data surfaced in-context.

```jsx
<div className="flex items-start gap-4 rounded-md border bg-muted/30 px-4 py-3">
  <Icon className="h-4 w-4 mt-1 shrink-0 text-muted-foreground" />
  <div className="flex-1 min-w-0">
    <div className="font-display text-2xl text-foreground leading-none tracking-[-0.02em]">
      {primary}
    </div>
    <div className="mt-1 text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
      {secondary}
    </div>
  </div>
</div>
```

### Dropdown menu

Used for the Share and overflow (⋮) menus. Transform origin is wired up via `var(--radix-dropdown-menu-content-transform-origin)` — leave it alone.

### Loading states

Use `Skeleton` (`src/components/ui/skeleton.tsx`) with `rounded-md bg-muted animate-pulse`. For data fetching: show 3 skeleton rows matching the eventual layout, not a spinner.

```jsx
{isLoading ? (
  <div className="space-y-2">
    {[1, 2, 3].map((i) => (
      <div key={i} className="h-14 rounded-md bg-muted animate-pulse" />
    ))}
  </div>
) : (
  ...
)}
```

For single-button loading, use `Loader2` from lucide with `animate-spin` inside the disabled button.

### Toasts

Use `sonner` via `toast.success()` / `toast.error()` / `toast.info()`. Errors come from mutation `onError` handlers. **Never** use `try/catch` with `console.log` for user-facing failures — wire it through a mutation or call `toast.error(message)` directly.

---

## Page-Level Patterns

### Action clusters (mobile vs desktop)

Detail pages ship two versions of action rows — a horizontal cluster for desktop, a stacked column for mobile — gated with `hidden md:flex` and `flex md:hidden`. See `ShowDetailPage`. Primary CTA (Settle Show) is full-width on mobile, first in the cluster on desktop. Overflow menu (⋮) on the right in both.

**Pattern:** primary action (filled, brand green for Settle) → secondary action (outlined yellow when attention needed) → Share dropdown → overflow menu.

### Container widths

- Full-width surface: `container` (Tailwind)
- Detail pages: `max-w-3xl`
- Settings: `max-w-5xl`
- Auth / onboarding: `max-w-sm` centered

### Vertical rhythm

- Between top-level sections: `space-y-6 sm:space-y-8` (24px mobile, 32px desktop)
- Between related items in a list: `space-y-2` or `space-y-3`
- Between sibling form fields: `space-y-4`
- `Separator` component between major sections inside a detail page

### Page transitions

`animate-fade-in` class on the root of each page. No route-level transitions.

---

## Anti-Patterns (Repo-Specific)

These come up repeatedly in AI-generated code. Do not do them.

| Anti-pattern | Why | Fix |
| --- | --- | --- |
| Raw Tailwind color classes (`bg-blue-500`, `text-red-400`) | Breaks theming, bypasses dark mode, doesn't match the warm monochrome base | Use semantic tokens (`bg-primary`, `text-destructive`) or pastel CSS vars |
| `bg-black/80` overlays | Conflicts with warm canvas | Use `bg-foreground/40 backdrop-blur-[2px]` |
| `shadow-lg`, `shadow-xl` on cards | The aesthetic is borders, not shadows | `border` + `bg-card`; max `shadow-sm` on hover |
| `h-9` on mobile-facing buttons | 36px is below the 44px touch target minimum | `h-11 sm:h-9` everywhere |
| Editing files in `src/components/ui/` | These are shadcn primitives; edits get lost on re-gen | Wrap or extend in a new component |
| `try/catch { console.log }` for fetch errors | User sees nothing | Use `useMutation` with `onError: (err) => toast.error(err.message)` |
| Browser `confirm()` for destructive actions | Looks OS-default, not branded | Use `AlertDialog` with destructive styling |
| Inter, Roboto, Arial, system-ui as primary | Wrong fonts | DM Sans (body), DM Serif Display (display), JetBrains Mono (data) |
| Newsreader, Instrument Serif, Geist | Wrong fonts (these are aspirational only — not installed) | Same as above |
| Purple gradients, glassmorphism, neon | Wrong aesthetic | Warm monochrome + pastel accents only |
| Pill-shaped primary buttons | Wrong aesthetic | `rounded-md` (standard shadcn) |
| AI copy: "Elevate", "Seamless", "Unleash", "Next-Gen" | Generic | Write like a touring musician would |
| Decorative gradients, heavy drop shadows | Wrong aesthetic | Borders and negative space |
| `window.addEventListener('scroll', ...)` for reveal animations | Poor perf, fires hundreds of times | `IntersectionObserver` |
| `transition: all` | Triggers unnecessary layout; janky | Name the exact properties |
| Reaching for `any` as an escape hatch | `tsconfig.app.json` has `strict: true`, `noImplicitAny: true`, `noUnusedLocals`, `noUnusedParameters` — types are enforced | Type it properly. Prefix deliberately unused params with `_` to satisfy the lint rule |
| Inventing new form libraries | Project uses React Hook Form + Zod + shadcn `<Form />` | Stick with the existing stack |

---

## App-Specific Aesthetic (Summary)

This app is **dark-mode-first with a warm-monochrome palette and muted pastel accents**.

### Color principles
- Warm backgrounds, high contrast typography (`30 10% 8%` canvas dark, `40 30% 97%` light)
- Structural borders: `--border` token (light `35 18% 90%`, dark `30 8% 18%`)
- Accent colors: only the four pastel pairs
- Off-black body text, never absolute black; secondary text via `--muted-foreground`

### Typography
- Display: **DM Serif Display** (`font-display`) for hero dates, stat numbers, branding
- Sans: **DM Sans** (`font-sans`) for all UI
- Mono: **JetBrains Mono** (`font-mono`) for times, phones, money, IDs

### Layout
- Asymmetric grids; generous negative space (`space-y-6 sm:space-y-8` between sections)
- Cards: `rounded-lg border`, no heavy shadows
- Generous vertical padding between sections

### What to avoid
- Generic fonts: Inter, Roboto, Arial, system-ui as primary
- Purple gradients, glassmorphism, neon colors
- Pill-shaped large containers or primary buttons
- AI copywriting clichés: "Elevate", "Seamless", "Unleash", "Next-Gen"
- Decorative gradients or heavy drop shadows

### Scroll entry animations

```css
.section {
  opacity: 0;
  transform: translateY(12px);
  animation: fadeInUp 600ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes fadeInUp {
  to { opacity: 1; transform: translateY(0); }
}
```

Use `IntersectionObserver`, never `window.addEventListener('scroll')`.

---

## Self-Audit Before Shipping

Before declaring any new screen or component done, run two checks: the Reduction Filter (a mental model) and the Dimensions pass (a systematic review). The tactical [Review Checklist](#review-checklist) below catches line-item issues; this section catches screen-level problems the checklist misses.

### The Reduction Filter

For every element on the screen, ask:

1. **Can this be removed without losing meaning?** → If yes, remove it. Density is not a virtue unless every element is earning its place.
2. **Would a user need to be told this exists?** → If yes, redesign until it's obvious. A hidden-until-explained element is a UX failure, not a feature.
3. **Does this feel inevitable?** → If it feels like one of several reasonable options, it isn't done. Polish is what moves a component from "adequate" to "the only thing that could have been there."
4. **Is visual weight proportional to functional importance?** → The Settle Show button is the loudest action on a post-show detail page. If a secondary action is drawing the eye first, hierarchy is wrong.

The Reduction Filter is the 30-second gut check. If a new screen passes all four, the Dimensions pass below is where the remaining polish lives.

### Dimensions pass

Run before shipping any new screen. Miss nothing.

| Dimension | Question |
| --- | --- |
| Hierarchy | In 2 seconds, can someone identify the primary action and primary information? |
| Spacing | Vertical rhythm consistent? Related items cluster; unrelated items breathe? |
| Typography | One display face, one sans, one mono — no accidental third voice? |
| Color | Is every color earning its place, or just decorating? |
| Alignment | Every element locked to the grid? Nothing off by 1–2px? |
| Components | Same pattern styled identically across screens (buttons, cards, chips, inputs)? |
| Iconography | All Lucide, one stroke weight, sized consistently? |
| States | Hover, focus, disabled, loading, empty, error — all covered? |
| Density | Anything removable? Anything redundant? |
| Responsiveness | Does the layout degrade gracefully mobile → desktop, or just shrink? |
| Touch targets | Every tappable element ≥ 44×44px on mobile (`h-11 sm:h-9`)? |
| Dark mode | Actually designed, or just inverted? Borders and shadows still readable? |
| Motion | Every animation justified? Anything animating purely because it can? |
| Copy | Specific to what's happening? Free of generic AI tone ("Elevate", "Seamless", whimsy filler)? |

### Phased thinking

When a review surfaces multiple issues, organize fixes into three tiers so work can be paced rather than dumped:

- **Phase 1 — Critical**: Hierarchy, usability, responsiveness, inconsistency issues actively hurting UX. Ship first.
- **Phase 2 — Refinement**: Spacing, typography, color, alignment — the elevation pass.
- **Phase 3 — Polish**: Micro-interactions, empty/loading/error states, subtle details. The final 10% that takes 50% of the time.

Design changes that require functional work (API, data model, new feature) get flagged separately — a design audit stays in the visual layer.

---

## Review Checklist

| Issue | Fix |
| --- | --- |
| `transition: all` | Specify exact properties: `transition: transform 200ms var(--ease-out)` |
| `scale(0)` entry animation | Start from `scale(0.95)` with `opacity: 0` |
| `ease-in` on UI element | Switch to `--ease-out` |
| `transform-origin: center` on popover | Set to trigger location or use Radix CSS variable (modals exempt) |
| Animation on keyboard action | Remove animation entirely |
| Duration > 300ms on UI element | Reduce to 150–250ms |
| Hover animation without media query | Add `@media (hover: hover) and (pointer: fine)` |
| Keyframes on rapidly-triggered element | Use CSS transitions for interruptibility |
| Framer Motion `x`/`y` props under load | Use `transform: "translateX()"` for hardware acceleration |
| Same enter/exit transition speed | Make exit faster than enter |
| Elements all appear at once | Use `.stagger-list` container or `.stagger-item` + `animationDelay` |
| Raw Tailwind color (`bg-red-500`) | Use semantic or pastel token |
| `h-9` button without `sm:` prefix | `h-11 sm:h-9` for touch targets |
| `shadow-lg` on a card | Remove; use `border` |
| Browser `confirm()` | Replace with `AlertDialog` |
| `try/catch` + `console.log` on async action | `useMutation` + `toast.error(err.message)` |
| Editing `src/components/ui/*.tsx` | Extend in a new wrapper component instead |
| Inventing an empty state | Use `EmptyState` component |
| Rolling a custom chip | Use shadcn `Badge` or the pastel chip pattern |

---

## Quick Reference Cheat Sheet

```
BEFORE CODING      purpose? tone? differentiation? restraint check?
                   → if no clear answer, stop and re-read Design Thinking section

BEFORE SHIPPING    reduction filter (removable? obvious? inevitable? weight proportional?)
                   + dimensions pass (hierarchy, spacing, type, color, states, motion, copy)

PALETTE            warm monochrome + 4 pastel pairs
FONTS              display: DM Serif Display | sans: DM Sans | mono: JetBrains Mono
RADIUS             --radius: 0.5rem → rounded-md (buttons, inputs, cards)
                                     rounded-full (chips, status dots, avatars)

TITLE              text-2xl sm:text-3xl tracking-tight
EYEBROW            text-xs uppercase tracking-widest text-muted-foreground font-medium
SECTION LABEL      text-[11px] uppercase tracking-widest text-muted-foreground font-medium
DISPLAY NUMBER     text-3xl font-display leading-none tracking-[-0.03em]
BODY               text-sm (default), text-sm text-muted-foreground (secondary)

BUTTON HEIGHT      h-11 sm:h-9 (touch safe)
BUTTON PRESS       active:scale-[0.97] (baked into Button)
STAGGER            wrap list in .stagger-list (40ms per child)
PAGE ENTRANCE      className="animate-fade-in" on page root

CARD               rounded-lg border bg-card (no shadows)
CLICKABLE CARD     + card-pressable class
PASTEL CHIP        rounded-full + inline style { bg: var(--pastel-X-bg), color: var(--pastel-X-fg) }

DATA FETCH         useQuery; show 3 skeleton rows on loading
MUTATION           onSuccess: invalidate + toast.success
                   onError: toast.error(err.message)
DESTRUCTIVE        AlertDialog, never confirm()
EMPTY STATE        <EmptyState icon title description action />

EASING             --ease-out (default UI)
                   --ease-editorial (page entrance)
                   --ease-in-out (morphs)
                   NEVER ease-in, NEVER ease

DURATION           button press: 160ms | hover: 150ms | stagger: 40ms between
                   page: 220ms | modals: 200-500ms | UI max: 300ms

DEBUG              slow motion (3-5x) → frame-by-frame → real device → next day

DON'T              raw Tailwind colors | shadow-lg | h-9 alone | try/catch+console.log
                   edit src/components/ui/* | browser confirm() | Inter/Roboto/Arial
                   purple gradients | glassmorphism | pill buttons | AI copy clichés
                   animate from scale(0) | transition: all | transform-origin: center on popovers
                   "Herding pixels" / "Teaching robots to dance" / any generic loading whimsy
```
