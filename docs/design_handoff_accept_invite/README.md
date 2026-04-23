# Handoff: Accept-Invite Landing Page

## Overview

The landing page a user lands on after clicking the CTA in the "Dispatch" invite email ([see upstream handoff](../design_handoff_invite_email/) if relevant). It covers the two states the backend can resolve the invite token into:

- **New user** — the invited email has no Advance account yet. User sets up an account (Google SSO or name + password) and is auto-joined to the team.
- **Existing user** — the invited email matches a signed-in (or findable) Advance account. User confirms in one click.

The page is intentionally a visual *continuation* of the Dispatch email — same warm off-white canvas, same serif hero treatment, same mono eyebrow slug-line with em-dashes, same data block (Team / Invited By / Your Role), and the same dark pill CTA. A recipient who opens the email and clicks the button should not feel they've been handed off to "the app."

## About the Design Files

The HTML files in this bundle are **design references** — high-fidelity prototypes showing intended look, copy, and interaction patterns. They are not production code to copy verbatim.

The task is to **recreate these designs in Advance's existing codebase** (`ramielabidin/show-advance-pro` — React 18 + TypeScript + Vite + Tailwind + shadcn/Radix). Use the existing primitives (`Button`, `Input`, `Label`, `FieldGroup`, token classes like `text-muted-foreground`, `bg-card`, `border-border`) and the tokens already in `src/index.css` / `tailwind.config.ts`. Hex values quoted below are what the mock uses; prefer the matching token in the codebase (`hsl(var(--foreground))`, `hsl(var(--muted-foreground))`, etc.) over raw hex.

If a required primitive doesn't exist yet (e.g. the "locked email" input treatment, the mono slug line), add it to `src/components/ui/` following the conventions of the existing files.

## Fidelity

**High-fidelity.** Colors, type scales, spacing, rules, CTA dimensions, and copy are final. Recreate pixel-perfectly using Tailwind + tokens; do not redesign.

## Route

`/invite/:token` — the token is what the email CTA links to (`https://advance.fm/invite/a7k2p9` in the mock). Server resolves the token server-side and returns the shape needed to pick which of the two states to render:

```ts
type InviteResolution =
  | { status: 'new';      team: TeamMeta; inviter: UserMeta; role: RoleLabel; email: string }
  | { status: 'existing'; team: TeamMeta; inviter: UserMeta; role: RoleLabel; email: string;
      currentUser: { name: string; email: string; avatarInitial: string } }
  | { status: 'expired' | 'revoked' | 'not_found' };  // out of scope for this handoff
```

If `status === 'existing'` but the signed-in user's email ≠ `email`, render the "Switch account" affordance prominently (the page should only show the "Accept" button when the signed-in account matches the invited email).

---

## Screens

### Screen 1 — New user: set up account

**File:** `pages/new-user.html`
**Purpose:** Create an Advance account and accept the team invite in a single step.

#### Layout

Single column, centered, `max-width: 520px`, `padding: 48px 24px 80px`. Page background `hsl(var(--background))` (warm off-white, `#f9f7f4`). No card chrome — the page *is* the letter.

Vertical order, top to bottom:

1. **Wordmark lockup** — 24×24 dark tile with serif "A" + serif "Advance" word. `margin-bottom: 44px`.
2. **Slug line** — mono 11px eyebrow in muted-foreground: `— — — Accepting Maya's invite — — —`. `margin-bottom: 10px`.
3. **Hero** — DM Serif Display, 54px, 3-line stacked: `You're in.` / `Set up` / `your account.` Letter-spacing `-0.035em`, line-height `1`.
4. **Dash rule** — 28×2px filled `hsl(var(--foreground))` horizontal bar. `margin: 28px 0 22px`.
5. **Lede** — 16px/1.6 body: "**Maya Okafor** added you to a tour she's running on Advance. Pick a name and password and you'll show up on her crew." Name bolded.
6. **Data block** — top + bottom 1px `hsl(var(--foreground))` rules, inner 1px `hsl(var(--border))` dividers. Three rows: Team / Invited by / Your role. `margin-top: 30px`.
7. **SSO section** — mono kicker "— Finish your account", then the Google pill button + helper note.
8. **Divider** — 1px `hsl(var(--border))` rule with centered mono 10px "or set a password".
9. **Form** — email (locked), full name, password.
10. **CTA row** — dark pill "Join the crew →" + inline "Already on Advance? Sign in instead" link.
11. **Sign-off** — mono 11px two-line footer with legal links.

