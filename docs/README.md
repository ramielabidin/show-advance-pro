# Advance — Documentation

This folder is the knowledge base for the Advance app. It is the canonical place for:

- **Product & company knowledge** — what Advance is, who it serves, how we think about it (`product/`)
- **Design system** — the visual language and component conventions (`design-system.md`)
- **Design handoffs** — design specs parked here while the corresponding feature is in flight or pending implementation (`handoffs/`)

## Layout

```
docs/
  design-system.md     # Canonical UI reference — read before any frontend change
  product/             # Company + platform knowledge base
    overview.md          # Mission, target customer, principles, current phase
    platform.md          # Surfaces, vocabulary, key concepts
    pricing.md           # Tiers and rationale (subject to change pre-launch)
  handoffs/            # Design handoffs awaiting implementation
    invite_email/        # Tour-invite email (Crew Pass variant), parked for Phase 2
```

## Conventions

- **Once a handoff ships, delete it.** The implemented code becomes the source of truth; mocks drift and become misleading. Do not let the `handoffs/` folder accumulate shipped specs.
- **`design-system.md` lives at this exact path** — `CLAUDE.md` and the `advance-design` skill both reference it. Don't move it without updating those references.
- **Pricing is subject to change** until launch. Treat `product/pricing.md` as a planning artifact, not a contract.

## Related

- `../CLAUDE.md` — repo-level engineering context for Claude Code
- `../ROADMAP.md` — product direction, phases, and acceptance criteria
- `../.claude/skills/advance-design/` — agent skill with brand tokens and UI kit
