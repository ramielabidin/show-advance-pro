/** Normalize free-text time to "H:MM AM/PM" format. Returns original if unparseable. */
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

  // Convert 24h to 12h if needed
  if (hours >= 13 && !ampm) {
    ampm = "PM";
    hours -= 12;
  } else if (hours === 0 && !ampm) {
    ampm = "AM";
    hours = 12;
  } else if (hours === 12 && !ampm) {
    ampm = "PM";
  }

  // Default to PM for ambiguous times
  if (!ampm) ampm = "PM";

  if (hours > 12) return raw;

  return `${hours}:${minutes.toString().padStart(2, "0")} ${ampm}`;
}
