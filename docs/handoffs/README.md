# Design Handoffs

This folder holds design specs for features that are **not yet implemented**. Each subfolder is a self-contained handoff with mocks, references, and a README explaining the design intent.

## Convention

- **Once a handoff ships, delete it.** The implemented code becomes the source of truth. Mocks left around drift and become misleading.
- **One subfolder per feature**, named in `snake_case`.
- **Each subfolder has a `README.md`** that explains the design intent, the problems it solves, and any open questions.
- **No placeholder domains in shipped copy.** Some older mocks reference `advance.fm`; the real domain is `advancetouring.com`. Don't carry the placeholder into production assets.

## Currently parked

- [`invite_email/`](invite_email/) — Tour-invite email (Crew Pass design variant). Parked for when the tour-level invite flow is built. Tracked in `../../ROADMAP.md` Phase 1.
