import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Return value only if it's a non-empty, non-TBD string */
function val(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || s.toLowerCase() === "tbd") return null;
  return s;
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

function formatDaySheet(show: any, sections: Set<string>, note?: string): string {
  const blocks: string[] = [];
  const has = (key: string) => sections.has(key);

  if (note) {
    blocks.push(`💬 ${note}`);
    blocks.push("");
  }

  blocks.push(`📋 *DAY SHEET*`);
  blocks.push(`*${show.venue_name}* — ${show.city}`);
  blocks.push(`📅 ${formatDate(show.date)}`);
  blocks.push("");

  if (has("contact") && (val(show.dos_contact_name) || val(show.dos_contact_phone))) {
    blocks.push(`📞 *Day of Show Contact*`);
    if (val(show.dos_contact_name)) blocks.push(`    ${val(show.dos_contact_name)}`);
    if (val(show.dos_contact_phone)) blocks.push(`    ${val(show.dos_contact_phone)}`);
    blocks.push("");
  }

  if (has("venue") && val(show.venue_address)) {
    blocks.push(`📍 *Venue*`);
    blocks.push(`    ${val(show.venue_address)}`);
    blocks.push("");
  }

  if (has("departure") && (val(show.departure_time) || val(show.departure_location))) {
    blocks.push(`🚐 *Departure*`);
    if (val(show.departure_time)) blocks.push(`    ⏰ ${val(show.departure_time)}`);
    if (val(show.departure_location)) blocks.push(`    📍 ${val(show.departure_location)}`);
    blocks.push("");
  }

  if (has("schedule") && show.schedule_entries?.length > 0) {
    const sorted = [...show.schedule_entries].sort((a: any, b: any) => a.sort_order - b.sort_order);
    blocks.push(`🕐 *Schedule*`);
    for (const entry of sorted) {
      const labelUpper = (entry.label || "").toUpperCase();
      const isJuice = labelUpper.includes("JUICE");
      const prefix = isJuice ? "🎸" : entry.is_band ? "⭐" : "   ";
      const bold = (isJuice || entry.is_band) ? `*${entry.label}*` : entry.label;
      blocks.push(`    ${prefix} \`${entry.time}\`  ${bold}`);
    }
    blocks.push("");
  }

  if (has("band")) {
    const fields: [string, unknown][] = [
      ["Set Length", show.set_length],
      ["Curfew", show.curfew],
      ["Changeover", show.changeover_time],
      ["Backline", show.backline_provided],
      ["Catering", show.catering_details],
    ];
    const filled = fields.filter(([, v]) => val(v));
    if (filled.length) {
      blocks.push(`🎸 *Band / Performance*`);
      for (const [label, v] of filled) blocks.push(`    ${label}: ${val(v)}`);
      blocks.push("");
    }
  }

  if (has("venueDetails")) {
    const fields: [string, unknown][] = [
      ["Capacity", show.venue_capacity],
      ["Ticket Price", show.ticket_price],
      ["Age Restriction", show.age_restriction],
    ];
    const filled = fields.filter(([, v]) => val(v));
    if (filled.length) {
      blocks.push(`🏟️ *Venue Details*`);
      for (const [label, v] of filled) blocks.push(`    ${label}: ${val(v)}`);
      blocks.push("");
    }
  }

  if (has("dealTerms")) {
    const fields: [string, unknown][] = [
      ["Guarantee", show.guarantee],
      ["Backend", show.backend_deal],
    ];
    const filled = fields.filter(([, v]) => val(v));
    if (filled.length) {
      blocks.push(`💵 *Deal Terms*`);
      for (const [label, v] of filled) blocks.push(`    ${label}: ${val(v)}`);
      blocks.push("");
    }
  }

  if (has("production")) {
    const fields: [string, unknown][] = [
      ["Hospitality", show.hospitality],
      ["Support Act", show.support_act],
      ["Support Pay", show.support_pay],
      ["Merch Split", show.merch_split],
    ];
    const filled = fields.filter(([, v]) => val(v));
    if (filled.length) {
      blocks.push(`🎤 *Production*`);
      for (const [label, v] of filled) blocks.push(`    ${label}: ${val(v)}`);
      blocks.push("");
    }
  }

  if (has("projections")) {
    const fields: [string, unknown][] = [
      ["Walkout Potential", show.walkout_potential],
      ["Net/Gross", show.net_gross],
      ["Artist Comps", show.artist_comps],
    ];
    const filled = fields.filter(([, v]) => val(v));
    if (filled.length) {
      blocks.push(`📊 *Projections*`);
      for (const [label, v] of filled) blocks.push(`    ${label}: ${val(v)}`);
      blocks.push("");
    }
  }

  if (has("parking") && val(show.parking_notes)) {
    blocks.push(`🅿️ *Parking*`);
    blocks.push(`    ${val(show.parking_notes)}`);
    blocks.push("");
  }

  if (has("loadIn") && val(show.load_in_details)) {
    blocks.push(`📦 *Load In*`);
    blocks.push(`    ${val(show.load_in_details)}`);
    blocks.push("");
  }

  if (has("greenRoom") && val(show.green_room_info)) {
    blocks.push(`🛋️ *Green Room*`);
    blocks.push(`    ${val(show.green_room_info)}`);
    blocks.push("");
  }

  if (has("guestList") && val(show.guest_list_details)) {
    blocks.push(`📋 *Guest List*`);
    blocks.push(`    ${val(show.guest_list_details)}`);
    blocks.push("");
  }

  if (has("wifi") && (val(show.wifi_network) || val(show.wifi_password))) {
    blocks.push(`📶 *WiFi*`);
    if (val(show.wifi_network)) blocks.push(`    Network: \`${val(show.wifi_network)}\``);
    if (val(show.wifi_password)) blocks.push(`    Password: \`${val(show.wifi_password)}\``);
    blocks.push("");
  }

  if (has("settlement") && (val(show.settlement_method) || val(show.settlement_guarantee))) {
    blocks.push(`💰 *Settlement*`);
    if (val(show.settlement_method)) blocks.push(`    ${val(show.settlement_method)}`);
    if (val(show.settlement_guarantee)) blocks.push(`    ${val(show.settlement_guarantee)}`);
    blocks.push("");
  }

  if (has("hotel") && (val(show.hotel_name) || val(show.hotel_address))) {
    blocks.push(`🏨 *Hotel*`);
    if (val(show.hotel_name)) blocks.push(`    ${val(show.hotel_name)}`);
    if (val(show.hotel_address)) blocks.push(`    ${val(show.hotel_address)}`);
    if (val(show.hotel_confirmation)) blocks.push(`    Confirmation: \`${val(show.hotel_confirmation)}\``);
    if (val(show.hotel_checkin)) blocks.push(`    Check-in: ${val(show.hotel_checkin)}`);
    if (val(show.hotel_checkout)) blocks.push(`    Check-out: ${val(show.hotel_checkout)}`);
    blocks.push("");
  }

  if (has("travel") && val(show.travel_notes)) {
    blocks.push(`🗺️ *Travel*`);
    blocks.push(`    ${val(show.travel_notes)}`);
    blocks.push("");
  }

  if (has("additional") && val(show.additional_info)) {
    blocks.push(`ℹ️ *Additional Info*`);
    blocks.push(`    ${val(show.additional_info)}`);
    blocks.push("");
  }

  return blocks.join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate JWT
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

    const { showId, sections: sectionsArr, note } = await req.json();
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
      .limit(1)
      .single();

    const webhookUrl = settings?.slack_webhook_url;
    if (!webhookUrl) {
      return new Response(
        JSON.stringify({ error: "Slack webhook URL not configured. Go to Settings to add it." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const allSections = ["contact","venue","departure","schedule","band","venueDetails","dealTerms","production","projections","parking","loadIn","greenRoom","guestList","wifi","settlement","hotel","travel","additional"];
    const sections = new Set<string>(Array.isArray(sectionsArr) ? sectionsArr : allSections);
    const message = formatDaySheet(show, sections, typeof note === "string" ? note.trim() : undefined);

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
