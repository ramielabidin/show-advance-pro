import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { renderDaysheetEmail, buildSubject, type RenderShow } from "./template.ts";

// Sends the band day-sheet as a real HTML email via SendGrid.
//
// Design goals:
//   - Visual parity with DaysheetGuestView (see template.ts).
//   - Shared Gmail/Apple-Mail thread: one personalization with every recipient
//     in `to` so "Reply all" continues the conversation naturally.
//   - Replies land in the caller's inbox via `reply_to`, while `from` stays on
//     the verified SendGrid sender so DMARC/SPF pass.
//   - Caller display name shows as "<Name> via Advance" so recipients know
//     who sent it without having to parse the from-address.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_SEC = 60;
const MAX_PERSONAL_MESSAGE_CHARS = 2000;

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });
}

interface SendGridPayload {
  from: { email: string; name?: string };
  reply_to?: { email: string; name?: string };
  personalizations: Array<{ to: Array<{ email: string; name?: string }> }>;
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
  return "Advance";
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
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error("send-daysheet-email: missing Supabase env");
      return json({ error: "Server misconfigured" }, 500);
    }
    if (!sendgridKey || !fromEmail) {
      console.error("send-daysheet-email: missing SendGrid env");
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

    let body: {
      showId?: unknown;
      personalMessage?: unknown;
      subject?: unknown;
      excludedEmails?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const showId = typeof body.showId === "string" ? body.showId : "";
    if (!showId) return json({ error: "showId is required" }, 400);

    const personalMessageRaw = typeof body.personalMessage === "string" ? body.personalMessage : "";
    const personalMessage = personalMessageRaw.slice(0, MAX_PERSONAL_MESSAGE_CHARS);
    const subjectOverride = typeof body.subject === "string" ? body.subject.trim() : "";

    const excludedEmails = Array.isArray(body.excludedEmails)
      ? new Set(
          body.excludedEmails
            .filter((e): e is string => typeof e === "string")
            .map((e) => e.trim().toLowerCase())
            .filter(Boolean),
        )
      : new Set<string>();

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const rl = await checkRateLimit({
      admin,
      bucket: "send-daysheet-email",
      key: `user:${user.id}`,
      maxRequests: RATE_LIMIT_MAX,
      windowSeconds: RATE_LIMIT_WINDOW_SEC,
    });
    if (!rl.allowed) {
      return json({ error: "Too many send attempts. Try again in a minute." }, 429, {
        "Retry-After": String(rl.retryAfterSec ?? RATE_LIMIT_WINDOW_SEC),
      });
    }

    const { data: show, error: showError } = await admin
      .from("shows")
      .select("*, schedule_entries(*), teams(name)")
      .eq("id", showId)
      .single();
    if (showError || !show) return json({ error: "Show not found" }, 404);

    // Defense in depth — service role bypasses RLS, so verify the caller is on
    // the show's team before exposing any data via email.
    const { data: membership, error: memberError } = await admin
      .from("team_members")
      .select("user_id")
      .eq("team_id", show.team_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (memberError) {
      console.error("send-daysheet-email: membership lookup failed:", memberError.message);
      return json({ error: "Unable to verify team membership" }, 500);
    }
    if (!membership) return json({ error: "You are not a member of this team" }, 403);

    const { data: members, error: membersError } = await admin
      .from("touring_party_members")
      .select("name, email")
      .eq("team_id", show.team_id);
    if (membersError) {
      console.error("send-daysheet-email: touring party lookup failed:", membersError.message);
      return json({ error: "Unable to load recipients" }, 500);
    }

    const recipients = (members ?? [])
      .map((m) => ({ email: (m.email ?? "").trim(), name: (m.name ?? "").trim() || undefined }))
      .filter((m) => m.email.length > 0 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m.email))
      .filter((m) => !excludedEmails.has(m.email.toLowerCase()));

    if (recipients.length === 0) {
      const msg =
        excludedEmails.size > 0
          ? "All recipients were removed. Include at least one person to send."
          : "No touring party members with email addresses. Add someone in Settings → Team before sending.";
      return json({ error: msg }, 400);
    }

    const senderName = resolveSenderName(user.user_metadata, user.email);
    const renderShow: RenderShow = {
      ...show,
      artist_name: show.teams?.name ?? null,
    };

    const rendered = renderDaysheetEmail(renderShow, {
      personalMessage,
      senderName,
    });
    const subject = subjectOverride || buildSubject(renderShow);

    const payload: SendGridPayload = {
      from: { email: fromEmail, name: `${senderName} via Advance` },
      reply_to: user.email
        ? { email: user.email, name: senderName }
        : undefined,
      // Single personalization with all recipients in `to` — everyone sees the
      // full list and "Reply all" threads the whole party. SendGrid will reject
      // duplicate addresses, so de-dupe defensively.
      personalizations: [
        {
          to: Array.from(new Map(recipients.map((r) => [r.email.toLowerCase(), r])).values()),
        },
      ],
      subject,
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
      console.error("send-daysheet-email: SendGrid error", sgRes.status, errText);
      return json(
        {
          error: `Email provider error (${sgRes.status}). Please try again.`,
        },
        502,
      );
    }

    return json({
      success: true,
      recipientCount: payload.personalizations[0].to.length,
    });
  } catch (e) {
    console.error("send-daysheet-email unhandled:", e instanceof Error ? e.message : e);
    return json({ error: "An internal error occurred" }, 500);
  }
});
