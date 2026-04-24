import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// Resolves a team-invite token into display-safe context (team name,
// inviter name, invited email, role label, expiry). Called from the public
// `/invite/:token` landing page — no auth required. We only return non-PII
// fields; the token itself is unguessable (32 hex chars), so knowledge of
// it is treated as weak authorization to view the invite context.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_ROLE_LABEL = "Member — full access to shows, tours, and day sheets";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function resolveInviterName(
  metadata: Record<string, unknown> | null | undefined,
  email: string | null | undefined,
): string {
  const meta = metadata ?? {};
  const full = typeof meta.full_name === "string" ? meta.full_name.trim() : "";
  if (full) return full;
  const name = typeof meta.name === "string" ? meta.name.trim() : "";
  if (name) return name;
  if (email) {
    const local = email.split("@")[0];
    if (local) return local;
  }
  return "A teammate";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("resolve-team-invite: missing env");
      return json({ error: "Server misconfigured" }, 500);
    }

    let body: { token?: unknown };
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token) return json({ status: "not_found" });

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: invite, error: inviteError } = await admin
      .from("team_invites")
      .select("id, team_id, email, invited_by, expires_at")
      .eq("token", token)
      .maybeSingle();
    if (inviteError) {
      console.error("resolve-team-invite: lookup failed:", inviteError.message);
      return json({ error: "Lookup failed" }, 500);
    }
    if (!invite) return json({ status: "not_found" });

    if (new Date(invite.expires_at).getTime() < Date.now()) {
      return json({ status: "expired" });
    }

    const { data: team, error: teamError } = await admin
      .from("teams")
      .select("name, team_name")
      .eq("id", invite.team_id)
      .single();
    if (teamError || !team) {
      console.error("resolve-team-invite: team lookup failed:", teamError?.message);
      return json({ status: "not_found" });
    }

    // Mirror send-team-invite-email/index.ts — prefer the team display
    // name (e.g. "Juice Music, LLC") over the artist name when set.
    const teamDisplayName =
      (team as { team_name: string | null }).team_name?.trim() || team.name || "your team";

    const { data: inviterUserRes, error: inviterError } = await admin.auth.admin.getUserById(
      invite.invited_by,
    );
    if (inviterError) {
      console.error("resolve-team-invite: inviter lookup failed:", inviterError.message);
    }
    const inviter = inviterUserRes?.user;
    const inviterName = resolveInviterName(inviter?.user_metadata, inviter?.email);

    return json({
      status: "valid",
      team: { displayName: teamDisplayName },
      inviter: { name: inviterName },
      email: invite.email,
      roleLabel: DEFAULT_ROLE_LABEL,
      expiresAt: invite.expires_at,
    });
  } catch (e) {
    console.error("resolve-team-invite unhandled:", e instanceof Error ? e.message : e);
    return json({ error: "An internal error occurred" }, 500);
  }
});
