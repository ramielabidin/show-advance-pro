import type { Show } from "@/lib/types";

/**
 * Lead-in copy as a confident, time-aware statement. Each variant is
 * a self-contained line that names the moment without instructing the
 * user — the screen below speaks for itself, so the lead-in doesn't
 * need a "go to bed / drive safe" branch. Avoids "safe" doubling.
 *
 * Buckets:
 *   pre-midnight (9 PM–11:59 PM): "That's the show."
 *   post-midnight (00:00–02:59):  "That's a long one."
 *   pre-dawn (03:00–04:59):       "Almost dawn."
 *   morning (05:00–07:59, rare):  "Show's in the books."
 *
 * (After 8 AM the overlay auto-resolves itself.)
 */
function leadInCopy(nowHour: number): string {
  if (nowHour >= 5 && nowHour < 8) return "Show's in the books.";
  if (nowHour >= 3 && nowHour < 5) return "Almost dawn.";
  if (nowHour < 3) return "That's a long one.";
  return "That's the show.";
}

/**
 * Pool of sign-offs picked deterministically by show date so the same
 * show always shows the same line (stable across re-opens) but the
 * line varies day-to-day across a tour.
 */
const SIGN_OFFS = [
  "Good night.",
  "Sleep well.",
  "Until tomorrow.",
  "Rest up.",
  "See you in the morning.",
  "Until the next one.",
];

function signOffFor(date: string): string {
  const seed = date.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return SIGN_OFFS[seed % SIGN_OFFS.length];
}

interface PhasePostSettleProps {
  show: Show;
}

/**
 * Phase 3 — settled. Intentionally minimal: a confident time-aware
 * lead-in at top, a delicate hand-drawn done-mark filling the middle,
 * and a sign-off pinned to the bottom. The hotel reveal that used to
 * live here was redundant — Phase 2 already shows a hotel teaser, and
 * the show detail page has the full booking. Phase 3 is for closing
 * the moment, not surfacing more data.
 */
export default function PhasePostSettle({ show }: PhasePostSettleProps) {
  return (
    <div className="px-[22px] pt-2 pb-7 flex-1 flex flex-col">
      {/* Lead-in — big display statement that names the moment. Clamps
          38–52px, wraps via textWrap: balance for clean two-line breaks. */}
      <div className="pt-[14px] pb-3">
        <div
          className="font-display"
          style={{
            fontSize: "clamp(38px, 11vw, 52px)",
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            color: "hsl(var(--foreground))",
            textWrap: "balance",
          }}
        >
          {leadInCopy(new Date().getHours())}
        </div>
      </div>

      {/* Done-mark — the closing flourish. Centered in the middle of the
          available space, sized to feel substantial but not loud. The
          three-part animation (ring stroke → check stroke → tiny serif
          punctuation dot) sequences ~1.5s on phase entry. */}
      <div className="flex-1 flex items-center justify-center py-6">
        <DoneMark />
      </div>

      {/* Sign-off — pinned to the bottom. Pool varies by show date so
          the line changes day-to-day across a tour without ever feeling
          random within a single show's repeat opens. */}
      <div className="text-center">
        <div
          className="font-display gentle-breathe"
          style={{
            fontSize: 22,
            lineHeight: 1.2,
            letterSpacing: "-0.02em",
            color: "hsl(var(--foreground))",
          }}
        >
          {signOffFor(show.date)}
        </div>
        <div
          className="mt-1 text-[12px]"
          style={{ color: "hsl(var(--muted-foreground))" }}
        >
          This view closes itself in the morning.
        </div>
      </div>
    </div>
  );
}

/**
 * The closing flourish — a delicate hand-drawn check inside a barely-
 * there outline circle, with a tiny serif punctuation dot floating off
 * the upper right as a hand-written grace note. Sequenced via per-
 * element animation classes (see `.done-mark` in index.css):
 *   ring stroke draws first  (~1.1s)
 *   check stroke draws       (520ms after a 720ms delay)
 *   serif punctuation dot    (320ms after a 1180ms delay)
 *
 * Path math: circle r=32 has circumference ≈ 201, so dasharray 201 /
 * dashoffset 201 → 0 fully draws it. The check path "M 23 37 L 33 47
 * L 51 27" totals ≈ 46. Reduced-motion resolves all three to their
 * final state without animation.
 */
function DoneMark() {
  return (
    <div
      className="done-mark relative"
      style={{ width: 96, height: 96 }}
      aria-hidden
    >
      <svg viewBox="0 0 72 72" width={96} height={96} className="block">
        <circle
          className="done-circle"
          cx="36"
          cy="36"
          r="32"
          fill="none"
          stroke="hsl(var(--muted-foreground) / 0.55)"
          strokeWidth="1"
        />
        <path
          className="done-check"
          d="M 23 37 L 33 47 L 51 27"
          fill="none"
          stroke="hsl(var(--foreground))"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          className="done-dot"
          cx="56"
          cy="20"
          r="1.4"
          fill="hsl(var(--foreground))"
        />
      </svg>
    </div>
  );
}
