---
name: advance-design
description: Use this skill to generate well-branded interfaces and assets for Advance (tour management app for tour managers and smaller artists), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the `README.md` file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. Link `colors_and_type.css` directly and pull Lucide from CDN for icons. Use the components in `ui_kits/app/` as a pattern library — their JSX is deliberately simple and CSS-var-driven, easy to port.

If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand. Source tokens and idioms come from `ramielabidin/show-advance-pro` → `src/index.css`, `tailwind.config.ts`, `docs/design-system.md`.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Critical rules (don't drift)

- **Warm monochrome only.** Canvas is `hsl(40 30% 97%)` (light) / `hsl(30 10% 8%)` (dark). Never pure white or black.
- **Pastels are the only accent palette.** `--pastel-{red,blue,green,yellow}-{bg,fg}`. Never reach for raw `blue-500`.
- **Three fonts, no substitutes.** DM Serif Display (display), DM Sans (UI), JetBrains Mono (data).
- **Borders over shadows.** Cards are `border bg-card` at rest. Shadows only on hover or popovers.
- **Lucide icons only.** 1.5px stroke. No emoji anywhere.
- **No gradients, no hero images, no illustrations.** The UI is the brand surface.
- **Sentence case for all UI copy.** ALL CAPS only for eyebrow labels with wide letter-spacing.
- **Voice:** like a tour manager talking to another tour manager. Specific, not aspirational.
