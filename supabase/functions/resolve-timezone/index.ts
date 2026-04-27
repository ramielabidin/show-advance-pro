// Thin wrapper around the shared timezone helper. Exists so the client can
// resolve venue timezones at show-creation time without shipping the Google
// Maps API key to the browser.
//
// Returns { timezone: string | null } — null when the address/city can't be
// resolved. Callers should treat null as "leave venue_timezone unset and let
// the scheduler resolve it lazily later" rather than surfacing an error.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { resolveVenueTimezone } from "../_shared/timezone.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_SEC = 60;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (serviceRoleKey) {
      const admin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
      });
      const rl = await checkRateLimit({
        admin,
        bucket: "resolve-timezone",
        key: `user:${user.id}`,
        maxRequests: RATE_LIMIT_MAX,
        windowSeconds: RATE_LIMIT_WINDOW_SEC,
      });
      if (!rl.allowed) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Try again in a minute." }),
          {
            status: 429,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
              "Retry-After": String(rl.retryAfterSec ?? RATE_LIMIT_WINDOW_SEC),
            },
          },
        );
      }
    }

    const body = await req.json().catch(() => ({}));
    const venue_address = typeof body.venue_address === "string" ? body.venue_address : null;
    const city = typeof body.city === "string" ? body.city : null;
    const venue_name = typeof body.venue_name === "string" ? body.venue_name : null;

    if (!venue_address && !city) {
      return new Response(
        JSON.stringify({ error: "venue_address or city is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Google Places API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const timezone = await resolveVenueTimezone(
      { venue_address, city, venue_name },
      apiKey,
    );
    return new Response(
      JSON.stringify({ timezone }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
