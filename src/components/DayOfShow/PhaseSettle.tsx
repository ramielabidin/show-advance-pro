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

      {/* Big Settle CTA — the dominant moment of the screen */}
      <button
        type="button"
        onClick={() => setSettleOpen(true)}
        className="w-full text-left rounded-[18px] [transition:transform_160ms_var(--ease-out)] active:scale-[0.985]"
        style={{
          background: "hsl(var(--success))",
          padding: "34px 22px",
          boxShadow:
            "0 14px 40px hsl(152 60% 30% / 0.45), inset 0 1px 0 hsl(0 0% 100% / 0.15)",
          color: "#fff",
        }}
      >
        <div
          className="text-[11px] uppercase font-medium leading-none mb-3.5"
          style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.78)" }}
        >
          Wrap it up
        </div>
        <div
          className="font-display"
          style={{ fontSize: 44, lineHeight: 1, letterSpacing: "-0.03em" }}
        >
          Settle this show
        </div>
        <div
          className="mt-3.5 text-[13.5px] leading-[1.4]"
          style={{ color: "rgba(255,255,255,0.85)" }}
        >
          Count the door, close the night, save your numbers.
        </div>
        <div
          className="mt-3.5 inline-flex items-center gap-1.5 text-[13px] font-medium"
          style={{ color: "rgba(255,255,255,0.95)" }}
        >
          Open settle
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
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
