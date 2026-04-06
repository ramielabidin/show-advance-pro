

# Enhanced Revenue Simulator with Ticket Price and Backend Deal Data

## Overview

Upgrade the Revenue Simulator on both ShowDetailPage and TourDetailPage to use ticket price, capacity, and backend deal data when available. This makes the simulator calculate gross revenue from ticket sales and apply backend deal logic (e.g., "70% of GBOR") rather than relying solely on the walkout_potential interpolation.

## How It Works for Users

- **When ticket price + capacity are available**: The simulator calculates gross box office revenue (GBOR) as `tickets_sold × ticket_price`, then shows both the GBOR line and the artist's projected take based on the backend deal
- **When a backend deal like "70% of GBOR" is present**: The simulator shows which is higher — the guarantee or the backend percentage — since deals are typically "guarantee vs % of gross, whichever is greater"
- **Fallback**: When only guarantee + walkout_potential exist (no ticket price), it continues using the current linear interpolation

## Technical Plan

### 1. Update `RevenueSimulator.tsx`

- Add `ticketPrice` and `backendDeal` props (both optional)
- Add a `parseBackendPct` helper that extracts a percentage from strings like "70% of GBOR", "80% of gross", etc.
- When ticket price + capacity are available, show a breakdown line: `~322 tickets × $25 = $8,050 GBOR`
- When a backend percentage is parsed, calculate `GBOR × backendPct` and compare to guarantee, showing: `Artist take: max($500 guarantee, 70% of $8,050) = $5,635`
- Keep the existing interpolation as the fallback/secondary view
- Update the description note to reflect the calculation method used

### 2. Update `ShowDetailPage.tsx` (line ~321-338)

- Pass additional props to `RevenueSimulator`: `ticketPrice` (parsed from `show.ticket_price`) and `backendDeal` (raw string from `show.backend_deal`)
- Also allow the simulator to show when only ticket price + capacity exist (even without walkout_potential), since GBOR can be calculated independently

### 3. Update `TourRevenueSimulator.tsx`

- Pass `ticket_price` and `backend_deal` through the show interface
- For shows with ticket price + capacity + backend deal, use the smarter calculation
- For shows with only guarantee/walkout, continue using interpolation
- Show a note like "3 shows with deal terms, 2 with estimates"

### Display Layout (Show Detail)

```text
PROJECTED WALKOUT                           75% · ~322 tickets
$5,635

~322 tickets × $25 = $8,050 GBOR
Artist take: max($500 guarantee, 70% × $8,050) = $5,635

[====================--------] slider

Calculated from backend deal: $500 guarantee vs 70% of GBOR
```

When no backend deal or ticket price is available, the current simpler display remains unchanged.

