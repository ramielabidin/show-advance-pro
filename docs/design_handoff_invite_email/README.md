# Handoff: Advance team-invite transactional email

## Overview

Transactional email sent when an existing Advance user invites someone to join their tour/team. The recipient may or may not have an account yet — the CTA routes to a sign-in-or-create-account flow, which then lands on the in-app accepted state.

Two approved design directions are included:

- **B · Crew pass** — a credential/pass metaphor (split-stub layout, monospace data, dark stub)
- **C · Dispatch** — a minimal typographic "letter from the road" (hairline data rows, dominant serif headline)

Also included: the **post-click landing state** shown inside the web app once the invite is accepted.

---

## About the design files

The HTML files in `emails/` are **design references**, not production-ready artifacts to ship as-is. They were authored as render-accurate, email-safe HTML (table layout, inline styles, VML Outlook fallback) so the visual target is unambiguous — but the implementation in your codebase should follow your team's existing email-template infrastructure (e.g. MJML, Maizzle, react-email, Postmark templates, etc.).

Goal: **recreate these designs in the target environment** using its patterns and tooling. If no email infrastructure exists yet, pick the most appropriate one for the stack — `react-email` is a strong default for a React/TypeScript codebase like `show-advance-pro`.

The `accepted-landing.html` mock is an in-app view; it should be recreated in the app's existing React + Tailwind + shadcn environment following `src/components/ui/*` and page patterns already in the repo.

## Fidelity

**High-fidelity.** Colors, type, spacing, and copy are final. The developer should match them pixel-closely, adapting only where email-client constraints or the target codebase's patterns require it.

---

## Deliverables

Three artifacts:

| # | File | What it is | Target |
|---|------|-----------|--------|
| 1 | `emails/invite-pass.html` | Variant B — "Crew pass" invite | Transactional email |
| 2 | `emails/invite-dispatch.html` | Variant C — "Dispatch" invite | Transactional email |
| 3 | `emails/accepted-landing.html` | Post-click accepted state | In-app web view (React) |

Product owner will pick one of B/C to ship; build both templates so they can A/B.

---

## Shared design tokens

