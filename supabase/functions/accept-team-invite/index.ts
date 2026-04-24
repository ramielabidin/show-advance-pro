import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// Accepts a team invite by token. Two paths, branched on the Authorization
// header:
//
//   (a) No auth header — new-user signup. Body: { token, name, password }.
//       We create the auth user via the Admin API with email_confirm=true
//       (the invite click itself proves email ownership since the token was
//       emailed to `invite.email`), then insert into team_members and
//       delete the invite row. Client signs in locally with the submitted
//       password to establish a session.
//
//   (b) Auth header present — existing user (password login or post-OAuth).
//       Body: { token, confirmMismatch? }. If the signed-in email doesn't
//       match the invited email, we require confirmMismatch=true (so the
//       UI can show a confirmation modal first). Then insert team_members
//       (ON CONFLICT DO NOTHING — the auto-accept trigger may have beaten
//       us to it for the matching-email case) and delete the invite.
//
// Role is hardcoded 'member' — the granular role model is Phase 2.

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

interface InviteRow {
  id: string;
  team_id: string;
  email: string;
  expires_at: string;
}

async function loadInvite(
  admin: ReturnType<typeof createClient>,
  token: string,
): Promise<{ invite?: InviteRow; error?: string; status?: number }> {
  const { data, error } = await admin
    .from("team_invites")
    .select("id, team_id, email, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (error) {
    console.error("accept-team-invite: invite lookup failed:", error.message);
    return { error: "Unable to load invite", status: 500 };
  }
  if (!data) return { error: "Invite not found", status: 404 };
  if (new Date(data.expires_at).getTime() < Date.now()) {
    return { error: "Invite expired", status: 410 };
  }
  return { invite: data as InviteRow };
}

async function addMemberAndConsume(
  admin: ReturnType<typeof createClient>,
  invite: InviteRow,
  userId: string,
) {
  const { error: memberError } = await admin
    .from("team_members")
    .upsert(
      { team_id: invite.team_id, user_id: userId, role: "member" },
      { onConflict: "team_id,user_id", ignoreDuplicates: true },
    );
  if (memberError) throw new Error(`member insert failed: ${memberError.message}`);

  const { error: deleteError } = await admin
    .from("team_invites")
    .delete()
    .eq("id", invite.id);
  if (deleteError) throw new Error(`invite delete failed: ${deleteError.message}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error("accept-team-invite: missing env");
      return json({ error: "Server misconfigured" }, 500);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    let body: {
      token?: unknown;
      name?: unknown;
      password?: unknown;
      confirmMismatch?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token) return json({ error: "Token required" }, 400);

    const { invite, error: inviteError, status: inviteStatus } = await loadInvite(admin, token);
    if (!invite) return json({ error: inviteError }, inviteStatus);

    const authHeader = req.headers.get("authorization");

    if (!authHeader) {
      // ── New-user signup path ──
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const password = typeof body.password === "string" ? body.password : "";
      if (name.length < 1 || name.length > 80) {
        return json({ error: "Name must be 1–80 characters" }, 400);
      }
      if (password.length < 10) {
        return json({ error: "Password must be at least 10 characters" }, 400);
      }

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: invite.email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name },
      });
      if (createError || !created?.user) {
        // Most common cause: the email already has an account. Surface that
        // cleanly so the UI can suggest "Sign in instead".
        const msg = createError?.message ?? "Unable to create account";
        const existing = /already|registered|exists/i.test(msg);
        return json(
          { error: existing ? "An account with this email already exists" : msg, code: existing ? "already_exists" : undefined },
          existing ? 409 : 400,
        );
      }

      try {
        await addMemberAndConsume(admin, invite, created.user.id);
      } catch (e) {
        console.error("accept-team-invite (signup):", e instanceof Error ? e.message : e);
        return json({ error: "Failed to accept invite" }, 500);
      }

      return json({ success: true, email: invite.email });
    }

    // ── Existing user path ──
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const user = userData.user;

    const invitedEmail = invite.email.toLowerCase();
    const userEmail = (user.email ?? "").toLowerCase();
    const emailsMatch = invitedEmail === userEmail;
    const confirmMismatch = body.confirmMismatch === true;

    if (!emailsMatch && !confirmMismatch) {
      return json({ error: "email_mismatch", invitedEmail: invite.email }, 409);
    }

    try {
      await addMemberAndConsume(admin, invite, user.id);
    } catch (e) {
      console.error("accept-team-invite (existing):", e instanceof Error ? e.message : e);
      return json({ error: "Failed to accept invite" }, 500);
    }

    return json({ success: true });
  } catch (e) {
    console.error("accept-team-invite unhandled:", e instanceof Error ? e.message : e);
    return json({ error: "An internal error occurred" }, 500);
  }
});
