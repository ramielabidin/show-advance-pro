import { useState } from "react";
import { Slider } from "@/components/ui/slider";

interface RevenueSimulatorProps {
  guarantee: number;
  walkoutPotential: number;
  venueCapacity?: number | null;
}

function parseDollar(val: string | null | undefined): number | null {
  if (!val) return null;
  const num = parseFloat(val.replace(/[^0-9.\-]/g, ""));
  return isNaN(num) ? null : num;
}

function formatDollar(val: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
}

export { parseDollar, formatDollar };

export default function RevenueSimulator({ guarantee, walkoutPotential, venueCapacity }: RevenueSimulatorProps) {
  const [pct, setPct] = useState(75);

  const projected = guarantee + (walkoutPotential - guarantee) * (pct / 100);
  const ticketCount = venueCapacity ? Math.round(venueCapacity * (pct / 100)) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Projected Walkout
        </p>
        <p className="text-sm text-muted-foreground">
          {pct}%{ticketCount !== null && ` · ~${ticketCount} tickets`}
        </p>
      </div>

      <p className="text-3xl font-semibold tracking-tight">{formatDollar(projected)}</p>

      <Slider
        value={[pct]}
        onValueChange={([v]) => setPct(v)}
        min={0}
        max={100}
        step={1}
      />

      <p className="text-xs text-muted-foreground">
        Estimate based on linear interpolation between guarantee and walkout potential
      </p>
    </div>
  );
}
