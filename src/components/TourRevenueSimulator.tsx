import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { formatDollar, parseDollar } from "@/components/RevenueSimulator";

interface TourRevenueSimulatorProps {
  shows: Array<{
    guarantee?: string | null;
    walkout_potential?: string | null;
  }>;
}

export default function TourRevenueSimulator({ shows }: TourRevenueSimulatorProps) {
  const [pct, setPct] = useState(75);

  const financialShows = shows
    .map((s) => ({
      guarantee: parseDollar(s.guarantee) ?? 0,
      walkout: parseDollar(s.walkout_potential),
    }))
    .filter((s) => s.walkout !== null) as Array<{ guarantee: number; walkout: number }>;

  if (financialShows.length === 0) return null;

  const totalGuarantee = financialShows.reduce((sum, s) => sum + s.guarantee, 0);
  const totalWalkout = financialShows.reduce((sum, s) => sum + s.walkout, 0);
  const totalProjected = financialShows.reduce(
    (sum, s) => sum + s.guarantee + (s.walkout - s.guarantee) * (pct / 100),
    0
  );

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Tour Financials
      </h3>

      <div className="grid grid-cols-2 gap-4">
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

        <p className="text-3xl font-semibold tracking-tight">{formatDollar(totalProjected)}</p>

        <Slider
          value={[pct]}
          onValueChange={([v]) => setPct(v)}
          min={0}
          max={100}
          step={1}
        />

        <p className="text-xs text-muted-foreground">
          Based on {financialShows.length} of {shows.length} shows with financial data
        </p>
      </div>
    </div>
  );
}
