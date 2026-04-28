import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Phone, ArrowUpRight } from "lucide-react";
import { to24Hour } from "@/lib/timeFormat";
import { roleLabel } from "@/lib/contactRoles";
import { normalizePhone, formatCityState } from "@/lib/utils";
import type { Show, ScheduleEntry } from "@/lib/types";
import ActionCard from "./ActionCard";
import ScheduleList from "./ScheduleList";
import { fmt12parts, formatRelative, showDayMinutes } from "./timeUtils";

interface PhasePreShowProps {
  show: Show;
  /** Current local time as minutes past midnight. Drives the hero + dim states. */
  nowMin: number;
}

/**
 * Phase 1 surface — pre-show. Hero is the next schedule moment, with the
 * clock time as the typographic flex and the countdown demoted to a subtitle
 * (per the design feedback round). Schedule list, then a 2-up DOS contact +
 * guest list count, then a full-width venue navigate row.
 */
export default function PhasePreShow({ show, nowMin }: PhasePreShowProps) {
  const navigate = useNavigate();
  const sortedEntries = useMemo<ScheduleEntry[]>(() => {
    const entries = [...(show.schedule_entries ?? [])];
    entries.sort((a, b) => {
      // Use show-day minutes so post-midnight events (curfew, load-out)
      // sort AFTER the preceding evening's load-in / soundcheck / set.
      const am = showDayMinutes(a.time);
      const bm = showDayMinutes(b.time);
      if (am === null && bm === null) return a.sort_order - b.sort_order;
      if (am === null) return 1;
      if (bm === null) return -1;
      if (am !== bm) return am - bm;
      return a.sort_order - b.sort_order;
    });
    return entries;
  }, [show.schedule_entries]);

  // Hero = first entry whose time is in the future (>= now). If everything is
  // past, fall back to the last entry (the curfew/load-out has just happened).
  // Comparison uses show-day minutes so a curfew at 12:30 AM is correctly
  // seen as "in 35 min" at 11:55 PM, not as "23.5 hours away".
  const heroIndex = useMemo(() => {
    const idx = sortedEntries.findIndex((e) => {
      const m = showDayMinutes(e.time);
      return m !== null && m >= nowMin;
    });
    if (idx !== -1) return idx;
    return sortedEntries.length > 0 ? sortedEntries.length - 1 : null;
  }, [sortedEntries, nowMin]);

  const hero = heroIndex !== null ? sortedEntries[heroIndex] : null;
  const heroMin = hero ? showDayMinutes(hero.time) : null;
  const remaining = heroMin !== null ? heroMin - nowMin : null;
  const isFuture = remaining !== null && remaining > 0;

  const heroParts = hero ? fmt12parts(to24Hour(hero.time) ?? hero.time) : null;

  const dosContact = useMemo(
    () => (show.show_contacts ?? []).find((c) => c.role === "day_of_show") ?? null,
    [show.show_contacts],
  );

  const venueNavHref = useMemo(() => {
    const target = [show.venue_address, formatCityState(show.city || "")].filter(Boolean).join(", ");
    if (!target) return undefined;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(target)}`;
  }, [show.venue_address, show.city]);

  /**
   * Split a free-text address into clean stacked lines for the venue column.
   * "25 Temple St, Portland, ME 04101" → ["25 Temple St", "Portland, ME 04101"]
   * — first comma splits street vs. the rest. Falls back to formatted city
   * when there's no address. Returns an empty array if there's nothing to show.
   */
  function addressLines(address: string | null | undefined, city: string | null | undefined): string[] {
    if (address?.trim()) {
      const parts = address.split(",").map((s) => s.trim()).filter(Boolean);
      if (parts.length <= 1) return parts;
      const [street, ...rest] = parts;
      return [street, rest.join(", ")];
    }
    const fallback = formatCityState(city || "");
    return fallback ? [fallback] : [];
  }

  return (
    <div className="px-[22px] pt-2 pb-7 flex-1 flex flex-col">
      {/* Hero — two columns sharing structure but differing in scale.
          Left = when (temporal hero), right = where (venue as quiet
          mirrored typography, no card chrome). Eyebrows align at the top
          baseline so the two sides read as one rhythm. */}
      <div className="pt-[14px] pb-1 grid grid-cols-[1fr_1fr] gap-6 items-start">
        {/* Time column */}
        <div className="min-w-0 pr-3" data-stagger="0">
          <div
            className="text-[11px] uppercase font-medium leading-none mb-2.5"
            style={{ letterSpacing: "0.18em", color: "hsl(var(--muted-foreground))" }}
          >
            {isFuture ? "Up next" : "Now"}
          </div>

          {hero && (
            <>
              <div
                className="text-[26px] font-medium leading-[1.05] truncate"
                style={{ letterSpacing: "-0.02em", color: "hsl(var(--foreground))" }}
              >
                {hero.label}
              </div>

              {/* Big serif TIME — the operative number */}
              {heroParts && (
                <div
                  className="mt-[16px] flex items-baseline gap-2 tabular-nums"
                  style={{ letterSpacing: "-0.03em" }}
                >
                  <span
                    className="font-display"
                    style={{
                      fontSize: 82,
                      lineHeight: 0.92,
                      color: "hsl(var(--foreground))",
                    }}
                  >
                    {heroParts.n}
                  </span>
                  <span
                    className="font-display"
                    style={{
                      fontSize: 28,
                      lineHeight: 0.92,
                      letterSpacing: "-0.02em",
                      color: "hsl(var(--muted-foreground))",
                    }}
                  >
                    {heroParts.u}
                  </span>
                </div>
              )}

              {/* Countdown — supporting context */}
              {remaining !== null && (
                <div
                  className="mt-3 text-[15px] font-medium leading-[1.2]"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                >
                  {isFuture ? formatRelative(remaining) : "now"}
                </div>
              )}
            </>
          )}
        </div>

        {/* Venue column — quiet typography mirror. No border, no card.
            Whole column is one tap target → opens system maps. */}
        {show.venue_name && (
          <a
            href={venueNavHref ?? undefined}
            target={venueNavHref ? "_blank" : undefined}
            rel={venueNavHref ? "noopener noreferrer" : undefined}
            data-stagger="0"
            className="text-left flex flex-col items-stretch min-w-0 [transition:transform_160ms_var(--ease-out)] active:scale-[0.985]"
          >
            <div className="flex items-center justify-between mb-2.5">
              <span
                className="text-[11px] uppercase font-medium leading-none"
                style={{ letterSpacing: "0.18em", color: "hsl(var(--muted-foreground))" }}
              >
                Venue
              </span>
              {venueNavHref && (
                <ArrowUpRight
                  className="h-3.5 w-3.5 shrink-0"
                  strokeWidth={1.75}
                  style={{ color: "hsl(var(--muted-foreground))" }}
                />
              )}
            </div>
            <div
              className="font-display leading-[1.1] break-words"
              style={{
                fontSize: "clamp(18px, 4.8vw, 22px)",
                letterSpacing: "-0.02em",
                color: "hsl(var(--foreground))",
                textWrap: "pretty",
              }}
            >
              {show.venue_name}
            </div>
            {(show.venue_address || show.city) && (
              <div
                className="mt-2 font-mono text-[12px] leading-[1.45]"
                style={{ color: "hsl(var(--muted-foreground))" }}
              >
                {addressLines(show.venue_address, show.city).map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            )}
          </a>
        )}
      </div>

      {/* Schedule list */}
      {sortedEntries.length > 0 && (
        <div className="mt-6">
          <div
            className="text-[11px] uppercase font-medium leading-none mb-2"
            style={{ letterSpacing: "0.18em", color: "hsl(var(--muted-foreground))" }}
          >
            Schedule
          </div>
          <ScheduleList entries={sortedEntries} nowMin={nowMin} heroIndex={heroIndex} />
        </div>
      )}

      {/* Single action — day-of contact. Guest list, set list, etc. live on
          the show detail page; this surface stays focused on the in-the-moment
          ask: "who do I call right now". */}
      <div className="mt-[22px]" data-stagger="3">
        <ActionCard
          icon={Phone}
          eyebrow="Day-of contact"
          title={dosContact?.name ?? null}
          sub={
            dosContact
              ? [roleLabel(dosContact), dosContact.phone ? normalizePhone(dosContact.phone) : null]
                  .filter(Boolean)
                  .join(" · ") || null
              : "Not set"
          }
          href={dosContact?.phone ? `tel:${dosContact.phone}` : undefined}
          onClick={
            dosContact?.phone
              ? undefined
              : () => navigate(`/shows/${show.id}?tab=contacts`)
          }
          fullWidth
        />
      </div>
    </div>
  );
}

