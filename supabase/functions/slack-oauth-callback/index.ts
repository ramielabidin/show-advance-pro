import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

/** Verify HMAC-SHA256 signature */
async function hmacVerify(data: string, secret: string, expectedHex: string): Promise<boolean> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  const actualHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return actualHex === expectedHex;
}

/**
 * Parse and verify the state token produced by slack-oauth-initiate.
 * Format: "teamId.expiry.hmac"
 * Returns teamId on success, null on failure.
 */
async function verifyState(state: string | null, secret: string): Promise<string | null> {
  if (!state) return null;
  const lastDot = state.lastIndexOf(".");
  if (lastDot === -1) return null;
  const payload = state.slice(0, lastDot);
  const hmac = state.slice(lastDot + 1);
  const dotIdx = payload.indexOf(".");
  if (dotIdx === -1) return null;
  const teamId = payload.slice(0, dotIdx);
  const expiry = parseInt(payload.slice(dotIdx + 1), 10);
  if (isNaN(expiry) || Date.now() > expiry) return null;
  const valid = await hmacVerify(payload, secret, hmac);
  if (!valid) return null;
  return teamId;
}

serve(async (req) => {
  // This is a browser GET redirect from Slack — no CORS headers needed,
  // just a server-side redirect response.
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const clientId = Deno.env.get("SLACK_CLIENT_ID")!;
  const clientSecret = Deno.env.get("SLACK_CLIENT_SECRET")!;
  const stateSecret = Deno.env.get("SLACK_STATE_SECRET")!;
  const appUrl = Deno.env.get("APP_URL") ?? "http://localhost:5173";

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const slackError = url.searchParams.get("error");

  // User denied the authorization
  if (slackError) {
    console.log("Slack OAuth denied:", slackError);
    return Response.redirect(`${appUrl}/settings?slack=denied`, 302);
  }

  // Validate state token
  const teamId = await verifyState(state, stateSecret);
  if (!teamId) {
    console.error("Invalid or expired state token");
    return Response.redirect(`${appUrl}/settings?slack=error`, 302);
  }

  if (!code) {
    console.error("No code in callback");
    return Response.redirect(`${appUrl}/settings?slack=error`, 302);
  }

  // Exchange code for access token
  const redirectUri = `${supabaseUrl}/functions/v1/slack-oauth-callback`;
  interface SlackOAuthResponse {
    ok: boolean;
    error?: string;
    incoming_webhook?: { url?: string; channel?: string | null };
    team?: { name?: string | null };
  }
  let tokenData: SlackOAuthResponse;
  try {
    const tokenRes = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });
    tokenData = (await tokenRes.json()) as SlackOAuthResponse;
  } catch (err) {
    console.error("Token exchange network error:", err);
    return Response.redirect(`${appUrl}/settings?slack=error`, 302);
  }

  if (!tokenData.ok) {
    console.error("Slack token exchange failed:", tokenData.error);
    return Response.redirect(`${appUrl}/settings?slack=error`, 302);
  }

  const webhookUrl = tokenData.incoming_webhook?.url;
  const channelName = tokenData.incoming_webhook?.channel ?? null;
  const slackTeamName = tokenData.team?.name ?? null;

  if (!webhookUrl) {
    console.error("No incoming_webhook in token response — ensure incoming-webhook scope is granted");
    return Response.redirect(`${appUrl}/settings?slack=error`, 302);
  }

  // Upsert app_settings using service role (bypasses RLS, user's JWT not available here)
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: existing } = await supabase
    .from("app_settings")
    .select("id")
    .eq("team_id", teamId)
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("app_settings")
      .update({
        slack_webhook_url: webhookUrl,
        slack_channel_name: channelName,
        slack_team_name: slackTeamName,
      })
      .eq("id", existing.id);
    if (error) {
      console.error("Failed to update app_settings:", error);
      return Response.redirect(`${appUrl}/settings?slack=error`, 302);
    }
  } else {
    const { error } = await supabase
      .from("app_settings")
      .insert({
        team_id: teamId,
        slack_webhook_url: webhookUrl,
        slack_channel_name: channelName,
        slack_team_name: slackTeamName,
      });
    if (error) {
      console.error("Failed to insert app_settings:", error);
      return Response.redirect(`${appUrl}/settings?slack=error`, 302);
    }
  }

  return Response.redirect(`${appUrl}/settings?slack=connected`, 302);
});
