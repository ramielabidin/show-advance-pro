# Advance — Pricing

> **Subject to change.** Pricing is pre-launch and unconfirmed. Treat this as a planning artifact, not a contract. The source of truth for tier-by-tier acceptance criteria is `../../ROADMAP.md` (Phase 2).

## Planned tiers

| Tier | Price | Artists | Shows / Tours | Users | Guests | Notes |
|---|---|---|---|---|---|---|
| **Free** | $0 | 1 | 30 shows lifetime, unlimited tours | 3 | Unlimited | Full product access. No credit card. Automations and email forwarding included. |
| **Artist** | $19/mo ($190/yr) | 1 | Unlimited tours & shows | 10 | Unlimited | Everything unlocked. |
| **Manager** | $45/mo ($450/yr) | Up to 5 | Unlimited tours & shows | 25 | Unlimited | Multi-artist dashboard with artist switcher. |
| **Agency** | Custom | 15+ | — | — | — | Future tier. "Contact us" link on pricing page until demand validates. |

**Annual discount:** ~17% (two months free). Show monthly by default on pricing page with annual toggle.

## Free-tier rationale

Hard 30-show lifetime cap on the account. The counter increments on show creation and **never decrements** — deleting a show does not return a slot, and editing a show does not affect the count. Unlimited tours within that cap.

This forces an upgrade decision at the moment of highest perceived value: when the user has just run a successful tour and wants to create their 31st show.

## Why no anti-exploit logic on edits

A sophisticated user could theoretically create 30 shows, complete a tour, then overwrite every field (venue, address, date, contacts, specs, etc.) for future tours. **We do not build against this.**

The exploit requires hours of manual data re-entry per tour to save $19/month. If a user's time is worth that little, they are not a customer we are losing. Designing around adversarial edge cases would punish the 99.9% of users who legitimately edit shows — reschedules, routing changes, date swaps — and make the product feel hostile.

If the exploit shows up in real usage data, address it then. Until then: ship clean edit UX.

## Implementation notes (for Phase 2)

- Track `shows_created_count` as an integer on the `account` table, incremented via a Postgres trigger on `show` insert.
- Check the counter on the create endpoint; if `>= 30` and tier is free, return an upgrade-required error with a clean modal.
- Show a live counter in the app UI ("24 of 30 shows used on your free plan") so users always know where they stand.
- For the rare case of an accidental creation early on, handle as a manual support reset via an admin action — do not build user-facing reset logic.

## Open questions

- **Per-tour pricing.** $49 for a single tour? Worth offering at launch or wait for churn data? Leaning: wait.
- **Competitor verification.** Need to confirm current Master Tour, Prism, Muzeek pricing to make sure positioning claims hold up.
- **Agency tier.** Launch only if 3+ management companies request it post-launch.
