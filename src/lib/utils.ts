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

/** Formats a stored "City ST" string as "City, ST" for display.
 *  Also strips trailing asterisks that users sometimes append as a
 *  "no address yet" notation (e.g. "Albany NY**" → "Albany, NY"). */
export function formatCityState(city: string | null | undefined): string {
  if (!city) return "";
  const clean = city.replace(/\*+$/, "").trim();
  return clean.replace(/^(.+?),?\s([A-Z]{2})$/, "$1, $2");
}
