import { to24Hour } from "@/lib/timeFormat";

/**
 * Parse a free-text time into minutes past midnight, or null if unparseable.
 * Wraps `to24Hour` so we accept the same wide range of formats user / AI / CSV
 * imports may produce.
 */
export function timeToMinutes(raw: string | null | undefined): number | null {
  const h24 = to24Hour(raw);
  if (h24 === null) return null;
  const [h, m] = h24.split(":").map((n) => parseInt(n, 10));
  return h * 60 + m;
}

/**
 * Split a 24h time into 12-hour display parts for the hero countdown
 * typography, where AM/PM renders smaller alongside the number.
 *
 *   "16:00" → { n: "4",    u: "PM" }
 *   "06:30" → { n: "6:30", u: "AM" }
 *   "00:00" → { n: "12",   u: "AM" }
 *   "12:00" → { n: "12",   u: "PM" }
 */
export function fmt12parts(raw: string | null | undefined): { n: string; u: string } {
  const h24 = to24Hour(raw);
  if (h24 === null) return { n: raw ?? "", u: "" };
  const [hStr, mStr] = h24.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  const n = m === 0 ? `${h12}` : `${h12}:${mStr}`;
  return { n, u: period };
}

/**
 * Format a positive duration in minutes as "in 1 hr 10 min" / "in 40 min" /
 * "in 1 hr". Returns "now" for non-positive input — callers can swap in their
 * own copy for past states if needed.
 */
export function formatRelative(minutes: number): string {
  if (minutes <= 0) return "now";
  if (minutes < 60) return `in ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `in ${h} hr ${m} min` : `in ${h} hr`;
}
