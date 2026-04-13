import { useState } from "react";
import { Slider } from "@/components/ui/slider";

interface RevenueSimulatorProps {
  guarantee: number;
  walkoutPotential: number;
  venueCapacity?: number | null;
  ticketPrice?: number | null;
  backendDeal?: string | null;
}

function parseDollar(val: string | null | undefined): number | null {
  if (!val) return null;
  // Handle slash-separated values like "$20/$25/$30" — use the first number
  if (val.includes("/")) {
    const first = val.split("/")[0];
    const n = parseFloat(first.replace(/[^0-9.\-]/g, ""));
    return isNaN(n) ? null : n;
  }
  const num = parseFloat(val.replace(/[^0-9.\-]/g, ""));
  return isNaN(num) ? null : num;
}

function formatDollar(val: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
}

/** Extract a percentage from strings like "70% of GBOR", "$500 vs 80% of gross", "85%" */
function parseBackendPct(deal: string | null | undefined): number | null {
  if (!deal) return null;
  const match = deal.match(/(\d{1,3}(?:\.\d+)?)\s*%/);
  if (!match) return null;
  const pct = parseFloat(match[1]);
  return pct > 0 && pct <= 100 ? pct : null;
}

/**
 * Detect whether the deal references NBOR (net) or GBOR/gross.
 * NBOR deals deduct venue expenses before the % applies; since we don't
 * have expense data we apply the % to GBOR and flag it as an approximation.
 */
function parseBackendBasis(deal: string | null | undefined): "NBOR" | "GBOR" | "gross" {
  if (!deal) return "gross";
  if (/NBOR/i.test(deal)) return "NBOR";
  if (/GBOR/i.test(deal)) return "GBOR";
  return "gross";
}

export { parseDollar, formatDollar, parseBackendPct };

export default function RevenueSimulator({ guarantee, walkoutPotential, venueCapacity, ticketPrice, backendDeal }: RevenueSimulatorProps) {
  const [pct, setPct] = useState(75);

  const ticketCount = venueCapacity ? Math.round(venueCapacity * (pct / 100)) : null;
  const backendPct = parseBackendPct(backendDeal);
  const backendBasis = parseBackendBasis(backendDeal);

  // Smart calculation when we have ticket price + capacity
  const hasGborData = ticketPrice != null && ticketPrice > 0 && ticketCount != null;
  const gbor = hasGborData ? ticketCount * ticketPrice : null;

  // When we have GBOR + backend deal percentage, calculate artist take
  const hasBackendCalc = gbor != null && backendPct != null;
  const backendTake = hasBackendCalc ? gbor * (backendPct / 100) : null;
  const artistTake = hasBackendCalc ? Math.max(guarantee, backendTake!) : null;

  // Fallback: linear interpolation between guarantee and walkout
  const interpolated = guarantee + (walkoutPotential - guarantee) * (pct / 100);

  // Use the smarter calculation when available, otherwise fallback
  const projected = artistTake ?? interpolated;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Projected Walkout
        </p>
        <p className="text-sm text-muted-foreground">
          {pct}%{ticketCount !== null && ` · ~${ticketCount.toLocaleString()} tickets`}
        </p>
      </div>

      <p className="text-3xl font-semibold tracking-tight">{formatDollar(projected)}</p>

      {hasGborData && (
        <div className="space-y-1 text-sm text-muted-foreground font-mono">
          <p>~{ticketCount!.toLocaleString()} tickets × {formatDollar(ticketPrice!)} = {formatDollar(gbor!)} GBOR</p>
          {hasBackendCalc && (
            <p>
              Artist take: max({formatDollar(guarantee)} guarantee, {backendPct}% × {formatDollar(gbor!)}) = {formatDollar(artistTake!)}
            </p>
          )}
        </div>
      )}

      <Slider
        value={[pct]}
        onValueChange={([v]) => setPct(v)}
        min={0}
        max={100}
        step={1}
      />

      <p className="text-xs text-muted-foreground">
        {hasBackendCalc
          ? backendBasis === "NBOR"
            ? `Using GBOR as an approximation for NBOR — venue expenses not factored in`
            : `${backendPct}% of GBOR vs ${formatDollar(guarantee)} guarantee`
          : hasGborData
            ? `Add a backend deal % (e.g. "70% of GBOR") to project from gross receipts — you don't need to repeat the guarantee here`
            : "Estimate based on linear interpolation between guarantee and walkout potential"}
      </p>
    </div>
  );
}
