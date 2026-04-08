import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formats a stored "City ST" string as "City, ST" for display. */
export function formatCityState(city: string | null | undefined): string {
  if (!city) return "";
  return city.replace(/^(.+)\s([A-Z]{2})$/, "$1, $2");
}
