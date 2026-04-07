import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { formatDollar, parseDollar, parseBackendPct } from "@/components/RevenueSimulator";

interface TourRevenueSimulatorProps {
  shows: Array<{
    guarantee?: string | null;
    walkout_potential?: string | null;
    ticket_price?: string | null;
    venue_capacity?: string | null;
    backend_deal?: string | null;
  }>;
}

export default function TourRevenueSimulator({ shows }: TourRevenueSimulatorProps) {
  const [pct, setPct] = useState(75);

  let dealShowCount = 0;
  let estimateShowCount = 0;

  const financialShows = shows
    .map((s) => {
      const guarantee = parseDollar(s.guarantee) ?? 0;
      const walkout = parseDollar(s.walkout_potential);
      const ticketPrice = parseDollar(s.ticket_price);
      const capacity = s.venue_capacity ? parseInt(s.venue_capacity.replace(/[^0-9]/g, ""), 10) : null;
      const backendPct = parseBackendPct(s.backend_deal);
      const validCapacity = capacity != null && !isNaN(capacity) ? capacity : null;

      return { guarantee, walkout, ticketPrice, capacity: validCapacity, backendPct };
    })
    .filter((s) => s.walkout !== null || (s.ticketPrice != null && s.ticketPrice > 0 && s.capacity != null));

  if (financialShows.length === 0) return null;

  const totalGuarantee = financialShows.reduce((sum, s) => sum + s.guarantee, 0);

  let totalWalkout = 0;
  let totalProjected = 0;

  for (const s of financialShows) {
    const ticketCount = s.capacity ? Math.round(s.capacity * (pct / 100)) : null;
    const hasGbor = s.ticketPrice != null && s.ticketPrice > 0 && ticketCount != null;
    const gbor = hasGbor ? ticketCount * s.ticketPrice! : null;
    const hasBackend = gbor != null && s.backendPct != null;

    if (hasBackend) {
      const artistTake = Math.max(s.guarantee, gbor! * (s.backendPct! / 100));
      totalProjected += artistTake;
      totalWalkout += s.walkout ?? gbor!;
      dealShowCount++;
    } else if (s.walkout !== null) {
      totalProjected += s.guarantee + (s.walkout - s.guarantee) * (pct / 100);
      totalWalkout += s.walkout;
      estimateShowCount++;
    } else if (hasGbor) {
      totalProjected += gbor!;
      totalWalkout += gbor!;
      estimateShowCount++;
    }
  }

  const methodNote = dealShowCount > 0 && estimateShowCount > 0
    ? `${dealShowCount} show${dealShowCount !== 1 ? "s" : ""} with deal terms, ${estimateShowCount} with estimates`
    : dealShowCount > 0
      ? `${dealShowCount} show${dealShowCount !== 1 ? "s" : ""} with deal terms`
      : `${financialShows.length} of ${shows.length} shows with financial data`;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Tour Financials
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Total Guarantee</p>
          <p className="text-lg font-semibold font-mono">{formatDollar(totalGuarantee)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Total Walkout Potential</p>
          <p className="text-lg font-semibold font-mono">{formatDollar(totalWalkout)}</p>
        </div>
      </div>

      <div className="space-y-3 pt-2">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Projected Tour Walkout at {pct}%
          </p>
        </div>

        <p className="text-2xl sm:text-3xl font-semibold tracking-tight">{formatDollar(totalProjected)}</p>

        <Slider
          value={[pct]}
          onValueChange={([v]) => setPct(v)}
          min={0}
          max={100}
          step={1}
        />

        <p className="text-xs text-muted-foreground">
          Based on {methodNote}
        </p>
      </div>
    </div>
  );
}
