import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Normalizes a phone number to a standard format.
 *  10 digits → (XXX) XXX-XXXX
 *  11 digits starting with 1 → +1 (XXX) XXX-XXXX
 *  Anything else → returned as-is (international or non-standard) */
export function normalizePhone(raw: string): string {
  if (!raw.trim()) return raw;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === "1") {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw.trim();
}

/** Map of US state / territory names → 2-letter postal codes.
 *  Keys are lowercase to allow case-insensitive lookup. */
const US_STATE_ABBR: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR",
  california: "CA", colorado: "CO", connecticut: "CT", delaware: "DE",
  florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID",
  illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS",
  kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN",
  mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE",
  nevada: "NV", "new hampshire": "NH", "new jersey": "NJ",
  "new mexico": "NM", "new york": "NY", "north carolina": "NC",
  "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR",
  pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT",
  vermont: "VT", virginia: "VA", washington: "WA",
  "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
  "district of columbia": "DC", "puerto rico": "PR",
};

/** Formats a stored "City ST" string as "City, ST" for display.
 *  - Strips trailing asterisks ("Albany NY**" → "Albany, NY")
 *  - Normalizes full US state names ("Los Angeles, California" → "Los Angeles, CA")
 *  - Leaves non-US locations untouched ("Toronto, Ontario" → "Toronto, Ontario") */
export function formatCityState(city: string | null | undefined): string {
  if (!city) return "";
  const clean = city.replace(/\*+$/, "").trim();

  // "City ST" — no comma, 2-letter code at end
  const noComma = clean.match(/^(.+?)\s+([A-Z]{2})$/);
  if (noComma) return `${noComma[1]}, ${noComma[2]}`;

  const lastComma = clean.lastIndexOf(",");
  if (lastComma === -1) return clean;

  const cityPart = clean.slice(0, lastComma).trim();
  const statePart = clean.slice(lastComma + 1).trim();
  if (!cityPart || !statePart) return clean;

  if (/^[A-Z]{2}$/.test(statePart)) return `${cityPart}, ${statePart}`;

  const abbr = US_STATE_ABBR[statePart.toLowerCase()];
  if (abbr) return `${cityPart}, ${abbr}`;

  return clean;
}
