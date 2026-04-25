import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { checkRateLimit } from "../_shared/rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_SEC = 60;

/** Return value only if non-empty, non-TBD, non-n/a */
function val(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || s.toLowerCase() === "tbd" || s.toLowerCase() === "n/a") return null;
  return s;
}

function stripCountry(addr: string): string {
  return addr.replace(/,\s*United States$/i, "");
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const NANOID_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";

function nanoid(size = 17): string {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  let id = "";
  for (let i = 0; i < size; i++) id += NANOID_ALPHABET[bytes[i] & 63];
  return id;
}

/**
 * Returns the URL of an active daysheet guest link for this show, minting one
 * if none exists. `baseUrl` must be the origin that actually serves the app
 * (e.g. the browser's `window.location.origin`) — otherwise the Slack button
 * will land on a domain without the SPA routes and redirect to auth.
 */
async function ensureDaySheetGuestUrl(
  supabase: SupabaseClient,
  showId: string,
  userId: string,
  baseUrl: string
): Promise<string | null> {
  try {
    const { data: existing } = await supabase
      .from("guest_links")
      .select("token")
      .eq("show_id", showId)
      .eq("link_type", "daysheet")
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing?.token) return `${baseUrl}/guest/${existing.token}`;

    const token = nanoid(17);
    const { error: insertError } = await supabase.from("guest_links").insert({
      token,
      show_id: showId,
      link_type: "daysheet",
      created_by: userId,
    });
    if (insertError) {
      console.error("Failed to mint guest daysheet link:", insertError);
      return null;
    }
    return `${baseUrl}/guest/${token}`;
  } catch (e) {
    console.error("ensureDaySheetGuestUrl error:", e);
    return null;
  }
}

function sanitizeAppUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

type Block = Record<string, unknown>;

interface ScheduleEntryForSlack {
  label?: string | null;
  time?: string | null;
  is_band?: boolean | null;
}
interface ShowForSlack {
  venue_name?: string | null;
  date: string;
  venue_address?: string | null;
  schedule_entries?: ScheduleEntryForSlack[];
}

/**
 * Render the band day sheet as a minimal Slack Block Kit "show card":
 * venue header, date + address, Load In / Set fields, and a primary
 * button linking to the guest day sheet. Everything else lives behind
 * the link.
 */
function buildDaySheetBlocks(show: ShowForSlack, guestUrl: string | null): Block[] {
  const blocks: Block[] = [];

  const venue = val(show.venue_name) ?? "Show";
  blocks.push({
    type: "header",
    text: { type: "plain_text", text: venue.slice(0, 150), emoji: false },
  });

  const parts: string[] = [formatDate(show.date)];
  const addr = val(show.venue_address);
  if (addr) {
    const clean = stripCountry(addr);
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clean)}`;
    parts.push(`<${mapsUrl}|${clean}>`);
  }
  blocks.push({
    type: "section",
    text: { type: "mrkdwn", text: parts.join("\n\n") },
  });

  const entries: ScheduleEntryForSlack[] = Array.isArray(show.schedule_entries)
    ? show.schedule_entries
    : [];
  const loadInTime =
    val(entries.find((e) => e?.label && /\bload[-\s]*in\b/i.test(String(e.label)))?.time) ?? "—";
  const setTime = val(entries.find((e) => e?.is_band)?.time) ?? "—";
  blocks.push({
    type: "section",
    fields: [
      { type: "mrkdwn", text: `*Load In*\n${loadInTime}` },
      { type: "mrkdwn", text: `*Set*\n${setTime}` },
    ],
  });

  if (guestUrl) {
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "View Day Sheet", emoji: false },
          url: guestUrl,
          style: "primary",
        },
      ],
    });
  }

  return blocks;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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

    const { showId, appUrl } = await req.json();
    if (!showId || typeof showId !== "string") {
      return new Response(JSON.stringify({ error: "showId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const baseUrl = sanitizeAppUrl(appUrl);

    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const rl = await checkRateLimit({
      admin: supabase,
      bucket: "push-slack-daysheet",
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
        }
      );
    }

    const { data: show, error: showError } = await supabase
      .from("shows")
      .select("*, schedule_entries(*), teams(name)")
      .eq("id", showId)
      .single();

    if (showError || !show) {
      return new Response(JSON.stringify({ error: "Show not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: settings } = await supabase
      .from("app_settings")
      .select("slack_webhook_url")
      .eq("team_id", show.team_id)
      .limit(1)
      .single();

    const webhookUrl = settings?.slack_webhook_url;
    if (!webhookUrl) {
      return new Response(
        JSON.stringify({ error: "Slack webhook URL not configured. Go to Settings to add it." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const guestUrl = baseUrl
      ? await ensureDaySheetGuestUrl(supabase, show.id, user.id, baseUrl)
      : null;
    const blocks = buildDaySheetBlocks(show, guestUrl);
    const fallback = `Day sheet — ${show.venue_name} — ${formatDate(show.date)}`;

    const slackRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks, text: fallback }),
    });

    if (!slackRes.ok) {
      const errText = await slackRes.text();
      console.error("Slack webhook error:", slackRes.status, errText);
      return new Response(
        JSON.stringify({ error: `Slack responded with ${slackRes.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await slackRes.text();

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("push-slack error:", e);
    return new Response(
      JSON.stringify({ error: "An internal error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
