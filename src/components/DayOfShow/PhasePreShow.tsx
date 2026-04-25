import { useMemo } from "react";
import { Phone, Users, Navigation } from "lucide-react";
import { to24Hour } from "@/lib/timeFormat";
import { roleLabel } from "@/lib/contactRoles";
import { normalizePhone, formatCityState } from "@/lib/utils";
import { parseGuestList, guestTotal } from "@/components/GuestListEditor";
import type { Show, ScheduleEntry } from "@/lib/types";
import ActionCard from "./ActionCard";
import ScheduleList from "./ScheduleList";
import { fmt12parts, formatRelative, timeToMinutes } from "./timeUtils";

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
  const sortedEntries = useMemo<ScheduleEntry[]>(() => {
    const entries = [...(show.schedule_entries ?? [])];
    entries.sort((a, b) => {
      const am = timeToMinutes(a.time);
      const bm = timeToMinutes(b.time);
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
  const heroIndex = useMemo(() => {
    const idx = sortedEntries.findIndex((e) => {
      const m = timeToMinutes(e.time);
      return m !== null && m >= nowMin;
    });
    if (idx !== -1) return idx;
    return sortedEntries.length > 0 ? sortedEntries.length - 1 : null;
  }, [sortedEntries, nowMin]);

  const hero = heroIndex !== null ? sortedEntries[heroIndex] : null;
  const heroMin = hero ? timeToMinutes(hero.time) : null;
  const remaining = heroMin !== null ? heroMin - nowMin : null;
  const isFuture = remaining !== null && remaining > 0;

  const heroParts = hero ? fmt12parts(to24Hour(hero.time) ?? hero.time) : null;

  const dosContact = useMemo(
    () => (show.show_contacts ?? []).find((c) => c.role === "day_of_show") ?? null,
    [show.show_contacts],
  );

  const guestCount = useMemo(
    () => guestTotal(parseGuestList(show.guest_list_details)),
    [show.guest_list_details],
  );

  const venueNavHref = useMemo(() => {
    const target = [show.venue_address, formatCityState(show.city || "")].filter(Boolean).join(", ");
    if (!target) return undefined;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(target)}`;
  }, [show.venue_address, show.city]);

  return (
    <div className="px-[22px] pt-2 pb-7 flex-1 flex flex-col">
      {/* Hero — clock time as the operative info, countdown demoted to subtitle */}
      <div className="pt-[14px] pb-1">
        <div
          className="text-[11px] uppercase font-medium leading-none mb-2.5"
          style={{ letterSpacing: "0.18em", color: "hsl(var(--muted-foreground))" }}
        >
          {isFuture ? "Up next" : "Now"}
        </div>

        {hero && (
          <>
            <div
              className="text-[28px] font-medium leading-[1.05]"
              style={{ letterSpacing: "-0.02em", color: "hsl(var(--foreground))" }}
            >
              {hero.label}
            </div>

            {/* Big serif TIME — the operative number */}
            {heroParts && (
              <div
                className="mt-[18px] flex items-baseline gap-2.5 tabular-nums"
                style={{ letterSpacing: "-0.05em" }}
              >
                <span
                  className="font-display"
                  style={{
                    fontSize: 110,
                    lineHeight: 0.9,
                    color: "hsl(var(--foreground))",
                  }}
                >
                  {heroParts.n}
                </span>
                <span
                  className="font-display"
                  style={{
                    fontSize: 38,
                    lineHeight: 0.9,
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
                className="mt-2 text-[14px] font-medium leading-[1.2]"
                style={{ color: "hsl(var(--muted-foreground))" }}
              >
                {isFuture ? formatRelative(remaining) : "now"}
              </div>
            )}
          </>
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

      {/* Action grid: 2-up DOS + Guest list, then full-width Venue */}
      <div className="mt-[22px] grid grid-cols-2 gap-2.5">
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
        />
        <ActionCard
          icon={Users}
          eyebrow="Guest list"
          title={String(guestCount)}
          sub={guestCount === 0 ? "no guests yet" : "confirmed names"}
          titleMono
        />
      </div>

      <div className="mt-2.5">
        <ActionCard
          icon={Navigation}
          eyebrow="Venue"
          title={show.venue_name}
          sub={show.venue_address ?? formatCityState(show.city || "")}
          href={venueNavHref}
          variant="muted"
          showNavArrow
          fullWidth
        />
      </div>
    </div>
  );
}

