import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// Declines a team invite by deleting the invite row by token. Idempotent —
// returns success even if the row is already gone. No auth required; the
// token itself is unguessable and single-use. The client toasts and
// navigates to "/" rather than routing to a dedicated declined page.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("decline-team-invite: missing env");
      return json({ error: "Server misconfigured" }, 500);
    }

    let body: { token?: unknown };
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token) return json({ error: "Token required" }, 400);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { error } = await admin.from("team_invites").delete().eq("token", token);
    if (error) {
      console.error("decline-team-invite: delete failed:", error.message);
      return json({ error: "Unable to decline invite" }, 500);
    }

    return json({ success: true });
  } catch (e) {
    console.error("decline-team-invite unhandled:", e instanceof Error ? e.message : e);
    return json({ error: "An internal error occurred" }, 500);
  }
});
