import { useEffect, useRef, useState } from "react";
import { format, parseISO, isPast, isToday } from "date-fns";
import { MapPin, ChevronRight, Sparkles, CheckCircle2, Trash2, Bus } from "lucide-react";
import { Link } from "react-router-dom";
import { cn, formatCityState } from "@/lib/utils";
import StatusDot from "@/components/StatusDot";
import type { Show } from "@/lib/types";

type ShowWithTour = Show & { tours?: { id: string; name: string } | null };

interface ShowCardProps {
  show: ShowWithTour;
  onDelete?: () => void;
  onRemoveFromTour?: () => void;
  /**
   * Tour-name presentation:
   * - "tour"       — colored pill inline with venue (Shows page, cross-tour browsing)
   * - "byline"     — mono uppercase caption below city (Dashboard, V2 editorial voice)
   * - "standalone" — muted "Standalone" pill (Shows page, untoured shows)
   * - "none"       — nothing
   */
  chip?: "tour" | "standalone" | "none" | "byline";
}

const REVEAL_WIDTH = 88;
const SNAP_THRESHOLD = 36;
const DRAG_LOCK_THRESHOLD = 8;
const RUBBER_BAND = 16;

const SNAP_TRANSITION =
  "transform 220ms var(--ease-out), color 150ms var(--ease-out), background-color 150ms var(--ease-out), border-color 150ms var(--ease-out), box-shadow 150ms var(--ease-out)";

