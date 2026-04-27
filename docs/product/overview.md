# Advance — Product Overview

## What it is

**Advance** is tour management software built by a touring musician, priced for touring musicians. It replaces the spreadsheet + group chat + email stack that most independent bands use to run tours, with a single sleek app that handles day sheets, show schedules, and tour communication end-to-end.

**Production domain:** `advancetouring.com` (app at `app.advancetouring.com`). Some older design mocks reference `advance.fm` — that is a placeholder and must not appear in shipped copy, emails, or UI.

## Positioning

Modern tour management for independent artists. Cheaper, faster, and sleeker than Master Tour or Prism — built for the smaller acts those tools either price out or overwhelm.

## Target customer

Tour managers, band members, and small management companies handling independent and mid-size touring artists. Not enterprise. Not headliner-tier acts with a dedicated production office.

## Product principles

These inform every decision downstream. When in doubt, refer back here.

1. **The UI is the product.** Advance's primary moat is that it is genuinely nice to use. Every screen, export, email, and notification must reflect this. If the outputs look worse than the app, the product's perceived quality suffers with everyone who isn't the tour manager.
2. **Manual is fine. Beautiful is mandatory.** Automation is a convenience, not a core differentiator. A sleek manual workflow beats a clunky automated one.
3. **Guests are first-class.** Most people who interact with tour data (promoters, venue contacts, show-day crew) will never log in. Magic-link guest access and great transactional emails are how the product spreads.
4. **Pricing stays honest.** The product is priced for working musicians, not enterprise buyers. "Starting at $19" is a headline.
5. **No anti-exploit logic on edits.** Deleting a show does not return a tier slot; editing a show does not affect any counter. Don't build validation that makes legitimate edits (reschedules, routing changes) feel hostile.

## Current phase

**Pre-launch, hardening core functionality.** A working single-tenant tool (one team, one artist, one set of crew) being turned into a SaaS product. Multi-tenancy, billing, and role-based access control are planned but not yet built.

What this means day to day:

- **Prioritize core feature quality** — show advancing, day sheets, tour management, exports.
- **Don't build scaffolding for unshipped tiers.** No free-tier gating, per-tier feature flags, artist switchers, or RBAC checks unless the task explicitly calls for them.
- **Do shape new data so future tiers slot in.** When adding tables/columns, mirror the existing `team_id` + RLS pattern so the planned `account` / `artist` / `account_artist` model can land without a migration marathon.
- **Roles today are `owner` / `member`** on `team_members`. The Admin / Crew / Artist / Guest model is future state.

See `../../ROADMAP.md` for full phase breakdown and acceptance criteria.
