# Advance — App UI Kit

High-fidelity recreation of the Advance web app (PWA). Single product, five surfaces:

| Surface | File |
| --- | --- |
| App chrome (top nav + theme toggle) | `AppChrome.jsx` |
| Dashboard (home) | `Dashboard.jsx` |
| Shows list (upcoming/past + view pills) | `ShowsList.jsx` |
| Show detail (inline-editable) | `ShowDetail.jsx` |
| Settings (tabs: team, touring party, contacts, documents, integrations) | `Settings.jsx` |
| Primitives (Button, Card, Chip, Dot, Eyebrow, StatTile, FieldRow, SectionLabel, Icon) | `Primitives.jsx` |
| Root + fake data + persistence | `App.jsx` |

Open `index.html` to see the live prototype — click through shows, toggle light/dark, edit a show's notes.

Source of truth: [ramielabidin/show-advance-pro](https://github.com/ramielabidin/show-advance-pro) — `src/pages/*Page.tsx`, `src/components/{ShowCard,FieldGroup,FieldRow,AppLayout}.tsx`, `docs/design-system.md`.

### Notes

- Fonts load from Google Fonts (DM Sans, DM Serif Display, JetBrains Mono).
- Icons are Lucide via CDN.
- This kit cuts corners on real data / auth / Supabase — the job is to match the visual + interaction language, not to re-ship the product.
