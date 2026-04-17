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

- Entering/exiting → `ease-out` (starts fast, feels responsive)
- Moving/morphing on screen → `ease-in-out` (natural acceleration/deceleration)
- Hover/color change → `ease`
- Constant motion (marquee, progress bar) → `linear`
- Default → `ease-out`

**Use custom easing curves.** Built-in CSS easings are too weak.

```css
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
```

**Never use `ease-in` for UI animations.** It starts slow, making the interface feel sluggish.

### 4. How fast should it be?

| Element | Duration |
| --- | --- |
| Button press feedback | 100–160ms |
| Tooltips, small popovers | 125–200ms |
| Dropdowns, selects | 150–250ms |
| Modals, drawers | 200–500ms |

**UI animations should stay under 300ms.**

---

## Spring Animations

Springs feel more natural than duration-based animations because they simulate real physics.

**When to use springs:**
- Drag interactions with momentum
- Elements that should feel "alive"
- Gestures that can be interrupted mid-animation

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

**Spring configuration:**

```js
// Apple's approach (easier to reason about)
{ type: "spring", duration: 0.5, bounce: 0.2 }

// Traditional physics (more control)
{ type: "spring", mass: 1, stiffness: 100, damping: 10 }
```

Keep bounce subtle (0.1–0.3). Avoid bounce in most UI contexts.

---

## Component Building Principles

### Buttons must feel responsive

```css
.button {
  transition: transform 160ms ease-out;
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

Popovers should scale from their trigger, not from center. **Exception: modals** stay `transform-origin: center`.

```css
.popover {
  transform-origin: var(--radix-popover-content-transform-origin);
}
```

### Tooltips: skip delay on subsequent hovers

Once one tooltip is open, hovering adjacent tooltips should open them instantly.

```css
.tooltip[data-instant] {
  transition-duration: 0ms;
}
```

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

- **Momentum-based dismissal**: check velocity (`distance / time > 0.11`), not just distance
- **Damping at boundaries**: slow movement past natural limits, don't hard stop
- **Pointer capture**: capture all pointer events once drag starts
- **Multi-touch protection**: ignore additional touch points after drag begins
- **Friction instead of hard stops**: allow overscroll with increasing resistance

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

Reduced motion means fewer and gentler animations, not zero. Keep opacity/color transitions; remove movement animations.

```css
@media (prefers-reduced-motion: reduce) {
  .element {
    animation: fade 0.2s ease;
  }
}
```

### Touch device hover states

```css
@media (hover: hover) and (pointer: fine) {
  .element:hover {
    transform: scale(1.05);
  }
}
```

---

## Stagger Animations

```css
.item {
  opacity: 0;
  transform: translateY(8px);
  animation: fadeIn 300ms ease-out forwards;
  animation-delay: calc(var(--index) * 50ms);
}

@keyframes fadeIn {
  to { opacity: 1; transform: translateY(0); }
}
```

Keep stagger delays short (30–80ms). Never block interaction while stagger plays.

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

## Review Checklist

| Issue | Fix |
| --- | --- |
| `transition: all` | Specify exact properties: `transition: transform 200ms ease-out` |
| `scale(0)` entry animation | Start from `scale(0.95)` with `opacity: 0` |
| `ease-in` on UI element | Switch to `ease-out` or custom curve |
| `transform-origin: center` on popover | Set to trigger location or use Radix CSS variable (modals exempt) |
| Animation on keyboard action | Remove animation entirely |
| Duration > 300ms on UI element | Reduce to 150–250ms |
| Hover animation without media query | Add `@media (hover: hover) and (pointer: fine)` |
| Keyframes on rapidly-triggered element | Use CSS transitions for interruptibility |
| Framer Motion `x`/`y` props under load | Use `transform: "translateX()"` for hardware acceleration |
| Same enter/exit transition speed | Make exit faster than enter |
| Elements all appear at once | Add stagger delay (30–80ms between items) |

---

## App-Specific Aesthetic

This app uses a **dark-mode-first** aesthetic with light-mode support.

### Color principles
- Dark backgrounds, high contrast typography
- Warm monochrome palette for light mode: off-white `#F7F6F3` / `#FBFBFA` canvas
- Structural borders: `1px solid #EAEAEA` (light) or equivalent dark-mode token
- Accent colors: highly desaturated muted pastels only

### Typography
- Editorial serif for hero/display headings: `'Newsreader'`, `'Instrument Serif'`, or similar
- Clean geometric sans for UI: `'Geist Sans'`, `'SF Pro Display'`, `'Helvetica Neue'`
- Monospace for code/meta: `'Geist Mono'`, `'JetBrains Mono'`
- Off-black body text (`#111111`), never absolute black; secondary text `#787774`

### Layout
- Asymmetric bento-grid layouts; generous negative space
- Cards: `border-radius: 8px–12px`, no heavy shadows (max `0 2px 8px rgba(0,0,0,0.04)`)
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
