import { useState, useMemo } from "react";
import { ArrowRight, Bed, ChevronRight } from "lucide-react";
import { formatCityState } from "@/lib/utils";
import SettleShowDialog from "@/components/SettleShowDialog";
import type { Show } from "@/lib/types";

interface PhaseSettleProps {
  show: Show;
}

/**
 * Phase 2 surface — the show is done, time to wrap. Single dominant Settle
 * CTA, a small hotel teaser previewing Phase 3, and that's it. Financial
 * inputs live in SettleShowDialog (which we mount on demand). The screen
 * intentionally has only one job — settle — so we don't crowd it.
 */
export default function PhaseSettle({ show }: PhaseSettleProps) {
  const [settleOpen, setSettleOpen] = useState(false);

  const hotelNavHref = useMemo(() => {
    if (!show.hotel_address?.trim() && !show.hotel_name?.trim()) return undefined;
    const target = [show.hotel_name, show.hotel_address].filter(Boolean).join(", ");
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(target)}`;
  }, [show.hotel_name, show.hotel_address]);

  const hotelTeaserSub = useMemo(() => {
    // Distance + room block aren't stored on Show — keep the teaser to what
    // we actually know. Fall back to address city if nothing else.
    if (show.hotel_address) {
      const parts = show.hotel_address.split(",").map((s) => s.trim()).filter(Boolean);
      return parts.length > 1 ? parts.slice(1).join(", ") : parts[0];
    }
    return formatCityState(show.city || "") || null;
  }, [show.hotel_address, show.city]);

  return (
    <div className="px-[22px] pt-2 pb-7 flex-1 flex flex-col">
      {/* Eyebrow */}
      <div
        className="text-[11px] uppercase font-medium leading-none mt-6 mb-[18px]"
        style={{ letterSpacing: "0.18em", color: "hsl(var(--muted-foreground))" }}
      >
        Show's done.
      </div>

      {/* Settle CTA — spine variant. Quiet card with a glowing green left
          edge as the visual cue, vs the previous large green tile. The whole
          card is the tap target; the pill below is a visual affordance, not
          a separate button. Per the round-2 design handoff. */}
      <button
        type="button"
        onClick={() => setSettleOpen(true)}
        className="relative w-full text-left rounded-[14px] border overflow-hidden [transition:transform_160ms_var(--ease-out)] active:scale-[0.985]"
        style={{
          background: "hsl(var(--card))",
          borderColor: "hsl(var(--border))",
          padding: "24px 22px 22px 26px",
        }}
      >
        {/* Glowing green spine */}
        <div
          aria-hidden
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{
            background: "hsl(var(--success))",
            boxShadow: "0 0 24px 0 hsl(var(--success) / 0.55)",
          }}
        />

        <div className="flex flex-col gap-3.5">
          <div
            className="text-[11px] uppercase font-medium leading-none"
            style={{ letterSpacing: "0.18em", color: "hsl(var(--success))" }}
          >
            Ready
          </div>
          <div
            className="font-display"
            style={{
              fontSize: 38,
              lineHeight: 1,
              letterSpacing: "-0.03em",
              color: "hsl(var(--foreground))",
            }}
          >
            Close the night.
          </div>
          <div
            className="text-[13.5px] leading-[1.45]"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            Count the door, save your numbers.
          </div>
          <div
            className="self-start mt-1.5 inline-flex items-center gap-1.5 rounded-full border px-4 py-2"
            style={{
              borderColor: "hsl(var(--border))",
              color: "hsl(var(--foreground))",
            }}
          >
            <span className="text-[13px] font-medium">Open settle</span>
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
          </div>
        </div>
      </button>

      {/* Hotel teaser — quiet preview of Phase 3, no eyebrow needed (the bed
          icon + name communicate "next thing is your hotel" without a label). */}
      {show.hotel_name && (
        <a
          href={hotelNavHref ?? undefined}
          target={hotelNavHref ? "_blank" : undefined}
          rel={hotelNavHref ? "noopener noreferrer" : undefined}
          className="mt-[22px] flex items-center gap-3 rounded-[12px] border p-3 [transition:transform_160ms_var(--ease-out),background-color_160ms_var(--ease-out)] active:scale-[0.985]"
          style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
        >
          <div
            className="shrink-0 inline-flex items-center justify-center rounded-[10px]"
            style={{
              width: 38,
              height: 38,
              background: "var(--pastel-blue-bg)",
              color: "var(--pastel-blue-fg)",
            }}
          >
            <Bed className="h-[17px] w-[17px]" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="text-[14px] font-medium leading-tight truncate"
              style={{ color: "hsl(var(--foreground))" }}
            >
              {show.hotel_name}
            </div>
            {hotelTeaserSub && (
              <div
                className="text-[12px] leading-tight mt-0.5 truncate"
                style={{ color: "hsl(var(--muted-foreground))" }}
              >
                {hotelTeaserSub}
              </div>
            )}
          </div>
          <ChevronRight
            className="h-3.5 w-3.5 shrink-0"
            style={{ color: "hsl(var(--muted-foreground))" }}
          />
        </a>
      )}

      <SettleShowDialog show={show} open={settleOpen} onOpenChange={setSettleOpen} />
    </div>
  );
}
