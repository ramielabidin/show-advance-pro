# Advance — Design System

> Tour management and show advancing, built for independent musicians and their tour managers.

Advance is a **pre-launch tour management web app** (PWA) for tour managers and smaller-budget artists. It helps TMs send day sheets — show schedules and every detail the band needs on show day — and keeps upcoming shows organized in a minimal, editorial UI.

The product is mobile-first, dark-mode-first, and deeply opinionated about craft. Its guiding principles (from the repo `ROADMAP.md`):

- **The UI is the product.** The output (PDFs, emails, Slack) must match in-app quality.
- **Manual is fine, beautiful is mandatory.** Automation is convenience, not the differentiator.
- **Guests are first-class.** Promoters, venue contacts, crew — most users never log in.

### Products represented in this design system

- **Advance web app** — React 18 + TypeScript + Vite + Tailwind + shadcn/Radix. Pages: Dashboard, Shows list, Show detail (aggressively inline-editable), Settings, Auth. This is the *only* product today — the design system reflects a single surface built in depth rather than a multi-product platform.

Sections that would normally exist (marketing site, docs, iOS/Android app) are **out of scope** — Advance is a PWA with no separate marketing site and no native apps today. When those ship, a new UI kit will land under `ui_kits/<product>/`.

---

## Source materials