export default function ShowCard({ show, onDelete, onRemoveFromTour, chip = "none" }: ShowCardProps) {
  const date = parseISO(show.date);
  const past = isPast(date) && !isToday(date);

  const [isHoverDevice, setIsHoverDevice] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  });
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(hover: hover) and (pointer: fine)");
    const handler = (e: MediaQueryListEvent) => setIsHoverDevice(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // Swipe-to-delete is touch-only. On hover-capable devices (mouse/trackpad)
  // we render the simple Link variant and rely on the hover-reveal trash icon
  // inside cardContent — keeps the two delete affordances cleanly separated
  // and prevents the red panel from bleeding through the card on click.
  const swipeEnabled = !!onDelete && !isHoverDevice;

  const [revealed, setRevealed] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const direction = useRef<"h" | "v" | null>(null);
  const moved = useRef(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Tap outside the card while revealed → snap closed.
  useEffect(() => {
    if (!revealed) return;
    const handler = (e: TouchEvent | MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setRevealed(false);
        setDragX(0);
      }
    };
    document.addEventListener("touchstart", handler, true);
    document.addEventListener("mousedown", handler, true);
    return () => {
      document.removeEventListener("touchstart", handler, true);
      document.removeEventListener("mousedown", handler, true);
    };
  }, [revealed]);

  const handleTouchStart: React.TouchEventHandler = (e) => {
    if (!swipeEnabled) return;
    const t = e.touches[0];
    startX.current = t.clientX;
    startY.current = t.clientY;
    direction.current = null;
    moved.current = false;
  };

  const handleTouchMove: React.TouchEventHandler = (e) => {
    if (!swipeEnabled || startX.current == null || startY.current == null) return;
    const t = e.touches[0];
    const dx = t.clientX - startX.current;
    const dy = t.clientY - startY.current;
    if (direction.current == null) {
      if (Math.abs(dx) > DRAG_LOCK_THRESHOLD || Math.abs(dy) > DRAG_LOCK_THRESHOLD) {
        direction.current = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
        if (direction.current === "h") setIsDragging(true);
      }
    }
    if (direction.current === "h") {
      moved.current = true;
      const base = revealed ? -REVEAL_WIDTH : 0;
      const next = Math.max(-(REVEAL_WIDTH + RUBBER_BAND), Math.min(0, base + dx));
      setDragX(next);
    }
  };

  const handleTouchEnd = () => {
    if (!swipeEnabled) return;
    if (direction.current === "h") {
      const shouldReveal = dragX < -SNAP_THRESHOLD;
      setRevealed(shouldReveal);
      setDragX(shouldReveal ? -REVEAL_WIDTH : 0);
    }
    setIsDragging(false);
    startX.current = null;
    startY.current = null;
    direction.current = null;
  };

  const handleClick: React.MouseEventHandler = (e) => {
    if (moved.current) {
      e.preventDefault();
      moved.current = false;
      return;
    }
    if (revealed) {
      e.preventDefault();
      setRevealed(false);
      setDragX(0);
    }
  };

  const handleSwipeDelete: React.MouseEventHandler = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setRevealed(false);
    setDragX(0);
    onDelete?.();
  };

  // Venue is the focal point when no chip competes with it (Dashboard "byline"
  // mode, or chipless usage). Bump up the type a step so it claims the card.
  const venueIsHero = chip === "byline" || chip === "none";

  const cardContent = (
    <>
      <div className="flex items-center gap-3 sm:gap-5 min-w-0">
        <div className="text-center w-12 sm:w-14 shrink-0">
          <div className="text-[10px] sm:text-xs font-medium uppercase text-muted-foreground">
            {format(date, "MMM")}
          </div>
          <div className="text-xl sm:text-2xl font-display text-foreground leading-tight">
            {format(date, "d")}
          </div>
          <div className="text-[10px] sm:text-xs text-muted-foreground">{format(date, "EEE")}</div>
        </div>
        <div className="border-l pl-3 sm:pl-5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3
              className={cn(
                "font-medium text-foreground truncate min-w-0",
                venueIsHero ? "text-base sm:text-lg" : "text-sm sm:text-base",
              )}
            >
              {show.venue_name}
            </h3>
            {chip === "tour" && show.tours?.name && (
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium shrink-0"
                style={{ backgroundColor: "var(--pastel-blue-bg)", color: "var(--pastel-blue-fg)" }}
              >
                {show.tours.name}
              </span>
            )}
            {chip === "standalone" && (
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground shrink-0">
                Standalone
              </span>
            )}
            {!show.is_reviewed && (
              <span className="inline-flex items-center text-[10px] uppercase tracking-wider font-mono text-badge-new shrink-0">
                <Sparkles className="h-3 w-3 mr-1" strokeWidth={2} />
                New
              </span>
            )}
            {show.is_settled && (
              <span
                className="inline-flex items-center text-[10px] uppercase tracking-wider font-mono shrink-0"
                style={{ color: "var(--pastel-green-fg)" }}
              >
                <CheckCircle2 className="h-3 w-3 mr-1" strokeWidth={2} />
                Settled
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground mt-0.5">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{formatCityState(show.city)}</span>
          </div>
          {/* Mobile-only byline (below city). Desktop renders it in the right column for balance.
              The leading "↳" glyph acts as a typographic kicker — "extends from above" — and
              creates a small editorial indent. Desktop drops the glyph since the byline lives
              in its own right column there and the narrative tie is gone. */}
          {chip === "byline" && show.tours?.name && (
            <div className="sm:hidden mt-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-mono text-muted-foreground/80">
              <Bus className="h-3 w-3 shrink-0" strokeWidth={1.75} aria-hidden />
              <span className="truncate">{show.tours.name}</span>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-2">
        {/* Desktop-only byline — sits as a right-margin caption, balancing the card horizontally. */}
        {chip === "byline" && show.tours?.name && (
          <div className="hidden sm:flex items-center gap-1.5 max-w-[240px] mr-2 text-[10px] uppercase tracking-widest font-mono text-muted-foreground/80">
            <Bus className="h-3 w-3 shrink-0" strokeWidth={1.75} aria-hidden />
            <span className="truncate">{show.tours.name}</span>
          </div>
        )}
        <StatusDot show={show} />
        {onRemoveFromTour && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemoveFromTour();
            }}
            className="hidden sm:inline-flex px-2 py-1 rounded-md text-xs text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 [transition:color_150ms_var(--ease-out),background-color_150ms_var(--ease-out),opacity_150ms_var(--ease-out)]"
          >
            Remove
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete();
            }}
            className="hidden sm:inline-flex p-1.5 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 [transition:color_150ms_var(--ease-out),background-color_150ms_var(--ease-out),opacity_150ms_var(--ease-out)]"
            aria-label="Delete show"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block" />
      </div>
    </>
  );

  if (!swipeEnabled) {
    return (
      <Link
        to={`/shows/${show.id}`}
        className={cn(
          "group flex items-center justify-between rounded-lg border bg-card p-3 sm:p-4 card-pressable transition-colors hover:border-foreground/20 hover:shadow-sm active:bg-accent/50",
          past && "opacity-60",
        )}
      >
        {cardContent}
      </Link>
    );
  }

  return (
    <div
      ref={wrapperRef}
      className={cn("relative rounded-lg overflow-hidden", past && "opacity-60")}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      style={{ touchAction: "pan-y" }}
    >
      <button
        type="button"
        onClick={handleSwipeDelete}
        aria-label="Delete show"
        aria-hidden={!revealed}
        tabIndex={revealed ? 0 : -1}
        className="absolute inset-y-0 right-0 flex flex-col items-center justify-center gap-1 bg-destructive text-destructive-foreground active:bg-destructive/90 [transition:background-color_150ms_var(--ease-out)]"
        style={{ width: REVEAL_WIDTH }}
      >
        <Trash2 className="h-5 w-5" strokeWidth={1.75} />
        <span className="text-[11px] font-medium tracking-wide">Delete</span>
      </button>
      <Link
        to={`/shows/${show.id}`}
        onClick={handleClick}
        className="relative group flex items-center justify-between rounded-lg border bg-card p-3 sm:p-4 card-pressable hover:border-foreground/20 hover:shadow-sm active:bg-accent/50"
        style={{
          transform: `translateX(${dragX}px)`,
          transition: isDragging ? "none" : SNAP_TRANSITION,
        }}
      >
        {cardContent}
      </Link>
    </div>
  );
}
