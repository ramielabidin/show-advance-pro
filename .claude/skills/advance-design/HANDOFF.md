# Handoff: Apply the Advance Design System

## The short version

Everything Claude Code needs is already written — this folder **is** an Agent Skill.

```
.claude/skills/advance-design/   ← drop this folder here
  SKILL.md                        ← already has the frontmatter Claude Code looks for
  README.md                       ← the design-system bible
  colors_and_type.css             ← drop-in CSS variables
  assets/                         ← logo, PWA icons
  preview/                        ← visual reference cards (one per token/component)
  ui_kits/app/                    ← HTML+JSX recreation of the app
```

When Claude Code starts in your repo, it auto-discovers skills under `.claude/skills/`. Tell it `"Use the advance-design skill"` (or just ask it to do design work — the `user-invocable` flag means it'll pick the skill up on its own).

---

## About the design files

The files in this bundle are **design references created in HTML** — prototypes showing intended look and behavior, not production code to copy directly. The task is to **apply these designs in your existing React + TypeScript + Vite + Tailwind + shadcn codebase** (`show-advance-pro`), using the patterns and libraries that are already there.

You already have:
- The same CSS variables wired into `src/index.css`
- The same Tailwind tokens in `tailwind.config.ts`
- shadcn/Radix primitives that map 1:1 to the `Primitives.jsx` in `ui_kits/app/`
- Lucide React — same icon set the mocks use via CDN

So this handoff is **not** a greenfield build. It is a **conformance + filling-the-gaps pass** against an existing codebase that is already ~80% on-brand.

---

## Fidelity

**High-fidelity.** Colors, type, spacing, radii, motion tokens, and component layouts are pixel-accurate to the codebase's own `docs/design-system.md`. The HTML/JSX in `ui_kits/app/` is cosmetic-only (no Supabase, no auth, no real mutations) — port the *look* and *interaction patterns*, keep the real data plumbing that already works.

---

## How to use this in Claude Code

### Option 1 (recommended): drop as a skill

From the repo root of `show-advance-pro`:

```bash
mkdir -p .claude/skills
cp -R /path/to/this/bundle .claude/skills/advance-design
```

Then in Claude Code:

> Use the advance-design skill. Go through `src/components/` and flag any component that drifts from the design system — wrong typography family, raw Tailwind colors, shadows on cards at rest, etc. Then fix them one at a time, asking me to review each.

### Option 2: project-level CLAUDE.md reference

If you'd rather not commit a skill folder, copy `README.md` and `SKILL.md` to `docs/design-system-reference.md` and add to your `CLAUDE.md`:

```
When doing design/UI work, read docs/design-system-reference.md and docs/design-system.md first.
The CSS variables in src/index.css are authoritative — never introduce raw Tailwind colors.
```

---

## Starter tasks for Claude Code

Give it one of these as a first prompt after installing the skill:

1. **"Audit `src/components/` against `.claude/skills/advance-design/README.md`. List every component that violates the Visual Foundations or Content Fundamentals sections. Don't fix anything yet — just produce the audit as a markdown table."**

2. **"Look at `.claude/skills/advance-design/ui_kits/app/ShowDetail.jsx` and compare it to `src/pages/ShowDetailPage.tsx`. What's missing from the real page that the mock has? Propose a plan."**

3. **"Using the `Dashboard.jsx` mock as a reference, refactor `src/pages/DashboardPage.tsx` so the stat tiles, 'Next show' hero, and 'This week' list match. Use existing `src/components/ShowCard.tsx` and shadcn primitives — do not copy the mock's inline styles."**

---

## Design tokens (authoritative)

All tokens live in `colors_and_type.css`. The ones you'll reach for constantly:

| Token | Value | Use |
| --- | --- | --- |
| `--background` | `40 30% 97%` / dark `30 10% 8%` | page canvas |
| `--foreground` | `30 15% 12%` / dark `40 15% 95%` | body text |
| `--muted-foreground` | `30 8% 40%` / dark `35 10% 65%` | secondary text |
| `--border` | `35 18% 90%` / dark `30 8% 18%` | all borders |
| `--pastel-{blue,green,yellow,red}-{bg,fg}` | warm pastels | chips, stat-card icon tiles |
| `--font-sans` | `"DM Sans"` | UI |
| `--font-display` | `"DM Serif Display"` | stat numbers, dates, logo |
| `--font-mono` | `"JetBrains Mono"` | data (phone, time, money) |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | default transitions |

Full list in `colors_and_type.css` — all already exist in your `src/index.css`.

---

## The things to watch for (top drift risks)

From the README's Visual Foundations, these are the issues most likely to sneak in as the codebase grows:

1. **Raw Tailwind colors** — `bg-blue-500`, `text-red-400`. Ban these.
2. **Shadows on cards at rest** — only on hover of `card-pressable` and on popovers.
3. **Non-tokenized easing** — `transition ease-in-out` in plain Tailwind. Must be `--ease-out` etc.
4. **Emoji in UI copy** — never.
5. **Sentence case violations** — `"Mark As Advanced"` → `"Mark as advanced"`.
6. **System-ui or Inter fallback** creeping into stat numbers — must be DM Serif Display.
7. **Missing `tracking-widest` / `uppercase` on eyebrows** — they must read as editorial labels.

---

## Files in this bundle

```
README.md                   design-system bible (tone, visual, iconography)
SKILL.md                    Agent Skill frontmatter + invocation rules
colors_and_type.css         CSS variables (drop-in reference)
assets/logo.svg             brand mark
assets/app-icon-*.png       PWA icons
assets/apple-touch-icon.png
preview/*.html              one visual reference card per token/component
ui_kits/app/                HTML+JSX recreation of the app
  index.html                interactive prototype entry
  App.jsx                   root + fake data
  AppChrome.jsx             top nav
  Dashboard.jsx             home page
  ShowsList.jsx             shows index
  ShowDetail.jsx            inline-editable show page
  Settings.jsx              settings with tabs
  Primitives.jsx            Button, Card, Chip, Dot, StatTile, FieldRow…
  README.md                 per-kit notes
HANDOFF.md                  this file
```

---

## Questions to answer before Claude Code starts

- Do you want this committed to the repo (`.claude/skills/advance-design/` in git) so your whole team picks it up, or kept local?
- Should the audit-and-fix work land as one big PR or one PR per drift category? (I'd suggest one per category — colors, typography, motion — so review stays tractable.)
- Are there components in the mocks (`StatTile`, `Eyebrow`, `SectionLabel`) that you'd want pulled into `src/components/` as first-class primitives? Some of them aren't in the repo yet.
