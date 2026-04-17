# Advance — Product Roadmap

**Last updated:** April 17, 2026
**Owner:** Founder
**Status:** Pre-launch, transitioning from personal tool to SaaS product

---

## Vision

Advance is tour management software built by a touring musician, priced for touring musicians. It replaces the spreadsheet + group chat + email stack that most independent bands use to run tours, with a single sleek app that handles day sheets, show schedules, and tour communication end-to-end.

**Positioning:** Modern tour management for independent artists. Cheaper, faster, and sleeker than Master Tour or Prism — built for smaller acts that those tools price out or overwhelm.

**Target customer:** Tour managers, band members, and small management companies handling independent and mid-size touring artists.

---

## Product principles

These inform every decision downstream. When in doubt, refer back here.

1. **The UI is the product.** Advance's primary moat is that it is genuinely nice to use. Every screen, export, email, and notification must reflect this. If the outputs look worse than the app, the product's perceived quality suffers with everyone who isn't the tour manager.
2. **Manual is fine. Beautiful is mandatory.** Automation is a convenience, not a core differentiator. A sleek manual workflow beats a clunky automated one.
3. **Guests are first-class.** Most people who interact with tour data (promoters, venue contacts, show-day crew) will never log in. Magic-link guest access and great transactional emails are how the product spreads.
4. **Pricing stays honest.** The product is priced for working musicians, not enterprise buyers. "Starting at $19" is a headline.

---

## Pricing model (planned)

| Tier | Price | Artists | Shows / Tours | Users | Guests | Notes |
|---|---|---|---|---|---|---|
| **Free** | $0 | 1 | 30 shows lifetime, unlimited tours | 3 | Unlimited | Full product access. No credit card. Automations and email forwarding included. |
| **Artist** | $19/mo ($190/yr) | 1 | Unlimited tours & shows | 10 | Unlimited | Everything unlocked. |
| **Manager** | $45/mo ($450/yr) | Up to 5 | Unlimited tours & shows | 25 | Unlimited | Multi-artist dashboard with artist switcher. |
| **Agency** | Custom | 15+ | — | — | — | Future tier. "Contact us" link on pricing page until demand validates. |

**Free tier rationale:** Hard 30-show lifetime cap on the account. Count increments on show creation and never decrements — deleting a show does not return a slot, and editing a show does not affect the count. Unlimited tours within that cap. Forces upgrade at the moment of highest perceived value: when the user has run a successful tour and wants to create their 31st show.

**Why no anti-exploit logic on edits:** A sophisticated user could theoretically create 30 shows, complete a tour, then overwrite every field (venue, address, date, contacts, specs, etc.) for future tours. We do not build against this. The exploit requires hours of manual data re-entry per tour to save $19/month — if a user's time is worth that little, they are not a customer we are losing. Designing around adversarial edge cases would punish the 99.9% of users who legitimately edit shows (reschedules, routing changes, date swaps) and make the product feel hostile. If the exploit appears in real usage data, address it then.

**Implementation note:** Track `shows_created_count` as an integer on the `account` table, incremented via a Postgres trigger on `show` insert. Check this counter on the create endpoint; if `>= 30` and tier is free, return upgrade-required error with a clean modal. Show a live counter in the app UI ("24 of 30 shows used on your free plan") so users always know where they stand. For the rare case of an accidental creation early on, handle as a manual support reset via an admin action — do not build user-facing reset logic.

**Annual discount:** ~17% (two months free). Show monthly by default on pricing page with annual toggle.

---

## Roles & permissions

| Role | Capabilities |
|---|---|
| **Admin / Manager** | Full edit access. Billing, settings, user management, artist switching. |
| **Crew** | Edit within their domain (FOH edits tech specs, TM edits schedule, etc). Cannot touch billing or delete tours. |
| **Artist / Band member** | Read-only on all tour data. Can edit their own guest list. Can RSVP to day sheets. |
| **Guest** | Magic-link view access to a single tour or single show. No login required. For promoters, venue contacts, day-of crew. |

---

## Phase 1 — Output quality pass (pre-launch)

**Goal:** Everything that leaves the app looks as good as what's inside it.

**Why first:** The marketing site will feature screenshots of day sheets, PDF exports, and Slack notifications. These need to be launch-ready before the marketing site is built, or the site undercuts its own message about UI quality.

**Tasks:**
- [ ] Design and implement custom HTML email templates via SendGrid
  - Match app's type system, color palette, spacing
  - Templates needed: day sheet, tour invite, show update, guest list confirmation
  - Test across Gmail, Apple Mail, Outlook, iOS Mail
- [ ] Redesign PDF exports to match app UI
  - Same fonts, spacing, restraint
  - Day sheet PDF is highest priority — this is what gets printed and taped to dressing room doors
  - Tour schedule / routing PDF second
- [ ] Polish Slack notifications with Block Kit
  - Current emoji-based format is acceptable; upgrade to headers, dividers, fields
  - Low priority — do not block launch

**Acceptance criteria:** A crew member receiving an Advance day sheet email for the first time should feel the product's quality as strongly as the TM does using the app.

---

## Phase 2 — Multi-tenancy & billing foundation

**Goal:** Scope data model and infrastructure to support paid accounts, multiple artists per account, and tier-based feature gating.