- **GitHub:** [`ramielabidin/show-advance-pro`](https://github.com/ramielabidin/show-advance-pro) (main). The user has repo access — you likely don't.
  - Tokens lifted from `src/index.css`, `tailwind.config.ts`
  - Philosophy + patterns lifted from `docs/design-system.md` (the canonical in-repo doc)
  - Component idioms from `src/components/{ShowCard,FieldGroup,FieldRow,EmptyState,AppLayout,ui/*}.tsx`
  - Pages referenced for layout: `src/pages/{DashboardPage,ShowsPage,ShowDetailPage,SettingsPage}.tsx`

Nothing is pre-loaded; files were read via the `github_get_tree` / `github_read_file` tools and re-synthesized here.

---

## Index

| File / folder | Purpose |
| --- | --- |
| `README.md` | This file — context, content, visuals, iconography |
| `SKILL.md` | Agent Skill manifest (Claude Code compatible) |
| `colors_and_type.css` | CSS vars for colors, type, motion, radii — drop-in for any mock |
| `assets/` | Logos (SVG), PWA icons, favicon |
| `fonts/` | (not needed — DM Sans, DM Serif Display, JetBrains Mono load from Google Fonts) |
| `preview/` | Design-system cards registered to the Design System tab |
| `ui_kits/app/` | High-fidelity recreation of the Advance web app — components + `index.html` |

### UI kits in this system

- **[`ui_kits/app/`](ui_kits/app/)** — Advance web app (PWA). Dashboard · Shows list · Show detail · Settings. Open `ui_kits/app/index.html` for the interactive prototype.

### Preview cards (Design System tab)

- **Type** — Display, Sans, Mono, Scale
- **Colors** — Canvas (light & dark), Neutrals, Pastel accents, Semantic signals
- **Spacing** — Scale, Radii, Elevation, Motion tokens
- **Components** — Buttons, Chips + dots, Form inputs, Show card, Stat card, Field group, Empty state
- **Brand** — Logo, Brand icons, Iconography

---

## CONTENT FUNDAMENTALS

Tone is the fastest way for an AI-generated mock to give itself away. Advance's voice is narrow and very specific; match it or the work stops feeling on-brand no matter how perfect the colors are.

### Voice

- **Like a touring musician talking to another touring musician.** Casual, direct, operational. Assume the reader has been to three venues this week and has twenty minutes before doors.
- **Neutral address.** Second-person (`"Add a show"`, `"Your next show"`). Never `"I"`. Rarely explicit `"you"` unless addressing the reader directly.
- **Specific, not aspirational.** `"Paste an advance email"` beats `"Streamline your workflow."` Always reference the concrete thing happening.

### Casing

- **Sentence case for everything** — page titles, buttons, menu items. `"Mark as advanced"`, not `"Mark As Advanced"`.
- **ALL CAPS for eyebrows and section labels** — `TOUR`, `SHOWS THIS WEEK`, `SETTINGS`. Always with `tracking-widest` / 0.14em letter-spacing.
- **Proper noun only for the product** — `Advance` is a word used in-context ("advance the show"), so the proper noun lives primarily in the logo/header.

### Punctuation + typography

- **Em dashes (—) over hyphens** in prose. `"Advance — Tour Management"`.
- **Smart quotes**: `"`, `'`.
- **No exclamation marks** except in recoverable error states (e.g. `"That didn't work!"` is too much — prefer `"Couldn't send. Try again."`).
- **Ellipsis for loading**: `"Loading…"` (single character, not three dots).

### Copy examples lifted from the product

| Surface | Actual copy |
| --- | --- |
| Loading the app | `"Loading…"` |
| Dashboard greeting | `"Good morning"` / `"Good afternoon"` / `"Good evening"` (time-aware) |
| Empty field prompt | `"Tap to add hotel address"` (italic, muted) |
| Empty state | `"No upcoming shows. Add a show manually or paste an advance email to get started."` |
| Mutation success | `"Show created"` · `"Saved"` · `"Settled"` |
| Mutation error | The raw error message, via `toast.error(err.message)` — no wrapper copy |
| Badge (unreviewed) | `"New"` |
| Badge (after show) | `"Settled"` |
| Show row action | `"Mark as advanced"` |

### Banned phrases (AI-slop smell test)

Never use these. They instantly read as generated:

- ❌ "Elevate", "Seamless", "Unleash", "Next-Gen", "Supercharge"
- ❌ "Herding pixels", "Teaching robots to dance", "Brewing something special"
- ❌ Generic whimsy in loading copy

Loading copy must reference **what is actually loading**: `"Parsing your advance email"`, `"Pulling this tour's numbers"`. If you can't name the thing, the copy isn't ready.

### Emoji

- **Never.** No emoji anywhere in the product — not in empty states, not in celebration states, not in loading copy. Replaced by Lucide icons + pastel chips.

---

## VISUAL FOUNDATIONS

The aesthetic is **editorial, warm-monochrome, restrained, musician-first**. It reads closer to a design-forward print magazine than a typical SaaS dashboard.

### Color

- **Warm monochrome canvas.** Light mode is `hsl(40 30% 97%)` — a warm off-white. Dark mode is `hsl(30 10% 8%)` — a warm near-black. Never pure `#fff` or `#000`.
- **Off-black body text, never absolute black.** Primary foreground sits at ~12% luminance.
- **Four pastel accent pairs are the entire accent palette**: red (urgent), blue (tour/info), green (settled), yellow (warning). Each has a paired `-bg` and `-fg` token. Purple exists but is reserved and rarely used.
- **Never reach for raw Tailwind colors** (`bg-blue-500`, `text-red-400`). Breaks theming, bypasses dark mode, clashes with the warm canvas.
- **Semantic signal colors** (`--success`, `--warning`, `--badge-new`, `--destructive`) exist for loud, state-carrying UI only — the green "Settle" button, the "New" badge on unreviewed shows, destructive action confirmations.

### Typography

Three families, no exceptions:

- **DM Serif Display** for display: stat numbers, big dates on show cards, the `Advance` wordmark. Tight tracking (`-0.03em`). Used sparingly as punctuation against the sans body.
- **DM Sans** for all UI: body, buttons, labels, page titles. Default font size is `text-sm` (14px); titles are `text-2xl sm:text-3xl tracking-tight`.
- **JetBrains Mono** for data: phone numbers, times, money, IDs, confirmation codes, addresses-as-data. At 13px with slightly heavier weight.

**Never** use Inter, Roboto, Arial, Geist, Newsreader, or system-ui as a primary. They read as generic-AI immediately.

### Layout

- **Borders over shadows.** The default card is `rounded-lg border bg-card` — no shadow. `shadow-sm` appears only on hover for `card-pressable`. `shadow-lg` / `shadow-xl` are banned.
- **Asymmetric grids, generous negative space.** Section gaps are `space-y-6 sm:space-y-8` (24px / 32px). Related items cluster at `space-y-2` or `space-y-3`; form fields `space-y-4`.
- **Container widths are deliberate**: `max-w-3xl` for detail pages, `max-w-5xl` for settings, `max-w-sm` for auth.
- **Corner radii**: `rounded-md` (0.5rem) for buttons / inputs / cards. `rounded-full` for chips / status dots / avatars. Nothing in between.

### Backgrounds + imagery

- **No hero images, no photographic backgrounds, no illustrations.** The product has zero illustrated or photographic content. Every surface is flat warm canvas with borders.
- **No gradients anywhere.** Purple gradients are the single biggest anti-pattern in the repo's design doc.
- **No textures, no grain, no patterns.** The warmth of the off-white is the only "texture."
- **No full-bleed imagery.** Visual interest comes from typography contrast (serif display against sans body), not from color or image.

### Motion

- **Easing** is tokenized — `--ease-out` (default), `--ease-editorial` (page entrance), `--ease-in-out` (morphs), `--ease-drawer` (Vaul). **Never** use raw `ease`, `ease-in`, or `ease-in-out` — they read as weak.
- **Durations** are short: button press 160ms, hover 150ms, dropdowns 150–250ms, page fade-in 220ms, modals 200–500ms. UI max is 300ms.
- **Stagger cascade** for lists: `.stagger-list` utility adds a 40ms delay per child (caps at item 9).
- **Springs** only for gesture-driven motion (pull-to-refresh, drawers). Curve: `cubic-bezier(0.34, 1.56, 0.64, 1)` — subtle overshoot.
- **Reduced motion is respected globally** in `src/index.css` — don't re-implement per component.
- **No animation on keyboard-initiated / 100×-a-day actions.** Toggling advanced, scrolling shows, command-palette — silent.

### States

- **Hover** (desktop only, gated with `@media (hover: hover) and (pointer: fine)`): `translateY(-1px)` lift + `shadow-sm` for `card-pressable`; `bg-accent` for buttons/rows.
- **Press**: `active:scale-[0.97]` at 160ms — baked into the `Button` component. Do not override.
- **Focus**: `ring-2 ring-ring ring-offset-2` — the same everywhere.
- **Disabled**: `opacity-50 pointer-events-none`.
- **Loading**: `Skeleton` (3 rows matching eventual layout) or inline `Loader2` spinner in a disabled button. Never a centered spinner for page loads.

### Borders, dividers, cards

- All borders: `hsl(var(--border))` — `35 18% 90%` light, `30 8% 18%` dark.
- Dividers inside content use `border-border/60` (60% opacity) for a softer feel.
- Card chrome: `rounded-lg border bg-card`. No inner shadow, no outer shadow at rest.
- Dropdown popovers use a one-off soft shadow: `shadow-[0_8px_24px_rgba(0,0,0,0.06)]`.

### Transparency + blur

- Sparing. The top nav is `bg-background/80 backdrop-blur-sm`. Modal backdrop is `bg-foreground/40 backdrop-blur-[2px]` (not `bg-black/80`).
- **No glassmorphism.** Translucent surfaces only when a scroll underlay is literally visible.

### Layout rules

- Mobile gets a fixed bottom tab bar (`Home / Shows / Settings`) + a thin 48px top bar. Desktop gets a sticky 56px top nav, no bottom bar.
- Touch targets `≥ 44×44px` on mobile (`h-11 sm:h-9` pattern).
- Detail pages are `max-w-3xl`; settings is `max-w-5xl`; auth is `max-w-sm` centered.

### Imagery color vibe

- n/a — there is none. When imagery is eventually needed (e.g. venue photos, artist art), it should lean **cool desaturated / warm monochrome**, never saturated tropical. B&W or heavily muted.

---

## ICONOGRAPHY

### System

- **Lucide React** is the sole icon set. 1.5px stroke weight, consistent sizing across the app.
- Common sizes: `h-3 w-3` (10–12px inline), `h-3.5 w-3.5` (14px stat-card icons), `h-4 w-4` (16px default / button icons), `h-5 w-5` (20px mobile nav).
- Color: `text-muted-foreground` for secondary / decorative; `text-foreground` for primary / interactive; pastel `-fg` tokens when paired with a pastel `-bg` background on a stat-card icon tile.

### No custom SVGs, no icon font, no emoji

- There is **no bundled icon sprite or icon font** in the repo — icons are tree-shaken from `lucide-react` at build time.
- Emoji is never used.
- Unicode punctuation (— · ·) appears in text only, never as icons.

### In this design system

- In HTML mocks, load Lucide from CDN:
  ```html
  <script src="https://unpkg.com/lucide@latest"></script>
  <i data-lucide="calendar" class="h-4 w-4"></i>
  ```
  then call `lucide.createIcons()`.
- Or use inline SVG copied from [lucide.dev](https://lucide.dev) — do not hand-draw.

### Icon vocabulary seen across the app

| Lucide name | Use |
| --- | --- |
| `Calendar` | Dashboard / Home tab, date contexts |
| `FileText` | Shows list, day-sheet exports |
| `Settings` | Settings tab |
| `MapPin` | Venue city on show cards |
| `ChevronRight` | Row affordance |
| `Sparkles` | "New" badge |
| `CheckCircle2` | "Settled" badge |
| `Trash2` | Destructive action |
| `Loader2` | Button loading (with `animate-spin`) |
| `Sun` / `Moon` | Theme toggle |
| `LogOut` | Sign out |
| `Mic` | Band row flag in `ScheduleEditor` |

### Logo + brand assets

Stored in `assets/`:
- `logo.svg` — 512×512 stylized serif "A" on a warm-near-black tile (`#221F1C` on `#F9F7F4`). The only distinctive brand mark.
- `favicon.ico`, `apple-touch-icon.png`, `app-icon-192.png`, `app-icon-512.png`, `maskable-icon-512.png` — PWA icon set.

No full-bleed hero imagery, no marketing illustrations, no brand photography exist — Advance is pre-launch and the UI is the brand surface.

---

## FONT SUBSTITUTION NOTE

All three fonts (DM Sans, DM Serif Display, JetBrains Mono) load from Google Fonts via the `@import` at the top of `colors_and_type.css`. **No local font files are bundled** — the production app does the same. If you are working offline or shipping a PDF/Canva export where Google Fonts may not resolve, flag this to the user and request local TTF/WOFF2 files.
