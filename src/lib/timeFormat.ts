/**
 * Parse a free-text time into `"HH:MM"` 24-hour format, or `null` if unparseable.
 *
 * Accepts a wide range of inputs so display code doesn't have to babysit
 * differences between user-typed, AI-parsed, and CSV-imported entries:
 *   "7:00 PM", "7:00pm", "7 PM", "7p", "19:00", "19:00:00", "1900", "7".
 * Returns `null` for blanks, "TBD", "N/A", or anything else that can't be
 * coerced into a valid clock time.
 */
export function to24Hour(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s || /^(tbd|n\/a)$/i.test(s)) return null;

  let ampm: "AM" | "PM" | null = null;
  let body = s;
  const ampmMatch = body.match(/\s*(a\.?m?\.?|p\.?m?\.?)\s*$/i);
  if (ampmMatch) {
    ampm = ampmMatch[1][0].toLowerCase() === "a" ? "AM" : "PM";
    body = body.slice(0, ampmMatch.index).trim();
  }

  let hours: number | null = null;
  let minutes = 0;

  const colon = body.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (colon) {
    hours = parseInt(colon[1], 10);
    minutes = parseInt(colon[2], 10);
  } else if (/^\d{3,4}$/.test(body)) {
    const n = parseInt(body, 10);
    hours = Math.floor(n / 100);
    minutes = n % 100;
  } else if (/^\d{1,2}$/.test(body)) {
    hours = parseInt(body, 10);
  }

  if (hours === null) return null;
  if (minutes < 0 || minutes > 59) return null;
  if (hours < 0 || hours > 23) return null;

  if (ampm === "PM" && hours < 12) hours += 12;
  else if (ampm === "AM" && hours === 12) hours = 0;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * Parse a free-text time and render it as `"H:MM AM/PM"`, or `null` if
 * unparseable. Accepts the same inputs as {@link to24Hour}.
 */
export function to12Hour(raw: string | null | undefined): string | null {
  const h24 = to24Hour(raw);
  if (h24 === null) return null;
  const [hStr, mStr] = h24.split(":");
  const h = parseInt(hStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${mStr} ${ampm}`;
}

/** Normalize free-text time. AM/PM is preserved if provided, omitted if not. */
export function normalizeTime(raw: string): string {
  const s = raw.trim();
  if (!s) return s;

  let ampm: "AM" | "PM" | null = null;
  let cleaned = s;

  // Extract AM/PM suffix
  const ampmMatch = cleaned.match(/\s*(a|am|p|pm)\s*$/i);
  if (ampmMatch) {
    ampm = ampmMatch[1].toLowerCase().startsWith("a") ? "AM" : "PM";
    cleaned = cleaned.slice(0, ampmMatch.index).trim();
  }

  let hours: number | null = null;
  let minutes = 0;

  // "3:30" or "15:30"
  const colonMatch = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (colonMatch) {
    hours = parseInt(colonMatch[1], 10);
    minutes = parseInt(colonMatch[2], 10);
  }
  // "1530" or "930" (3-4 digits, no colon)
  else if (/^\d{3,4}$/.test(cleaned)) {
    const n = parseInt(cleaned, 10);
    hours = Math.floor(n / 100);
    minutes = n % 100;
  }
  // Single or double digit like "3" or "12"
  else if (/^\d{1,2}$/.test(cleaned)) {
    hours = parseInt(cleaned, 10);
    minutes = 0;
  }

  if (hours === null || minutes < 0 || minutes > 59) return raw;
  if (hours < 0 || hours > 23) return raw;

  // Convert 24h to 12h only if explicit AM/PM was given or hour > 12
  if (ampm && hours > 12) {
    hours -= 12;
  } else if (!ampm && hours > 12) {
    // 24h input without AM/PM — convert to 12h with PM
    ampm = "PM";
    hours -= 12;
  } else if (!ampm && hours === 0) {
    ampm = "AM";
    hours = 12;
  } else if (ampm && hours === 0) {
    hours = 12;
  }

  if (hours > 12) return raw;

  const base = `${hours}:${minutes.toString().padStart(2, "0")}`;
  return ampm ? `${base} ${ampm}` : base;
}

/**
 * Format a hotel check-in / check-out moment for display. Combines an ISO
 * `date` (e.g. `"2026-05-03"`) with a free-text `time` (e.g. `"3:00 PM"`).
 *
 *   "2026-05-03" + "3:00 PM" → "Tue May 3 · 3:00 PM"
 *   "2026-05-03" + null      → "Tue May 3"
 *   null         + "3:00 PM" → "3:00 PM"
 *   null         + null      → ""
 *
 * Mirrors the (deliberately simple) format used by the email template and
 * guest day sheet so output stays consistent across surfaces.
 */
export function formatHotelMoment(
  date: string | null | undefined,
  time: string | null | undefined,
): string {
  const cleanTime = time?.trim() ? to12Hour(time) ?? time.trim() : "";
  const cleanDate = formatHotelDate(date);
  if (cleanDate && cleanTime) return `${cleanDate} · ${cleanTime}`;
  return cleanDate || cleanTime;
}

/** Format an ISO date string as `"Tue May 3"`. Returns `""` for invalid input. */
export function formatHotelDate(date: string | null | undefined): string {
  if (!date) return "";
  // Parse as a local date (YYYY-MM-DD) to avoid timezone drift on display.
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return "";
  const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
  const month = d.toLocaleDateString("en-US", { month: "short" });
  return `${weekday} ${month} ${d.getDate()}`;
}
