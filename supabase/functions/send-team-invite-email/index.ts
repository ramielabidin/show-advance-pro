import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { buildSubject, renderInviteEmail } from "./template.ts";

// Sends the team-invite email via SendGrid.
//
// Flow: client inserts a team_invites row (RLS-gated), then invokes this
// function with the row's id. We fetch the team and inviter server-side,
// verify the caller owns the team, and send a single personalization to
// the invited address. From-address uses the shared SendGrid sender so
// DMARC/SPF pass; reply-to is set to the inviter so recipients can hit
// Reply and reach a human.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_APP_URL = "https://app.advancetouring.com/";
const DEFAULT_ROLE_LABEL = "Member — full access to shows, tours, and day sheets";

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });
}

interface SendGridPayload {
  from: { email: string; name?: string };
  reply_to?: { email: string; name?: string };
  personalizations: Array<{ to: Array<{ email: string }> }>;
  subject: string;
  content: Array<{ type: string; value: string }>;
}

function resolveSenderName(
  userMetadata: Record<string, unknown> | null | undefined,
  email: string | null | undefined,
): string {
  const meta = userMetadata ?? {};
  const fullName = typeof meta.full_name === "string" ? meta.full_name.trim() : "";
  if (fullName) return fullName;
  const name = typeof meta.name === "string" ? meta.name.trim() : "";
  if (name) return name;
  if (email) {
    const local = email.split("@")[0];
    if (local) return local;
  }
  return "A teammate";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return json({ error: "Missing authorization header" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const sendgridKey = Deno.env.get("SENDGRID_API_KEY");
    const fromEmail = Deno.env.get("SENDGRID_FROM_EMAIL");
    const appUrl = (Deno.env.get("PUBLIC_APP_URL") ?? DEFAULT_APP_URL).trim() || DEFAULT_APP_URL;
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error("send-team-invite-email: missing Supabase env");
      return json({ error: "Server misconfigured" }, 500);
    }
    if (!sendgridKey || !fromEmail) {
      console.error("send-team-invite-email: missing SendGrid env");
      return json(
        { error: "Email sending is not configured. Ask an admin to set the SendGrid secrets." },
        500,
      );
    }

    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const user = userData.user;

    let body: { inviteId?: unknown };
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const inviteId = typeof body.inviteId === "string" ? body.inviteId.trim() : "";
    if (!inviteId) return json({ error: "inviteId is required" }, 400);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: invite, error: inviteError } = await admin
      .from("team_invites")
      .select("id, team_id, email, invited_by, created_at")
      .eq("id", inviteId)
      .maybeSingle();
    if (inviteError) {
      console.error("send-team-invite-email: invite lookup failed:", inviteError.message);
      return json({ error: "Unable to load invite" }, 500);
    }
    if (!invite) return json({ error: "Invite not found" }, 404);

    // Only owners of the team can trigger the send. Matches the UI — the
    // invite form is gated to owners — but enforced here too.
    const { data: membership, error: memberError } = await admin
      .from("team_members")
      .select("role")
      .eq("team_id", invite.team_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (memberError) {
      console.error("send-team-invite-email: membership lookup failed:", memberError.message);
      return json({ error: "Unable to verify team membership" }, 500);
    }
    if (!membership || membership.role !== "owner") {
      return json({ error: "Only team owners can send invites" }, 403);
    }

    const { data: team, error: teamError } = await admin
      .from("teams")
      .select("name")
      .eq("id", invite.team_id)
      .single();
    if (teamError || !team) {
      console.error("send-team-invite-email: team lookup failed:", teamError?.message);
      return json({ error: "Team not found" }, 404);
    }

    const inviterName = resolveSenderName(user.user_metadata, user.email);
    const inviterEmail = user.email ?? "";
    const inviteCode = invite.id.replace(/-/g, "").slice(0, 6);

    const rendered = renderInviteEmail({
      inviterName,
      inviterEmail,
      teamName: team.name ?? "your team",
      roleLabel: DEFAULT_ROLE_LABEL,
      acceptUrl: appUrl,
      inviteCode,
    });

    const payload: SendGridPayload = {
      from: { email: fromEmail, name: `${inviterName} via Advance` },
      reply_to: inviterEmail ? { email: inviterEmail, name: inviterName } : undefined,
      personalizations: [{ to: [{ email: invite.email }] }],
      subject: rendered.subject || buildSubject({
        inviterName,
        inviterEmail,
        teamName: team.name ?? "your team",
        roleLabel: DEFAULT_ROLE_LABEL,
        acceptUrl: appUrl,
        inviteCode,
      }),
      content: [
        { type: "text/plain", value: rendered.text },
        { type: "text/html", value: rendered.html },
      ],
    };

    const sgRes = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sendgridKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!sgRes.ok) {
      const errText = await sgRes.text();
      console.error("send-team-invite-email: SendGrid error", sgRes.status, errText);
      return json(
        { error: `Email provider error (${sgRes.status}). Please try again.` },
        502,
      );
    }

    return json({ success: true, recipient: invite.email });
  } catch (e) {
    console.error("send-team-invite-email unhandled:", e instanceof Error ? e.message : e);
    return json({ error: "An internal error occurred" }, 500);
  }
});