These map 1:1 to `src/index.css` in `show-advance-pro`. Use the existing CSS variables in the web app; inline the hex values in email HTML (email clients don't resolve CSS vars).

### Colors (light mode — emails ship light only)

| Token | Hex | Use |
|---|---|---|
| `--background` | `#f4efe6` (hsl 40 30% 97% warmed) | Outer email canvas |
| `--card` | `#fbf8f2` | Card/surface inside the email |
| `--foreground` | `#1f1d1a` | Primary text, button fill |
| `--foreground` (body) | `#2a2824` | Body paragraphs (slightly softer) |
| `--muted-foreground` | `#8b8375` | Secondary text, labels |
| `--border` | `#e5dfd2` | Hairline rules, card borders |
| `--primary-foreground` | `#f9f7f4` | Text on dark button |
| `--pastel-blue-bg` | `#e1f3fe` | Inbox avatar bg (preview only) |
| `--pastel-blue-fg` | `#1f6c9f` | Inbox avatar fg (preview only) |
| Pass stub (dark) | `#1f1d1a` | Variant B left-stub background |
| Pass stub fg | `#f9f7f4` | Variant B left-stub text |
| Pass stub muted | `#a39a8c` | Variant B left-stub secondary text |
| Pass stub divider | `#8b8375` | Variant B dashed divider between stub + main |

### Typography

All three families load from Google Fonts:

```
https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Serif+Display&family=JetBrains+Mono:wght@400;500;600&display=swap
```

| Family | Weight | Use | Fallback |
|---|---|---|---|
| `DM Serif Display` | 400 | Headlines, product wordmark, eyebrow stat | `Georgia, 'Times New Roman', serif` |
| `DM Sans` | 400 / 500 / 600 | Body, buttons, labels | `-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif` |
| `JetBrains Mono` | 400 / 500 | Dates, routes, IDs, URLs, eyebrows | `ui-monospace, Menlo, Consolas, monospace` |

Never substitute Inter, Roboto, system-ui, Newsreader, or Arial as the *primary* family — use only as inline fallbacks.

### Spacing / radii

- Card radius: `14px` (variant B outer) / `10px` (inner tour card in A-style if needed) / `4px` (variant B "pass")
- Button radius: `24–26px` (pill, matches the app's rounded-full chip aesthetic on interactive pills)
- Card padding desktop: `40–48px` horizontal, `28–40px` vertical
- Card padding mobile (≤620px): `22–26px` horizontal
- Max email width: `520px` (variant C), `580px` (variant B)

### Iconography

Neither email uses icons in its approved form. The landing state uses Lucide (`check` inside a circle, and an arrow). Use `lucide-react` in the web app — it's already the repo's icon set.

---

## Variant B — "Crew pass"

**File:** `emails/invite-pass.html`

### Concept

The email renders as a single "pass" object — split into a dark vertical **stub** on the left (pass-holder info, access level, date range) and a lighter **main panel** on the right (team name, body, CTA). A dashed vertical rule divides them, echoing a tear-away concert pass. On mobile, the two columns stack vertically with a dashed horizontal rule between them.

### Layout structure (desktop, max-width 580px)

```
┌─ preheader (hidden inbox preview) ─────────────────────┐
├─ top slug line ────────────────────────────────────────┤
│  [— Advance / Crew pass —]          [No. A7K-2P9]      │
├─ pass (border: 1px solid #1f1d1a, radius: 4px) ────────┤
│  ┌──────── stub (170px) ──┬── main (flex) ───────────┐ │
│  │ #1f1d1a bg             │ #fbf8f2 bg               │ │
│  │                        │                           │ │
│  │ ACCESS                 │ [HOLD FOR CLAIM]  [time] │ │
│  │ Crew (serif 44px)      │                           │ │
│  │ 14 shows               │ TEAM                      │ │
│  │ Apr 28                 │ Midwest Run               │ │
│  │ May 18                 │ Spring 26  (serif 30px)  │ │
│  │                        │                           │ │
│  │                        │ body paragraph (15px)     │ │
│  │ ──────────             │                           │ │
│  │ ISSUED BY              │ ─── 1px rule ───          │ │
│  │ Maya Okafor            │                           │ │
│  │ maya@tourhands.co      │ ROLE   │ FIRST SHOW       │ │
│  │                        │ Editor │ Apr 28 · Chi     │ │
│  │                        │                           │ │
│  │                        │ [ Claim your pass → ]     │ │
│  │                        │ advance.fm/invite/...     │ │
│  └────────────────────────┴───────────────────────────┘ │
├─ footer slug line ─────────────────────────────────────┤
│  [Not expecting this? — Toss the pass.]    [advance.fm]│
└────────────────────────────────────────────────────────┘
```

### Key elements

**Stub column** — width `170px`, bg `#1f1d1a`, fg `#f9f7f4`, top-left + bottom-left radius `3px`, right border `1px dashed #8b8375`.

- Eyebrow: `JetBrains Mono` 10px, letter-spacing `0.22em`, uppercase, color `#a39a8c`.
- Display: "Crew" — `DM Serif Display` 44px, line-height `0.95`, letter-spacing `-0.03em`.
- Meta block: mono 11px, color `#a39a8c`, line-height `1.5`.
- Bottom "Issued by": mono eyebrow + `DM Sans` 13px name (500 weight, `#f9f7f4`) + mono email 10.5px.

**Main column**

- Top row: two mono eyebrows left/right — "Hold for claim" + datestamp `04.22.26 · 14:22 CT`.
- Eyebrow "TEAM": `DM Sans` 11px 500, letter-spacing `0.18em`, uppercase, color `#8b8375`.
- Headline: `DM Serif Display` 30px, line-height `1.05`, letter-spacing `-0.025em`, color `#1f1d1a`, weight 400. Break: `Midwest Run<br>Spring 26`.
- Body: `DM Sans` 14px, line-height `1.55`, color `#2a2824`.
- 1px solid divider `#e5dfd2`.
- Two-column data row: `Role` / `First show` eyebrows (10px 500, letter-spacing `0.16em`, uppercase) + `DM Sans`/`JetBrains Mono` 14px values.
- CTA: pill button — `background: #1f1d1a; color: #f9f7f4; padding: 15px 24px; border-radius: 24px; font: 500 14px 'DM Sans';`. Copy: `Claim your pass →`.
- Fallback URL in mono 11px, `#8b8375`, `word-break: break-all`.

**Footer slug** — two mono lines, 10px, letter-spacing `0.18em`, uppercase, `#8b8375`.

### Mobile behavior

At max-width `620px` the two columns stack: stub becomes full-width with a dashed *bottom* border; main becomes full-width below. Done via a `@media` block flipping `display: block` on `.stubcol` and `.stubcol-main`.

### Subject line + preheader

- Subject: `Crew pass · Midwest Run — claim access`
- Preheader (hidden `<div>` at top of body): `Crew pass for Midwest Run · Spring 26. Tap to claim your credential.`

---

## Variant C — "Dispatch"

**File:** `emails/invite-dispatch.html`

### Concept

Minimal, typographic, editorial. Feels like a postcard from the road. Dominant serif headline, hairline data table, no card or container — the email floats directly on the warm canvas.

### Layout structure (desktop, max-width 520px)

```
[A] Advance                               (wordmark, left)

— — — Dispatch from Maya — — —            (mono slug)

A tour
needs you
on it.                                    (DM Serif Display 54px)

——                                        (28px x 2px dash)

Maya Okafor added you to a tour…          (body, 16px)
Set up your account and you'll…

╔══════════════════════════════════════╗
║ TEAM    │ Midwest Run · Spring 26    ║
║ DATES   │ Apr 28 → May 18, 2026      ║
║ ROUTING │ Chicago → Minneapolis…     ║
║ YOUR    │ Editor — can advance…      ║
║ ROLE    │                            ║
╚══════════════════════════════════════╝  (1px top + bottom rule, 1px row rules)

[ Sign in or create account → ]           (pill button)

— Advance · advance.fm/invite/a7k2p9       (mono sign-off)
— Not expecting this? Ignore; nothing…
```

### Key elements

**Wordmark** — 24×24 dark tile with serif "A" (`#221F1C` on `#F9F7F4`, radius `5px`), followed by "Advance" in `DM Serif Display` 18px, `-0.02em` tracking.

**Slug line** — mono 11px, letter-spacing `0.18em`, uppercase, `#8b8375`. Literal en-dash padding: `— — — Dispatch from Maya — — —`.

**Hero headline** — `DM Serif Display` 54px, line-height `1.0`, letter-spacing `-0.035em`, color `#1f1d1a`, weight 400. Three lines, hard-broken with `<br>`: "A tour / needs you / on it."  Mobile clamp to 42px.

**Dash rule** — 28px × 2px solid `#1f1d1a` after the headline, separates display from body.

**Body** — two `<p>` blocks, `DM Sans` 16px, line-height `1.6`, color `#2a2824`. First paragraph has inviter name wrapped in `<strong style="font-weight:600">`.

**Data block** — nested `<table>` with:
- `border-top: 1px solid #1f1d1a` and `border-bottom: 1px solid #1f1d1a` (heavier brackets).
- Row dividers between rows: `border-top: 1px solid #e5dfd2`.
- Left column (38% width): mono 10px eyebrow, letter-spacing `0.2em`, uppercase, `#8b8375`.
- Right column: `DM Sans` or `JetBrains Mono` 14px, `#1f1d1a`.
- Row padding: `14px 10px 14px 0` left / `14px 0` right.

**CTA** — pill button, `background: #1f1d1a; color: #f9f7f4; padding: 17px 28px; border-radius: 26px; font: 500 15px 'DM Sans';`. Copy: `Sign in or create account →`.

**Sign-off** — two mono lines, 11px, color `#8b8375`, line-height `1.6`. Each prefixed with em-dash.

### Mobile behavior

At max-width `620px`: hero drops from 54px → 42px; horizontal padding tightens to 26px. Table rows remain side-by-side — the 38% left column holds at ~100px which is legible on mobile.

### Subject line + preheader

- Subject: `A tour needs you on it`
- Preheader: `Dispatch from Maya. A tour needs you on it.`

---

## Token replacement (both variants)

These strings must be templated — substitute per-invite:

| Token in HTML | Variable | Example |
|---|---|---|
| `Maya Okafor` | `inviter.name` | The inviting user's display name |
| `maya@tourhands.co` | `inviter.email` | Inviting user's email |
| `Midwest Run · Spring 26` | `team.name` | Team/tour display name |
| `14 shows` | `team.showCount` | Count of shows in the team/tour |
| `Apr 28 — May 18` / `Apr 28 → May 18, 2026` | `team.dateRange` | Formatted date range |
| `Chicago → Minneapolis` | `team.routing` | First → last city |
| `Apr 28 · Chicago` (pass) / `Apr 28 · Lincoln Hall, Chicago` (landing) | `team.firstShow` | First show summary |
| `Editor — can advance shows, edit day sheets` | `invite.roleLabel` | Role-string lookup |
| `advance.fm/invite/a7k2p9` | `invite.url` | Full invite URL (also used on the CTA `href`) |
| `A7K-2P9` | `invite.code` | Short code (pass variant only, top-right "No.") |
| `04.22.26 · 14:22 CT` | `invite.sentAt` | Sent timestamp |
| Avatar letter `M` | `inviter.name[0]` | First letter of inviter's name, uppercase |

The pass variant hard-codes `M` in the stub "Crew" word — that's the role label, not the avatar. Don't template it.

---

## Email-safe implementation rules

Both variants follow these conventions — honor them in the target implementation:

1. **Layout: nested `<table role="presentation">`**. No CSS Grid, no Flexbox for structural layout. `width` + `cellpadding` + `cellspacing="0"` + `border="0"` on every table.
2. **Styles: inline** on every visible element. One `<style>` block in `<head>` is allowed *only* for Google Fonts `@import`, the hidden preheader, and the `@media (max-width: 620px)` mobile rules — Gmail web keeps these.
3. **Buttons: dual implementation**
   - Modern clients: `<a>` styled as a pill with inline padding + background + radius.
   - Outlook (desktop): `<!--[if mso]> <v:roundrect ...> <!--[endif]-->` VML fallback with `arcsize="33%"` (pass) / `34%` (dispatch). Already present in both files — don't strip it.
4. **No remote images for critical UI.** Both the app wordmark and the inviter "avatar" (pass variant doesn't use one; landing does) are rendered as a `<td>` with a letter + background color. This avoids broken-image boxes when the recipient's client blocks remote images.
5. **Hidden preheader** — first child of `<body>`:
   ```html
   <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
     … preview text …
   </div>
   ```
6. **Entities over HTML chars** — use `&rarr;` for →, `&mdash;` for —, `&middot;` for ·. Some clients mangle raw Unicode.
7. **Ship a plain-text alternative** (multipart/alternative) alongside the HTML part. The HTML files don't contain a plain-text version — generate one from the template's copy. Not included in this bundle; produce it from the subject-line + body + URL.
8. **Link color** — the email-safe CTA is a filled dark pill, so no blue-link override is needed. Do not wrap the CTA in `<u>` or `<font color>`.
9. **Dark mode** — both variants ship **light-only** per the brief. Do not add `@media (prefers-color-scheme: dark)` overrides; they render inconsistently across clients and the warm canvas is the brand.

### Recommended email infra

For the `show-advance-pro` stack (React + TypeScript), the cleanest path is **[`react-email`](https://react.email)** with `@react-email/components` — its `<Button>`, `<Container>`, `<Section>`, `<Row>`, `<Column>` components compile to the table-based HTML shown above and handle the Outlook VML fallback automatically. Subject + preheader go in the template's metadata.

Deliver through the existing transactional sender (Resend, Postmark, SES — whichever is already wired). If nothing is wired yet, Resend integrates with `react-email` in one line.

---

## Accepted landing state

**File:** `emails/accepted-landing.html`

This is a **web app view**, not an email. Build it in `show-advance-pro`'s React + Tailwind + shadcn environment under `src/pages/InviteAcceptedPage.tsx` (or similar). Match the existing `src/pages/*.tsx` conventions — `AppLayout`, `PageTitle`, `Card`, etc.

### Layout

- Full-page centered column, `max-w-md` (~520px), vertical padding `py-14`.
- Top: app wordmark (`A` tile + "Advance" in DM Serif Display 20px).
- Success indicator: 64×64 circle, `bg-pastel-green-bg`, `text-pastel-green-fg`, centered Lucide `check` icon 26×26. Animate in with `cubic-bezier(0.34, 1.56, 0.64, 1)` spring, 500ms, from `scale(0.6) opacity:0` → `scale(1) opacity:1`. Respect `prefers-reduced-motion`.
- Eyebrow: "You're in" — DM Sans 11px 500, letter-spacing `0.18em`, uppercase, `text-muted-foreground`.
- Headline: "Welcome to the crew." — DM Serif Display 42px, line-height `1.05`, letter-spacing `-0.03em`, weight 400.
- Lede: "Your account's set up. Maya's tour is waiting on your dashboard — take a look before doors." — DM Sans 16px, line-height `1.55`, `#2a2824`, `max-w-md`.
- **Joined card** — `rounded-lg border bg-card` with `p-6`:
  - Eyebrow "You joined"
  - Team name in DM Serif Display 22px
  - Meta row: `<span class="mono font-medium">14 shows</span> · <span class="mono font-medium">Apr 28 — May 18</span> · Chicago → Minneapolis`
  - Hairline rule `border-t border-border/70`, `pt-4 mt-4`.
  - "Next up" checklist — three items, first pre-checked (green tick on pastel-green bg, strikethrough text in muted-foreground). Each item: 18px circle + DM Sans 14px.
- CTA pill — `bg-primary text-primary-foreground px-6 py-[15px] rounded-[24px] text-sm font-medium`. Copy: `Go to dashboard →`. Hover: `translateY(-1px)`.
- Fine print: `Signed in as <you@band.fm> · switch account` — 12px muted, with the email in mono and "switch account" as an underline link.

### Interactions

- Checklist items in "Next up" should be clickable in production — each routes to its respective destination (Settings → phone, Show detail → Apr 28). In the mock they're static.
- "Go to dashboard →" routes to `/dashboard`.
- "switch account" triggers the existing sign-out → sign-in flow.
- Follow the repo's `--ease-out`, `--ease-editorial`, `--dur-page`, `--dur-press` tokens for all transitions. No custom easings.

---

## Subject lines + preheaders (summary)

| Variant | Subject | Preheader |
|---|---|---|
| B · Crew pass | `Crew pass · Midwest Run — claim access` | `Crew pass for Midwest Run · Spring 26. Tap to claim your credential.` |
| C · Dispatch | `A tour needs you on it` | `Dispatch from Maya. A tour needs you on it.` |

Alternative recommended subject if you want to A/B against a more operational line:
`{inviter.firstName} added you to {team.name}` — e.g. `Maya added you to Midwest Run · Spring 26`.

---

## Testing

Before shipping, render both variants through:

1. **[Litmus](https://www.litmus.com)** or **[Email on Acid](https://www.emailonacid.com)** — at minimum: Gmail web, Gmail iOS, Gmail Android, Apple Mail (macOS + iOS), Outlook desktop 2016+, Outlook.com.
2. **[Mail-Tester](https://www.mail-tester.com)** for spam-score sanity.
3. Manual send to a burner account of each major client.

Known areas to eyeball:
- Outlook desktop: VML button renders. Font falls back to Georgia/Arial; layout should hold.
- Gmail clipping: both emails are under Gmail's 102KB clip threshold — good.
- Dark-mode-forcing clients (iOS Mail dark, some Outlook): our inline light colors will *not* invert, which is intentional. Confirm contrast is still AA.

---

## Files in this bundle

```
design_handoff_invite_email/
├── README.md                       ← this file
└── emails/
    ├── invite-pass.html            ← Variant B source (design reference)
    ├── invite-dispatch.html        ← Variant C source (design reference)
    └── accepted-landing.html       ← Post-click web view (design reference)
```

All three are standalone, self-rendering HTML. Open in a browser to preview; copy out the structure + tokens when reimplementing in your template engine.
