import { supabase } from "@/integrations/supabase/client";

interface ResolveArgs {
  showId: string;
  venue_address?: string | null;
  city?: string | null;
  venue_name?: string | null;
}

/**
 * Fire-and-forget helper: resolve a show's venue timezone via the
 * `resolve-timezone` edge function and persist it on the row. Safe to call
 * from UI code — it never throws (errors are swallowed and logged), never
 * blocks rendering, and is a no-op if the address/city can't be resolved.
 *
 * The scheduler also resolves lazily, so skipping or failing this call just
 * defers the work to the next cron tick that evaluates the show.
 */
export function resolveShowTimezoneInBackground({
  showId,
  venue_address,
  city,
  venue_name,
}: ResolveArgs): void {
  if (!showId || (!venue_address && !city)) return;
  void (async () => {
    try {
      const { data, error } = await supabase.functions.invoke("resolve-timezone", {
        body: { venue_address, city, venue_name },
      });
      if (error) {
        console.warn("resolve-timezone invoke failed:", error.message);
        return;
      }
      const timezone = typeof data?.timezone === "string" ? data.timezone : null;
      if (!timezone) return;
      const { error: updateError } = await supabase
        .from("shows")
        .update({ venue_timezone: timezone })
        .eq("id", showId);
      if (updateError) {
        console.warn("Failed to persist venue_timezone:", updateError.message);
      }
    } catch (e) {
      console.warn("resolveShowTimezoneInBackground error:", e);
    }
  })();
}
