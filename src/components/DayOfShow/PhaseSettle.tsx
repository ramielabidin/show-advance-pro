import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { ArrowRight, Bed, Check, ChevronRight } from "lucide-react";
import { to12Hour } from "@/lib/timeFormat";
import { formatCityState } from "@/lib/utils";
import SettleShowDialog from "@/components/SettleShowDialog";
import type { Show, ScheduleEntry } from "@/lib/types";
import { showDayMinutes } from "./timeUtils";

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

  // Schedule entries with parseable times, sorted into show-day order so
  // a 12:30 AM curfew lands at the end (not the start).
  const sortedEntries = useMemo<{ entry: ScheduleEntry; min: number }[]>(() => {
    const entries = (show.schedule_entries ?? [])
      .map((entry) => ({ entry, min: showDayMinutes(entry.time) }))
      .filter((row): row is { entry: ScheduleEntry; min: number } => row.min !== null);
    entries.sort((a, b) => {
      if (a.min !== b.min) return a.min - b.min;
      return a.entry.sort_order - b.entry.sort_order;
    });
    return entries;
  }, [show.schedule_entries]);

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
      {/* Eyebrow + venue context — Phase 2 needs a sense of place so the
          wrap-up moment doesn't feel suspended in air. Eyebrow stays at
          Phase 1's pt-[14px] rhythm; venue lands below in the display
          font at roughly half the scale of Phase 1's hero, so it reads
          as "context for the moment" not "the primary information." */}
      <div className="pt-[14px] mb-5">
        <div
          className="text-[11px] uppercase font-medium leading-none mb-3"
          style={{ letterSpacing: "0.18em", color: "hsl(var(--muted-foreground))" }}
        >
          Show's done.
        </div>
        {show.venue_name && (
          <div
            className="font-display leading-[1.05]"
            style={{
              fontSize: "clamp(26px, 7vw, 32px)",
              letterSpacing: "-0.02em",
              color: "hsl(var(--foreground))",
            }}
          >
            {show.venue_name}
          </div>
        )}
        {show.city && (
          <div
            className="mt-2 font-mono text-[12.5px] leading-tight"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            {formatCityState(show.city)}
          </div>
        )}
      </div>

      {/* Settle CTA — slide-to-confirm. Settle is the only money-touching
          action in Day of Show; the drag-past-92% gesture makes accidental
          triggering essentially impossible while still feeling like a
          single satisfying motion. Display headline calls the action;
          the venue context block above already names where we are.
          Variant E from the design handoff. */}
      <div className="flex flex-col gap-3 py-1">
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
          Count the door, save your numbers. About five minutes.
        </div>
        <SlideToSettle onConfirm={() => setSettleOpen(true)} />
      </div>

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

      {/* Night-timeline footer — visual recap of the night. Decorative, not
          functional: it doesn't change what the user does next, but it
          anchors the screen and gives the wrap-up moment some weight. The
          band's set is the haloed dot; everything else is a small dot on
          the rule. Anchors at the edges show the night's span. */}
      {sortedEntries.length >= 2 && (
        <div className="mt-auto pt-7">
          <div className="flex items-baseline justify-between mb-2.5">
            <span
              className="text-[10px] uppercase font-medium leading-none"
              style={{ letterSpacing: "0.18em", color: "hsl(var(--muted-foreground))" }}
            >
              Tonight, in full
            </span>
            <span
              className="font-mono text-[11px]"
              style={{ color: "hsl(var(--muted-foreground))" }}
            >
              {sortedEntries.length} cues
            </span>
          </div>
          <div className="relative h-8">
            {/* Horizontal rule */}
            <div
              aria-hidden
              className="absolute left-0 right-0 top-1/2 h-px"
              style={{
                background: "hsl(var(--border))",
                transform: "translateY(-50%)",
              }}
            />
            {/* Dots */}
            {(() => {
              const startMin = sortedEntries[0].min;
              const endMin = sortedEntries[sortedEntries.length - 1].min;
              const span = Math.max(endMin - startMin, 1);
              return sortedEntries.map(({ entry, min }) => {
                const pos = ((min - startMin) / span) * 100;
                const isBand = !!entry.is_band;
                const size = isBand ? 10 : 6;
                const display = to12Hour(entry.time) ?? entry.time;
                // Sparkler: each dot fades + scales in with delay
                // proportional to its left% position. 0% → 0ms,
                // 100% → 400ms. Combined with the 280ms duration, the
                // last dot settles ~680ms after Phase 2 mount — quick
                // enough to feel responsive, slow enough to read as a
                // sweep rather than all-at-once.
                const delayMs = Math.round(pos * 4);
                return (
                  <div
                    key={entry.id}
                    title={`${display} — ${entry.label}`}
                    className="timeline-dot absolute top-1/2 rounded-full"
                    style={{
                      left: `${pos}%`,
                      transform: "translate(-50%, -50%)",
                      width: size,
                      height: size,
                      background: isBand
                        ? "hsl(var(--badge-new))"
                        : "hsl(var(--muted-foreground))",
                      boxShadow: isBand
                        ? "0 0 0 3px hsl(var(--background)), 0 0 0 4px hsl(var(--badge-new) / 0.5)"
                        : "0 0 0 3px hsl(var(--background))",
                      animationDelay: `${delayMs}ms`,
                    }}
                  />
                );
              });
            })()}
          </div>
          <div
            className="flex justify-between mt-1.5 font-mono text-[10.5px]"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            <span>{compactTime(sortedEntries[0].entry.time)}</span>
            <span>{compactTime(sortedEntries[sortedEntries.length - 1].entry.time)}</span>
          </div>
        </div>
      )}

      <SettleShowDialog show={show} open={settleOpen} onOpenChange={setSettleOpen} />
    </div>
  );
}

/**
 * Slide-to-settle — physical confirm gesture. Drag the green knob right
 * past 92% of the track to fire `onConfirm`. Below threshold the knob
 * snaps back. Idle knob has the mic-chip-pulse halo so the affordance
 * reads as "active / try me"; once dragging, the halo disappears and
 * the track fill follows progress. Variant E from the design handoff.
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

  // Recompute usable distance on mount + viewport resize. Pixel value
  // is required because CSS `translate(%)` is self-relative to the knob,
  // not the track.
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
      className="relative mt-2.5 overflow-hidden rounded-full border select-none"
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

/** "3:00 PM" → "3:00pm" — compact lowercase form for the timeline anchors. */
function compactTime(raw: string): string {
  const t = to12Hour(raw);
  if (!t) return raw;
  return t.replace(" ", "").toLowerCase();
}
