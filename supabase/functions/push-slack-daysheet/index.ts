import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

function formatGuestList(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed
      .map((g: any) => {
        const name = g.name || "Guest";
        const plus = g.guests || g.plusOnes || g.plus_ones || 0;
        return plus > 0 ? `${name} +${plus}` : name;
      })
      .join(", ");
  } catch {
    return raw;
  }
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

/**
 * Render the band day sheet — band-relevant sections only, populated fields only.
 * Mirrors the layout produced by ExportPdfDialog / EmailBandDialog.
 */
function formatDaySheet(show: any): string {
  const blocks: string[] = [];

  blocks.push(`📋 *DAY SHEET*`);
  blocks.push(`*${show.venue_name}* — ${show.city}`);
  blocks.push(`📅 ${formatDate(show.date)}`);
  blocks.push("");

  if (val(show.dos_contact_name) || val(show.dos_contact_phone)) {
    blocks.push(`📞 *Day of Show Contact*`);
    if (val(show.dos_contact_name)) blocks.push(`    ${val(show.dos_contact_name)}`);
    if (val(show.dos_contact_phone)) blocks.push(`    ${val(show.dos_contact_phone)}`);
    blocks.push("");
  }

  if (val(show.venue_address)) {
    blocks.push(`📍 *Venue*`);
    blocks.push(`    ${stripCountry(val(show.venue_address)!)}`);
    blocks.push("");
  }

  if (show.schedule_entries?.length > 0) {
    const sorted = [...show.schedule_entries].sort((a: any, b: any) => a.sort_order - b.sort_order);
    blocks.push(`🕐 *Schedule*`);
    for (const entry of sorted) {
      const setInline = entry.is_band && val(show.set_length) ? ` (${val(show.set_length)})` : "";
      blocks.push(`    \`${entry.time}\`  ${entry.label}${setInline}`);
    }
    blocks.push("");
  }

  if (val(show.departure_time) || val(show.departure_notes)) {
    blocks.push(`🚐 *Departure*`);
    if (val(show.departure_time)) blocks.push(`    ⏰ ${val(show.departure_time)}`);
    if (val(show.departure_notes)) blocks.push(`    Notes: ${val(show.departure_notes)}`);
    blocks.push("");
  }

  if (val(show.parking_notes)) {
    blocks.push(`🅿️ *Parking*`);
    blocks.push(`    ${val(show.parking_notes)}`);
    blocks.push("");
  }

  if (val(show.load_in_details)) {
    blocks.push(`📦 *Load In*`);
    blocks.push(`    ${val(show.load_in_details)}`);
    blocks.push("");
  }

  if (val(show.green_room_info)) {
    blocks.push(`🛋️ *Green Room*`);
    blocks.push(`    ${val(show.green_room_info)}`);
    blocks.push("");
  }

  {
    const lines: string[] = [];
    if (val(show.venue_capacity)) lines.push(`    Capacity: ${val(show.venue_capacity)}`);
    if (val(show.age_restriction)) lines.push(`    Age Restriction: ${val(show.age_restriction)}`);
    if (lines.length) {
      blocks.push(`🏟️ *Venue Details*`);
      blocks.push(...lines);
      blocks.push("");
    }
  }

  if (val(show.guest_list_details)) {
    const formatted = formatGuestList(val(show.guest_list_details)!);
    if (formatted) {
      blocks.push(`📋 *Guest List*`);
      blocks.push(`    ${formatted}`);
      blocks.push("");
    }
  }

  if (val(show.wifi_network) || val(show.wifi_password)) {
    blocks.push(`📶 *WiFi*`);
    if (val(show.wifi_network)) blocks.push(`    Network: \`${val(show.wifi_network)}\``);
    if (val(show.wifi_password)) blocks.push(`    Password: \`${val(show.wifi_password)}\``);
    blocks.push("");
  }

  if (val(show.hotel_name) || val(show.hotel_address) || val(show.hotel_confirmation)) {
    blocks.push(`🏨 *Accommodations*`);
    if (val(show.hotel_name)) blocks.push(`    ${val(show.hotel_name)}`);
    if (val(show.hotel_address)) blocks.push(`    ${val(show.hotel_address)}`);
    if (val(show.hotel_confirmation)) blocks.push(`    Confirmation: \`${val(show.hotel_confirmation)}\``);
    if (val(show.hotel_checkin)) blocks.push(`    Check-in: ${val(show.hotel_checkin)}`);
    if (val(show.hotel_checkout)) blocks.push(`    Check-out: ${val(show.hotel_checkout)}`);
    blocks.push("");
  }

  return blocks.join("\n");
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

    const { showId } = await req.json();
    if (!showId || typeof showId !== "string") {
      return new Response(JSON.stringify({ error: "showId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: show, error: showError } = await supabase
      .from("shows")
      .select("*, schedule_entries(*)")
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

    const message = formatDaySheet(show);

    const slackRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message }),
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
