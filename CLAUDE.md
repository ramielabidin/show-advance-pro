# CLAUDE.md

## UI & Design

When making any frontend changes — components, pages, modals, layouts, styling — read and follow `docs/design-system.md` before writing any code.

For logic-only changes (edge functions, migrations, Supabase queries, API routes, utility functions, type definitions), skip the design system doc entirely.

The app uses a dark-mode-first aesthetic (light-mode is also available). Key principles:
- Dark backgrounds, high contrast typography
- Minimal, utilitarian UI — no decorative gradients or heavy shadows
- Smooth, intentional micro-animations (not gratuitous)
- Every user-facing detail should feel considered
