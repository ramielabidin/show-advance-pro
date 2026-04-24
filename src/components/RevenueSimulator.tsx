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
    const n = parseFloat(first.replace(/[^0-9.-]/g, ""));
    return isNaN(n) ? null : n;
  }
  const num = parseFloat(val.replace(/[^0-9.-]/g, ""));
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
 * NBOR deals deduct venue expenses before the % applies; since we don't have
 * expense data per show, we approximate NBOR as GBOR reduced by NBOR_EXPENSE_RATIO.
 */
export function parseBackendBasis(deal: string | null | undefined): "NBOR" | "GBOR" | "gross" {
  if (!deal) return "gross";
  if (/NBOR/i.test(deal)) return "NBOR";
  if (/GBOR/i.test(deal)) return "GBOR";
  return "gross";
}

/** Industry rule-of-thumb puts NBOR at 15–25% below GBOR; midpoint is a reasonable default. */
export const NBOR_EXPENSE_RATIO = 0.2;

/** Detect vs/plus deal type from stored string */
export function parseBackendType(deal: string | null | undefined): "vs" | "plus" {
  if (!deal) return "vs";
  return /\(plus\)/i.test(deal) ? "plus" : "vs";
}

/** Extract second-tier escalation or null */
export function parseTieredDeal(deal: string | null | undefined): { tier2Pct: number; tier2Threshold: number } | null {
  if (!deal) return null;
  const m = deal.match(/then\s+(\d{1,3}(?:\.\d+)?)\s*%\s+above\s+(\d+)\s*tickets?/i);
  if (!m) return null;
  const tier2Pct = parseFloat(m[1]);
  const tier2Threshold = parseInt(m[2], 10);
  if (isNaN(tier2Pct) || isNaN(tier2Threshold)) return null;
  return { tier2Pct, tier2Threshold };
}

export { parseDollar, formatDollar, parseBackendPct };

export default function RevenueSimulator({ guarantee, walkoutPotential, venueCapacity, ticketPrice, backendDeal }: RevenueSimulatorProps) {
  const [pct, setPct] = useState(75);

  const ticketCount = venueCapacity ? Math.round(venueCapacity * (pct / 100)) : null;
  const backendPct = parseBackendPct(backendDeal);
  const backendBasis = parseBackendBasis(backendDeal);
  const dealType = parseBackendType(backendDeal);
  const tieredDeal = parseTieredDeal(backendDeal);

  // Smart calculation when we have ticket price + capacity
  const hasGborData = ticketPrice != null && ticketPrice > 0 && ticketCount != null;
  const gbor = hasGborData ? ticketCount * ticketPrice : null;

  // When we have GBOR + backend deal percentage, calculate artist take.
  // For NBOR deals, reduce the revenue base by NBOR_EXPENSE_RATIO to approximate
  // the venue-expense deduction we can't model per show.
  const borFactor = backendBasis === "NBOR" ? 1 - NBOR_EXPENSE_RATIO : 1;
  const effectiveBor = gbor != null ? gbor * borFactor : null;
  let backendTake: number | null = null;
  if (hasGborData && backendPct != null) {
    if (tieredDeal) {
      const tier1Count = Math.min(ticketCount!, tieredDeal.tier2Threshold);
      const tier2Count = Math.max(0, ticketCount! - tieredDeal.tier2Threshold);
      backendTake = (tier1Count * ticketPrice! * borFactor * (backendPct / 100))
                  + (tier2Count * ticketPrice! * borFactor * (tieredDeal.tier2Pct / 100));
    } else {
      backendTake = effectiveBor! * (backendPct / 100);
    }
  }
  const hasBackendCalc = backendTake != null;
  const artistTake = hasBackendCalc
    ? dealType === "plus"
      ? guarantee + backendTake!
      : Math.max(guarantee, backendTake!)
    : null;

  // Fallback: linear interpolation between guarantee and walkout
  const interpolated = guarantee + (walkoutPotential - guarantee) * (pct / 100);

  // Use the smarter calculation when available, otherwise fallback
  const rawProjected = artistTake ?? interpolated;

  // Cap at walkout potential — it's the booker's informed ceiling and accounts
  // for factors (like expenses) that the simulator can't model
  const cappedByWalkout = walkoutPotential > 0 && rawProjected > walkoutPotential;
  const projected = cappedByWalkout ? walkoutPotential : rawProjected;

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
          {hasBackendCalc && backendBasis === "NBOR" && (
            <p>Est. NBOR: {formatDollar(gbor!)} × {Math.round((1 - NBOR_EXPENSE_RATIO) * 100)}% = {formatDollar(effectiveBor!)}</p>
          )}
          {hasBackendCalc && tieredDeal && (
            <p>
              Tier 1: {Math.min(ticketCount!, tieredDeal.tier2Threshold).toLocaleString()} tickets × {backendPct}% = {formatDollar((Math.min(ticketCount!, tieredDeal.tier2Threshold)) * ticketPrice! * borFactor * (backendPct! / 100))}
              {ticketCount! > tieredDeal.tier2Threshold && ` + Tier 2: ${Math.max(0, ticketCount! - tieredDeal.tier2Threshold).toLocaleString()} tickets × ${tieredDeal.tier2Pct}% = ${formatDollar(Math.max(0, ticketCount! - tieredDeal.tier2Threshold) * ticketPrice! * borFactor * (tieredDeal.tier2Pct / 100))}`}
            </p>
          )}
          {hasBackendCalc && !tieredDeal && (
            <p>
              {dealType === "plus"
                ? `Artist take: ${formatDollar(guarantee)} guarantee + ${backendPct}% × ${formatDollar(effectiveBor!)} = ${formatDollar(artistTake!)}`
                : `Artist take: max(${formatDollar(guarantee)} guarantee, ${backendPct}% × ${formatDollar(effectiveBor!)}) = ${formatDollar(artistTake!)}`}
            </p>
          )}
          {hasBackendCalc && tieredDeal && (
            <p>
              {dealType === "plus"
                ? `Artist take: ${formatDollar(guarantee)} guarantee + ${formatDollar(backendTake!)} backend = ${formatDollar(artistTake!)}`
                : `Artist take: max(${formatDollar(guarantee)} guarantee, ${formatDollar(backendTake!)} backend) = ${formatDollar(artistTake!)}`}
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
          ? cappedByWalkout
            ? `${backendBasis} calc (${formatDollar(rawProjected)}) exceeds walkout potential — capped at ${formatDollar(walkoutPotential)}. Likely due to ${backendBasis === "NBOR" ? "actual venue expenses exceeding the 20% estimate" : "deal terms reducing net payout"}.`
            : backendBasis === "NBOR"
              ? `Approximating NBOR as ${Math.round((1 - NBOR_EXPENSE_RATIO) * 100)}% of GBOR (industry avg. 20% venue-expense deduction)`
              : dealType === "plus"
                ? `${formatDollar(guarantee)} guarantee + ${backendPct}% of GBOR`
                : `${backendPct}% of GBOR vs ${formatDollar(guarantee)} guarantee`
          : hasGborData
            ? `Add a backend deal % (e.g. "70% of GBOR") to project from gross receipts — you don't need to repeat the guarantee here`
            : "Estimate based on linear interpolation between guarantee and walkout potential"}
      </p>
    </div>
  );
}
