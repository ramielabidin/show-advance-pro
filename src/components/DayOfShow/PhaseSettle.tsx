import { useState, useRef, useEffect, useCallback } from "react";
import { ArrowRight, Check } from "lucide-react";
import SettleShowDialog from "@/components/SettleShowDialog";
import PlaceFooter from "./PlaceFooter";
import type { Show } from "@/lib/types";

interface PhaseSettleProps {
  show: Show;
}

/**
 * Phase 2 surface — the show is done, time to wrap. Single dominant
 * Settle CTA centered on the screen, plus the shared place footer
 * underneath. Financial inputs live in SettleShowDialog (mounted on
 * demand). The screen has only one job — settle — so we don't crowd
 * it with eyebrows, headlines, subheads, or hotel teasers. The hotel
 * has its own dedicated surface in Phase 3b.
 */
export default function PhaseSettle({ show }: PhaseSettleProps) {
  const [settleOpen, setSettleOpen] = useState(false);

  return (
    <div className="px-[22px] pt-2 pb-7 flex-1 flex flex-col">
      <div className="flex-1 flex items-center">
        <SlideToSettle onConfirm={() => setSettleOpen(true)} />
      </div>

      <PlaceFooter
        venueName={show.venue_name}
        city={show.city}
        address={show.venue_address}
      />

      <SettleShowDialog show={show} open={settleOpen} onOpenChange={setSettleOpen} />
    </div>
  );
}

/**
 * Slide-to-settle — physical confirm gesture. Drag the green knob
 * right past 92% of the track to fire `onConfirm`. Below threshold
 * the knob snaps back. Idle knob has the mic-chip-pulse halo so the
 * affordance reads as "active / try me"; once dragging, the halo
 * disappears and the track fill follows progress.
 *
 * Why a slide instead of a tap: settle is the only money-touching
 * commit in Day of Show. The drag gesture makes accidental triggering
 * essentially impossible while still feeling like a single satisfying
 * motion. Keyboard fallback (Enter / Space on the focused knob) is
 * the escape hatch for users who can't drag.
 */
const KNOB = 52;
const PAD = 4;

function SlideToSettle({ onConfirm }: { onConfirm: () => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [usable, setUsable] = useState(0);

  useEffect(() => {
    const measure = () => {
      const el = trackRef.current;
      if (!el) return;
      setUsable(
        Math.max(0, el.getBoundingClientRect().width - KNOB - PAD * 2),
      );
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const updateFromClient = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el || usable <= 0) return;
      const r = el.getBoundingClientRect();
      const x = Math.max(
        0,
        Math.min(usable, clientX - r.left - PAD - KNOB / 2),
      );
      setProgress(x / usable);
    },
    [usable],
  );

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => updateFromClient(e.clientX);
    const up = () => {
      setDragging(false);
      setProgress((p) => {
        if (p >= 0.92) {
          setConfirmed(true);
          window.setTimeout(() => onConfirm(), 220);
          return 1;
        }
        return 0;
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [dragging, updateFromClient, onConfirm]);

  const start = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(true);
    updateFromClient(e.clientX);
  };

  const fillAlpha = 0.18 + progress * 0.42;
  const fillStop = Math.max(20, 60 - progress * 30);
  const knobX = progress * usable;

  return (
    <div
      ref={trackRef}
      className="w-full relative overflow-hidden rounded-full border select-none"
      style={{
        height: 60,
        background: "hsl(var(--card))",
        borderColor: "hsl(var(--border))",
        touchAction: "none",
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `linear-gradient(90deg, hsl(var(--success) / ${fillAlpha}) 0%, hsl(var(--success) / 0) ${fillStop}%)`,
          transition: dragging ? "none" : "background 220ms ease",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 flex items-center justify-center text-[11px] uppercase font-medium leading-none"
        style={{
          letterSpacing: "0.22em",
          color: "hsl(var(--muted-foreground))",
          paddingLeft: 56,
          opacity: 1 - Math.min(1, progress * 1.6),
          transition: dragging ? "none" : "opacity 220ms ease",
        }}
      >
        <span>{confirmed ? "Opening…" : "Slide to settle"}</span>
        <ArrowRight
          className="ml-2.5 h-[15px] w-[15px]"
          strokeWidth={1.6}
          style={{ opacity: 0.55 }}
        />
      </div>
      <div
        role="slider"
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={progress}
        aria-label="Slide to settle"
        tabIndex={0}
        onPointerDown={start}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setConfirmed(true);
            setProgress(1);
            window.setTimeout(() => onConfirm(), 220);
          }
        }}
        className={progress > 0.05 || dragging ? "" : "mic-chip-pulse"}
        style={{
          position: "absolute",
          top: PAD,
          left: PAD,
          width: KNOB,
          height: KNOB,
          borderRadius: 999,
          background: "hsl(var(--success))",
          color: "hsl(var(--success-foreground))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: dragging ? "grabbing" : "grab",
          boxShadow: "0 6px 18px hsl(152 60% 30% / 0.5)",
          transform: `translateX(${knobX}px)`,
          transition: dragging
            ? "none"
            : "transform 260ms cubic-bezier(.2,.8,.2,1)",
          touchAction: "none",
        }}
      >
        {confirmed ? (
          <Check className="h-5 w-5" strokeWidth={2.2} />
        ) : (
          <ArrowRight className="h-5 w-5" strokeWidth={2.2} />
        )}
      </div>
    </div>
  );
}