#### Components

**Wordmark** (reused from email header)
- Tile: `24×24`, `border-radius: 5px`, bg `#221F1C`, fg `#F9F7F4`, DM Serif Display 15px "A", centered.
- Word: DM Serif Display 18px, letter-spacing `-0.02em`, color `hsl(var(--foreground))`.

**Slug line** (reused pattern from email)
- `font-family: JetBrains Mono; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: hsl(var(--muted-foreground))`.
- Em-dashes are literal characters, not a border.

**Hero headline**
- `font-family: DM Serif Display; font-weight: 400; font-size: 54px; line-height: 1; letter-spacing: -0.035em; color: hsl(var(--foreground))`.
- Mobile (≤520px): `font-size: 42px`.
- Stacked with explicit `<br>` — do not rely on wrapping.

**Data block** (identical to email's data table)
- Wrapper: `border-top: 1px solid hsl(var(--foreground)); border-bottom: 1px solid hsl(var(--foreground));`
- Row: `display: flex; padding: 14px 0;`
- Between rows: `border-top: 1px solid hsl(var(--border));`
- Key cell: `width: 38%`, mono 10px, letter-spacing `0.2em`, uppercase, color `hsl(var(--muted-foreground))`, `padding-top: 2px`.
- Value cell: sans 14px, color `hsl(var(--foreground))`, line-height `1.4`.
- Mobile (≤520px): key cell `width: 42%`.

**Google SSO button**
- `display: inline-flex; align-items: center; gap: 12px;`
- `width: 100%; max-width: 380px;`
- `background: hsl(var(--card)); border: 1px solid hsl(var(--border)); border-radius: 26px;`
- `padding: 15px 24px 15px 22px;`
- `font: 500 15px 'DM Sans'; color: hsl(var(--foreground));`
- Inline Google G logo SVG (18×18, four-color — see source file for exact paths).
- Label: "Continue with Google".
- Trailing tag "Matches invite" — pushed right with `margin-left: auto`, mono 10px, letter-spacing `0.16em`, uppercase, color `hsl(var(--muted-foreground))`.
- Hover: border becomes `hsl(var(--foreground))`, `transform: translateY(-1px)`. Active: `transform: scale(0.98)`. Duration 150ms, ease `cubic-bezier(0.23, 1, 0.32, 1)`.

**"Matches invite" tag logic**
- Only show when the Google OAuth flow's returned email will match the invited email. In practice, render it unconditionally — the OAuth popup handles mismatch — but gate it with the helper note below.

**SSO helper note**
- 12px, `hsl(var(--muted-foreground))`, line-height `1.5`, `max-width: 380px`.
- Copy: "Use the Google account for `jordan@riverhousemusic.fm` — the address Maya invited. Picking a different one? We'll ask you to confirm before joining the crew."
- Email substring rendered in `font-family: JetBrains Mono; color: hsl(var(--foreground));`.

**Mismatch confirmation (required behavior)**
- If the Google account returned from OAuth ≠ the invited email, do NOT silently re-associate. Show a modal:
  - Title: "Different email — continue?"
  - Body: "You signed in as `other@gmail.com`, but the invite was sent to `jordan@riverhousemusic.fm`. Accepting will add this new Google account to Maya's crew."
  - Actions: "Use this account" (dark pill) / "Pick another" (ghost).

**"or" divider**
- `display: flex; align-items: center; gap: 14px; margin: 36px 0 28px;`
- Two flex-1 `height: 1px; background: hsl(var(--border));` lines flanking a centered mono 10px, letter-spacing `0.2em`, uppercase "or set a password".

**Email field (locked)**
- Label "Email", standard.
- Input: no border except `border-bottom: 1px solid hsl(var(--border));` at rest. `background: transparent;` `padding: 10px 0 12px;`
- Value rendered in `font-family: JetBrains Mono; font-size: 14px; color: hsl(var(--muted-foreground)); cursor: not-allowed;`
- `readonly` attribute.
- Absolute-positioned "Locked" tag on the right (mono 10px, letter-spacing `0.18em`, uppercase, muted).

**Name + Password fields**
- Same underline-only treatment: `border-bottom: 1px solid hsl(var(--border))`, transparent bg.
- Focus state: `border-bottom-color: hsl(var(--foreground))` (the dark rule), 150ms ease-out.
- Label: 13px, weight 500, `hsl(var(--foreground))`, `margin-bottom: 8px`.
- Input: DM Sans 15px, transparent, no border except bottom.
- Password hint: 12px, muted-foreground, line-height `1.4`, `margin-top: 6px`. Copy: "10 characters or more. You'll use this to sign in next time."

**Primary CTA**
- `background: hsl(var(--foreground)); color: hsl(var(--background));`
- `padding: 17px 28px; border-radius: 26px;`
- `font: 500 15px 'DM Sans'; line-height: 1;`
- Hover: `transform: translateY(-1px)` 150ms ease-out.
- Active: `transform: scale(0.97)` 160ms ease-out.
- Label: "Join the crew&nbsp;→" (non-breaking space before arrow).
- **Loading state:** replace arrow with `Loader2` spinner (animate-spin), keep label, disable pointer events.

**"Sign in instead" inline link**
- Sibling of the CTA button in a flex row with `gap: 18px`, `flex-wrap: wrap`.
- 13px, muted-foreground, link color `hsl(var(--foreground))` with 1px border-bottom.

**Sign-off**
- Two mono 11px lines, line-height `1.7`, muted-foreground.
- Line 1: `— Advance · advance.fm/invite/a7k2p9`
- Line 2: `— By joining, you agree to the <terms> and <privacy notice>.` (inline links, color inherit, 1px border-bottom).

---

### Screen 2 — Existing user: confirm

**File:** `pages/existing-user.html`
**Purpose:** One-click accept for users already signed in whose account matches the invited email.

#### Layout

Same shell, wordmark, slug line, dash rule, and data block as Screen 1. Differences:

- **Hero:** `Almost` / `there.` (two lines).
- **Lede:** "**Maya Okafor** added you to a tour she's running. One click and you'll show up on her crew — no new account needed."
- **No SSO / no form.** Replaced by a "whoami" card and a single confirm button.
- **CTA:** "Accept invite →" (same pill).
- **Sign-off line 2:** "— Not expecting this? Decline; Maya won't be notified."

#### Whoami card

Confirms which account will join the crew.

- Wrapper: `display: flex; align-items: center; gap: 12px;`
- `background: hsl(var(--card)); border: 1px solid hsl(var(--border)); border-radius: 12px;`
- `padding: 14px 16px; margin-top: 30px;`
- **Avatar:** 36×36, `border-radius: 50%`, `background: var(--pastel-green-bg)`, `color: var(--pastel-green-fg)`, DM Serif Display 16px initial, centered.
- **Text block (flex: 1):**
  - Kicker: mono 10px, letter-spacing `0.2em`, uppercase, muted: "Joining as".
  - ID: sans 14px, `"<Full Name> · <mono email>"`. Email in JetBrains Mono 13px, muted.
- **"Switch" link:** 12px, muted-foreground, 1px border-bottom. Hover → foreground. Links to sign-out + return to `/invite/:token`.

#### CTA row

- Dark pill "Accept invite →" + inline "Decline" text link.
- Decline link: 13px, muted-foreground, 1px border-bottom. Hover → foreground.
- Decline behavior: POST `/api/invites/:token/decline`, then redirect to a minimal "Invite declined" page (out of scope).

---

## Interactions & Behavior

### Entrance
- Page fades in: `opacity 0 → 1`, `220ms`, ease `cubic-bezier(0.16, 1, 0.3, 1)` (editorial easing).
- No stagger on the data block — it's part of the letter, not a list.

### Form validation (new user)
- **Name:** required, trim, 1–80 chars.
- **Password:** required, ≥10 chars. No complexity rules beyond length — Advance's existing auth page uses the same threshold.
- **Email:** read-only, never editable.
- Inline errors appear below each field in `hsl(var(--destructive))` at 12px, no icon. Triggered on blur, cleared on input.
- Submit button disabled until both required fields pass local validation.

### Submit (new user)
- Button enters loading state (spinner + disabled).
- POST `/api/invites/:token/accept` with `{ name, password }`.
- Success → redirect to `/welcome` (the accepted-landing screen already in the upstream handoff).
- Error → `toast.error(err.message)` using the codebase's existing `sonner` toaster. Do not wrap the error in prose — per the design system, the raw message is the copy.

### Google SSO flow (new user)
1. Click "Continue with Google" → enter loading state (spinner replaces G logo, label → "Opening Google…").
2. Open Google OAuth popup (existing Supabase/Auth provider, same as the auth page).
3. On success:
   - If returned email === invited email → silently POST `/api/invites/:token/accept` with `{ googleToken }`, redirect to `/welcome`.
   - If returned email ≠ invited email → open the mismatch modal (see above). On confirm, same POST with a `confirm_mismatch: true` flag.
4. On cancel/close → reset button state, no toast.

### Submit (existing user)
- Button enters loading state.
- POST `/api/invites/:token/accept` (no body — user is authed).
- Success → redirect to `/welcome`.

### Hover / focus / active

All per the design system (`docs/design-system.md`):
- **Hover** (desktop only, `@media (hover: hover) and (pointer: fine)`): lift `translateY(-1px)` where specified, 150ms ease-out. No hover on mobile.
- **Focus:** `ring-2 ring-ring ring-offset-2` on all interactive elements — do not reinvent.
- **Active (press):** `scale(0.97)` on the primary CTA, `scale(0.98)` on the Google pill, 160ms.

### Reduced motion
Respected globally from `src/index.css` — no per-component work needed.

---

## State Management

Single page component. Recommended hook:

```ts
const { invite, status } = useInviteResolution(token);  // resolves new | existing | error
```

Local form state (new-user path):
```ts
const [name, setName] = useState('');
const [password, setPassword] = useState('');
const [submitting, setSubmitting] = useState(false);
const [googleLoading, setGoogleLoading] = useState(false);
const [mismatchModal, setMismatchModal] = useState<null | { googleEmail: string; token: string }>(null);
```

Error surface: `sonner` toast. No inline error summary block.

---

## Design Tokens

All tokens exist in `src/index.css`. Use them — do not hardcode the hex values below in component styles. The hex values are listed so the developer can verify the tokens match.

| Token | Light | Usage on this page |
| --- | --- | --- |
| `--background` | `hsl(40 30% 97%)` → `#f9f7f4` | Page bg |
| `--foreground` | `hsl(30 10% 12%)` | All primary text, CTA bg, rule colors |
| `--muted-foreground` | `hsl(30 8% 50%)` | Mono slug line, kickers, helper text |
| `--card` | `hsl(40 25% 99%)` | Google pill bg, whoami card bg |
| `--border` | `hsl(35 18% 90%)` | Inner row dividers, underline inputs, or-divider |
| `--pastel-green-bg` | `#edf3ec` | Whoami avatar bg |
| `--pastel-green-fg` | `#346538` | Whoami avatar fg |
| `--destructive` | `hsl(0 72% 51%)` | Inline validation errors |

**Type:**
- Display: `DM Serif Display` — hero (54px/-0.035em), wordmark (18px/-0.02em), avatar initial (16px).
- Sans: `DM Sans` — body (16px/1.6), labels (13px/500), inputs (15px), CTA (15px/500).
- Mono: `JetBrains Mono` — slug line (11px/0.18em), kickers (10px/0.2em), locked email (14px), data-block keys (10px/0.2em).

**Radii:**
- `rounded-md` (0.5rem) — inputs, cards, whoami card is `rounded-lg` (0.75rem = 12px).
- `26px` — CTA and Google pill (matches email's CTA, bespoke value, not `rounded-full`).
- `50%` — avatar.
- `5px` — wordmark tile.

**Spacing:** 4/8/14/18/22/28/30/32/36/40/44/56/80px — the page uses irregular vertical rhythm on purpose (editorial), don't snap to a uniform scale.

**Motion:**
- `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` — default UI.
- `--ease-editorial: cubic-bezier(0.16, 1, 0.3, 1)` — page fade-in.
- `--dur-hover: 150ms`, `--dur-press: 160ms`, `--dur-page: 220ms`.

---

## Assets

- **Google G logo** — inline SVG, four-color, 18×18. Paths in the mock source (`pages/new-user.html`). Use a local copy; do not hotlink from Google.
- **Advance wordmark tile** — rendered as a div (not an image). No asset needed.
- **No photography, illustrations, or gradients** — per the design system.

---

## Files in this bundle

- `README.md` — this doc
- `pages/new-user.html` — Screen 1 mock (new user with SSO + form)
- `pages/existing-user.html` — Screen 2 mock (existing user, one-click confirm)
- `Accept-invite landing.html` — design canvas showing both screens side-by-side in browser frames, plus carry-over notes
- `colors_and_type.css` — the design-system token file used by both mocks (same file as in the Advance repo, re-synthesized)
- `design-canvas.jsx`, `browser-window.jsx` — scaffolding for the canvas file, not needed for implementation

To preview the mocks locally: open `Accept-invite landing.html` in a browser.
