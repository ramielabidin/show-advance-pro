import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formats a stored "City ST" string as "City, ST" for display.
 *  Also strips trailing asterisks that users sometimes append as a
 *  "no address yet" notation (e.g. "Albany NY**" → "Albany, NY"). */
export function formatCityState(city: string | null | undefined): string {
  if (!city) return "";
  const clean = city.replace(/\*+$/, "").trim();
  return clean.replace(/^(.+)\s([A-Z]{2})$/, "$1, $2");
}
