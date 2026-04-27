# Advance — Platform Reference

A vocabulary and surface map for the Advance app. Read this when working on anything that touches the product surface — copy, navigation, exports, guest views.

## Surfaces

The app has six top-level surfaces. All authenticated routes wrap in `AppLayout`.

| Surface | Route | What it is |
|---|---|---|
| **Dashboard** | `/` | Tour-progress UI, upcoming shows, filtering by tour. Today is also where Day of Show Mode surfaces. |
| **Shows** | `/shows` | List of all shows across all tours. Filtering, scope, view toggles persisted as URL state. |
| **Show Detail** | `/shows/:id` | The workhorse. Inline-editable advance for a single show — schedule, contacts, hospitality, hotel, deal/financial, settlement. |
| **Tours** | `/tours` | Tour roster and a dedicated tour view with revenue simulator. |
| **Settings** | `/settings` | Team, documents, contacts, Slack integration, email forwarding. |
| **Guest** | `/guest/:token` | Public, magic-link surface — no login required. Resolves a token into either a day sheet or a door list. |

## Core concepts

### Show

A single date on a tour. The atomic unit. Has venue, date, schedule, contacts, deal, guest list, and a settlement record. Lives in the `shows` table.

**State flags** (independent — each means something different):
- `is_reviewed` — user has reviewed the auto-parsed data. `false` on creation from parsed advance / inbound email; `true` on manual creation. Drives the "New" badge and review banner.
- `advanced_at` (timestamp) — user has confirmed all show details with the venue. Toggled by "Mark as advanced." Drives the dot color on show cards and the Tour Progress bar.
- `is_settled` — show has happened and financials are recorded. Unlocks `actual_walkout`, `actual_tickets_sold`, `settlement_notes` and swaps walkout projections for actuals across the app.

### Tour

A grouping of shows. Tours have a name, a date range, and a set of party members. Optional — shows can exist outside a tour.

### Advancing

The act of confirming all show-day logistics with the venue: load-in time, doors, set length, hospitality, parking, hotel, etc. The verb the product is named after. "Mark as advanced" sets `advanced_at` on the show.

### Day sheet

The artifact distributed to crew on the day of (or day before) a show. In Advance, the day sheet is generated from show data and exists in three formats:

- **Email** (`send-daysheet-email` edge function) — full HTML day sheet via SendGrid. One shared thread, replies route back to the sender.
- **Slack** (`push-slack-daysheet` edge function) — Block Kit message to the connected workspace. Auto-pushes on show day.
- **PDF** (`ExportPdfDialog`) — single-page "Run of Show" poster meant to be printed and taped to the green-room wall. **Intentionally narrower** than email/Slack — schedule-focused, omits the bulk of the day sheet.

Email and Slack share the section list in `src/lib/daysheetSections.ts`. PDF is deliberately separate — don't unify them.

### Settlement

The post-show financial record: actual walkout, actual tickets sold, settlement notes. Stored on the show row, gated by `is_settled`. Surfaces as a settlement card at the top of the Deal tab once the show is settled.

### Guest links

Tokenized magic links that give scoped, mostly read-only access to a single show without login. Currently two flavors:

- **`daysheet`** — full day sheet (the curated, financial-data-stripped payload from the `get_guest_show` RPC)
- **`doorlist`** — guest list only

The single read endpoint is `get_guest_show(p_token text)` — `SECURITY DEFINER`, returns curated JSON. Deal/financial fields are omitted server-side so they never reach the client. The only write surface a guest gets is editing the guest list, gated to `link_type="daysheet"`.

### Day of Show Mode

A focused mobile surface for tour managers on show day. Collapses today's show into one screen that reshapes itself as the night progresses (pre-show countdown → settle → post-settle hotel reveal). Surfaces from the dashboard.

## Vocabulary cheatsheet

For copy, exports, and any user-facing text. Use these terms consistently.

| Term | Meaning |
|---|---|
| **Advance** (verb) | Confirm show-day logistics with the venue. |
| **Advance** (noun) | The packet of show-day logistics — what the venue sends, what the TM confirms. Also the product name. |
| **Day sheet** | The crew-facing summary distributed before showtime. Two words. |
| **Walkout** | Net guarantee + bonus paid to artist after the show. |
| **Backend** | The bonus structure beyond the guarantee — points, percentages, tiered. |
| **Tier (deal)** | A threshold-based bonus structure (e.g. "85% over $X"). Distinct from *pricing tier*. |
| **Set length** | Duration of the band's actual performance slot. Different from doors-to-curfew. |
| **Tour Manager / TM** | The primary user persona. |
| **Crew** | Anyone working the show — FOH, monitors, lighting, drivers, photographers. |
| **Touring party** | The crew directory (`touring_party_members`) — distinct from `team_members` (login-having users). |
| **Promoter** | The local entity buying the show. Often the contact-of-record for advancing. |
| **Production** | The venue-side person handling load in, sound, and the technical rider. |
| **Hospitality** | Venue-side hospitality contact (rider, dressing rooms, catering). |
| **Day of show contact** | The single contact a TM calls if anything goes wrong on show day. At most one per show. |

## Data model touchpoints

Pointers, not exhaustive. See `src/lib/types.ts` and `src/integrations/supabase/types.ts` for the full picture.

- **`shows`** — one row per show. Holds the bulk of the advance data inline.
- **`schedule_entries`** — load in, soundcheck, doors, set, curfew, etc. The `is_band` flag marks the band's actual performance slot — never infer this from the label text.
- **`show_contacts`** — multi-contact replacement for the legacy single `dos_contact_*` columns. Roles: `day_of_show`, `promoter`, `production`, `hospitality`, `custom`.
- **`tours`** — tour roster, with a join table for party members.
- **`team_members`** — users with login access. Roles today are `owner` / `member`.
- **`touring_party_members`** — crew directory. Generally no login.
- **`guest_links`** — tokenized magic links. Soft-revoked via `revoked_at`.

## Outbound channels

Anything the app sends to the outside world. Output quality is part of the product — these must match in-app visual quality.

- **SendGrid** for transactional email (day sheet, team invite). Templates live next to their edge functions.
- **Slack** via the workspace OAuth flow → workspace credentials stored per-team → `push-slack-daysheet` posts to the configured channel.
- **PDF** generated client-side with `jspdf` (no server roundtrip).
- **Inbound email** webhook (`inbound-email`) parses forwarded advance emails into the review queue.
