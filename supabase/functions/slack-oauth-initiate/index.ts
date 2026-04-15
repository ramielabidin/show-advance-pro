import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Generate HMAC-SHA256 hex signature over `data` using `secret` */
async function hmacSign(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stateSecret = Deno.env.get("SLACK_STATE_SECRET");
    const clientId = Deno.env.get("SLACK_CLIENT_ID");

    if (!stateSecret || !clientId) {
      return new Response(
        JSON.stringify({ error: "Slack OAuth not configured. Set SLACK_CLIENT_ID and SLACK_STATE_SECRET secrets." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      console.error("slack-oauth-initiate: missing Authorization header");
      return new Response(JSON.stringify({ error: "Unauthorized: missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate the user's JWT by asking Supabase Auth to resolve it to a
    // user. This works regardless of the project's JWT signing algorithm
    // (HS256 *or* ES256 / RS256 — the asymmetric keys new Supabase projects
    // use), which lets us run behind verify_jwt=false on the edge-function
    // gateway without dropping auth checks. The gateway's built-in
    // verify_jwt only speaks HS256 and 401s ES256 tokens with
    // `UNAUTHORIZED_UNSUPPORTED_TOKEN_ALGORITHM`, so we have to handle this
    // here instead.
    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      console.error("slack-oauth-initiate: auth.getUser failed", userError?.message);
      return new Response(
        JSON.stringify({ error: `Unauthorized: ${userError?.message ?? "no user"}` }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Use service-role client to look up the user's team (bypasses RLS)
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: membership, error: memberError } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (memberError || !membership?.team_id) {
      console.error("slack-oauth-initiate: no team found for user", user.id, memberError?.message);
      return new Response(JSON.stringify({ error: "No team found for user" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const teamId = membership.team_id;

    // Build signed state token: "teamId.expiry.hmac"
    // Expiry: 10 minutes from now
    const expiry = Date.now() + 10 * 60 * 1000;
    const statePayload = `${teamId}.${expiry}`;
    const hmac = await hmacSign(statePayload, stateSecret);
    const state = `${statePayload}.${hmac}`;

    // Construct the Slack OAuth authorization URL
    const redirectUri = `${supabaseUrl}/functions/v1/slack-oauth-callback`;
    const params = new URLSearchParams({
      client_id: clientId,
      scope: "incoming-webhook",
      redirect_uri: redirectUri,
      state,
    });

    const authorizationUrl = `https://slack.com/oauth/v2/authorize?${params}`;

    return new Response(JSON.stringify({ authorizationUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("slack-oauth-initiate error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