**Tasks:**
- [ ] Data model: add `account`, `artist`, and `account_artist` tables. Scope all tour data to artist, all billing to account.
- [ ] Artist switcher UI for Manager tier (dropdown in top nav, scoped views)
- [ ] Stripe integration
  - Products for Artist and Manager tiers, monthly and annual
  - Checkout flow
  - Customer portal for plan changes / cancellation
  - Webhook handler → updates `subscription_status` on account record
- [ ] Supabase RLS policies to enforce tier limits and artist scoping
- [ ] Tier enforcement logic
  - 30-show lifetime cap on free tier via `shows_created_count` integer on `account` table, incremented by Postgres trigger on show insert. Never decrements.
  - User count limits per tier
  - Artist count limits per tier
  - Live usage counter in app UI so free-tier users can see where they stand
- [ ] Role-based access control (Admin / Crew / Artist / Guest)
- [ ] Magic-link guest access flow

**Acceptance criteria:** A free-tier user hits the 30-show cap and sees a clear upgrade prompt. A Manager-tier user can switch between up to 5 artists cleanly. Billing works end-to-end including upgrades, downgrades, and cancellation.

---

## Phase 3 — Marketing site

**Goal:** `www.advancetouring.com` — a static marketing site that converts visitors into free-tier signups.

**Architecture:**
- Separate repo / deploy from the app
- Shared design tokens package (colors, typography, spacing) imported by both
- Static site generator (Next.js static export, Astro, or similar)
- Sign-up CTA hands off to `app.advancetouring.com` for account creation

**Page structure:**
1. **Hero** — Headline: "Modern tour management for independent artists." Subhead: "Everything a tour needs. Nothing it doesn't." CTA button. Hero product screenshot (likely the schedule/routing view as the most visually striking).
2. **Feature sections** — day sheets & automated distribution, show schedule / routing / calendar, email forwarding / communication hub. Each with a large screenshot or short demo.
3. **Founder note** — light "built by a touring musician" touch, short paragraph, no photo unless it converts well later
4. **Pricing** — three tiers (Free / Artist / Manager), monthly/annual toggle, Agency "contact us" link
5. **FAQ** — addresses churn concerns (what happens after my tour? can I pause? what if I only tour once a year?), feature questions, comparison to Master Tour
6. **Footer** — links, socials, contact, "Everything a tour needs. Nothing it doesn't." as tagline

**Tasks:**
- [ ] Extract design tokens from app into shared package
- [ ] Scaffold marketing site repo
- [ ] Write copy (separate doc, iterate before building)
- [ ] Design page (mockups before code)
- [ ] Build
- [ ] Analytics (Plausible or similar — privacy-respecting)
- [ ] SEO basics (meta tags, OG images, sitemap)
- [ ] Waitlist signup form for pre-launch email capture
- [ ] Deploy to `www.advancetouring.com` with root domain redirect

**Acceptance criteria:** A tour manager who has never heard of Advance lands on the homepage, understands what it is within 5 seconds, and can sign up for the free tier within 30 seconds.

---

## Phase 4 — Launch

**Goal:** Get the first 100 paying customers.

**Sequencing:**
1. **Soft launch** — personal network first. Your own band, bands you've toured with, managers you know. Target: 10 paying customers, 20+ free-tier signups. Gather feedback aggressively, fix what breaks.
2. **Public launch** — Product Hunt, r/WeAreTheMusicMakers (thoughtfully, not spammy), music industry newsletters (Hypebot, Music Ally, CelebrityAccess), relevant Discord/Slack communities for tour managers.
3. **Word-of-mouth loop** — every guest who receives a day sheet email sees "Sent with Advance" footer link. Measure click-through and signup rate from this channel.

**Tasks:**
- [ ] Competitor research pass — Master Tour, Prism, Muzeek, Tour Manager Pro, Roadbook. Document pricing, features, complaints from Reddit/forums.
- [ ] Prepare soft launch email template for personal network
- [ ] Set up customer support — intercom or a help@ email address, status page
- [ ] Draft Product Hunt launch assets (gallery, tagline, first comment)
- [ ] Write launch blog post / founder note
- [ ] Add "Sent with Advance" footer to all outbound emails (free tier only)

**Acceptance criteria:** First 10 paying customers acquired. Onboarding friction documented and reduced based on real usage.

---

## Phase 5 — Post-launch iteration

**Goal:** Compound early wins. Build what customers actually ask for, not what you assumed they'd want.

**Candidate work (not prioritized — let customer feedback decide):**
- Automation polish: scheduled day sheet distribution, email forwarding refinements
- Per-tour one-time pricing ($49 for a single tour) if churn data shows bands tour seasonally
- Agency tier launch if 3+ management companies request it
- Mobile app or PWA polish if usage data shows mobile-heavy access
- Integrations customers ask for (Google Calendar sync, Dropbox for rider storage, accounting exports)
- Referral program if word-of-mouth is the dominant acquisition channel

---

## Known open questions

- **Per-tour pricing.** Worth offering at launch or wait for churn data? Leaning: wait.
- **Competitor pricing.** Need to verify current Master Tour, Prism, Muzeek pricing to make sure positioning claims hold up.
- **Founder story prominence.** Light touch at launch — short founder note further down the homepage, fuller story on About page. Room to dial up later if it converts.

---

## Related docs

- `CLAUDE.md` — repo-level context for Claude Code
- Marketing copy doc (TBD)
- Design tokens package (TBD, Phase 3)
