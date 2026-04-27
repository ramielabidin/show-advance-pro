// Resolve an IANA timezone (e.g. "America/Los_Angeles") for a show's venue.
//
// Uses the Google Geocoding API to turn an address/city into a lat/lng, then
// the Google Time Zone API to turn that lat/lng into an IANA id. The same
// `GOOGLE_PLACES_API_KEY` secret powers `lookup-venue-address`,
// `calculate-drive-time`, and `autocomplete-place` — the Geocoding and Time
// Zone APIs must be enabled on that key for this helper to work.

export interface VenueLike {
  venue_address?: string | null;
  city?: string | null;
  venue_name?: string | null;
}

export async function resolveVenueTimezone(
  venue: VenueLike,
  apiKey: string,
): Promise<string | null> {
  // Prefer the full venue address; fall back to venue name + city, then city
  // alone. An empty/unresolvable query returns null — the caller decides what
  // to do.
  const query =
    (venue.venue_address && venue.venue_address.trim()) ||
    [venue.venue_name, venue.city].filter(Boolean).join(", ") ||
    (venue.city ?? "");
  if (!query.trim()) return null;

  try {
    const geoUrl =
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`;
    const geoRes = await fetch(geoUrl);
    if (!geoRes.ok) {
      console.error("Geocoding HTTP error:", geoRes.status);
      return null;
    }
    const geo = await geoRes.json();
    const loc = geo?.results?.[0]?.geometry?.location;
    if (!loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") {
      console.warn("Geocoding returned no location for:", query, geo?.status);
      return null;
    }

    // Timestamp is required by the Time Zone API; any epoch-seconds value
    // within the timezone's history is fine. Use "now" — DST rules are
    // resolved by the API.
    const timestamp = Math.floor(Date.now() / 1000);
    const tzUrl =
      `https://maps.googleapis.com/maps/api/timezone/json?location=${loc.lat},${loc.lng}&timestamp=${timestamp}&key=${apiKey}`;
    const tzRes = await fetch(tzUrl);
    if (!tzRes.ok) {
      console.error("Time Zone HTTP error:", tzRes.status);
      return null;
    }
    const tz = await tzRes.json();
    if (tz?.status !== "OK" || typeof tz?.timeZoneId !== "string") {
      console.warn("Time Zone API returned no id for:", query, tz?.status);
      return null;
    }
    return tz.timeZoneId;
  } catch (e) {
    console.error("resolveVenueTimezone error:", e);
    return null;
  }
}

/**
 * Given an IANA timezone, return the current date (YYYY-MM-DD) and time
 * (HH:MM, 24-hour) in that zone. `Intl.DateTimeFormat` is the Deno-native
 * way to do this without pulling in a date library.
 */
export function nowInTimezone(
  timezone: string,
  at: Date = new Date(),
): { date: string; time: string } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(at);
  const pick = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hour = pick("hour") === "24" ? "00" : pick("hour");
  return {
    date: `${pick("year")}-${pick("month")}-${pick("day")}`,
    time: `${hour}:${pick("minute")}`,
  };
}
