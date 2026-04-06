import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function formatDaySheet(show: any, sections: Set<string>): string {
  const blocks: string[] = [];
  const has = (key: string) => sections.has(key);

  // Header (always included)
  blocks.push(`📋 *DAY SHEET*`);
  blocks.push(`*${show.venue_name}* — ${show.city}`);
  blocks.push(`📅 ${show.date}`);
  blocks.push("");

  if (has("contact") && (show.dos_contact_name || show.dos_contact_phone)) {
    blocks.push(`📞 *Day of Show Contact*`);
    if (show.dos_contact_name) blocks.push(`    ${show.dos_contact_name}`);
    if (show.dos_contact_phone) blocks.push(`    ${show.dos_contact_phone}`);
    blocks.push("");
  }

  if (has("venue") && show.venue_address) {
    blocks.push(`📍 *Venue*`);
    blocks.push(`    ${show.venue_address}`);
    blocks.push("");
  }

  if (has("departure") && (show.departure_time || show.departure_location)) {
    blocks.push(`🚐 *Departure*`);
    if (show.departure_time) blocks.push(`    ⏰ ${show.departure_time}`);
    if (show.departure_location) blocks.push(`    📍 ${show.departure_location}`);
    blocks.push("");
  }

  if (has("schedule") && show.schedule_entries?.length > 0) {
    const sorted = [...show.schedule_entries].sort((a: any, b: any) => a.sort_order - b.sort_order);
    blocks.push(`🕐 *Schedule*`);
    for (const entry of sorted) {
      const prefix = entry.is_band ? "⭐" : "   ";
      const bold = entry.is_band ? `*${entry.label}*` : entry.label;
      blocks.push(`    ${prefix} \`${entry.time}\`  ${bold}`);
    }
    blocks.push("");
  }

  if (has("band") && (show.set_length || show.curfew || show.changeover_time || show.backline_provided || show.catering_details)) {
    blocks.push(`🎸 *Band / Performance*`);
    if (show.set_length) blocks.push(`    Set Length: ${show.set_length}`);
    if (show.curfew) blocks.push(`    Curfew: ${show.curfew}`);
    if (show.changeover_time) blocks.push(`    Changeover: ${show.changeover_time}`);
    if (show.backline_provided) blocks.push(`    Backline: ${show.backline_provided}`);
    if (show.catering_details) blocks.push(`    Catering: ${show.catering_details}`);
    blocks.push("");
  }

  if (has("venueDetails") && (show.venue_capacity || show.ticket_price || show.age_restriction)) {
    blocks.push(`🏟️ *Venue Details*`);
    if (show.venue_capacity) blocks.push(`    Capacity: ${show.venue_capacity}`);
    if (show.ticket_price) blocks.push(`    Ticket Price: ${show.ticket_price}`);
    if (show.age_restriction) blocks.push(`    Age Restriction: ${show.age_restriction}`);
    blocks.push("");
  }

  if (has("dealTerms") && (show.guarantee || show.backend_deal)) {
    blocks.push(`💵 *Deal Terms*`);
    if (show.guarantee) blocks.push(`    Guarantee: ${show.guarantee}`);
    if (show.backend_deal) blocks.push(`    Backend: ${show.backend_deal}`);
    blocks.push("");
  }

  if (has("production") && (show.hospitality || show.support_act || show.support_pay || show.merch_split)) {
    blocks.push(`🎤 *Production*`);
    if (show.hospitality) blocks.push(`    Hospitality: ${show.hospitality}`);
    if (show.support_act) blocks.push(`    Support Act: ${show.support_act}`);
    if (show.support_pay) blocks.push(`    Support Pay: ${show.support_pay}`);
    if (show.merch_split) blocks.push(`    Merch Split: ${show.merch_split}`);
    blocks.push("");
  }

  if (has("projections") && (show.walkout_potential || show.net_gross || show.artist_comps)) {
    blocks.push(`📊 *Projections*`);
    if (show.walkout_potential) blocks.push(`    Walkout Potential: ${show.walkout_potential}`);
    if (show.net_gross) blocks.push(`    Net/Gross: ${show.net_gross}`);
    if (show.artist_comps) blocks.push(`    Artist Comps: ${show.artist_comps}`);
    blocks.push("");
  }

  if (has("parking") && show.parking_notes) {
    blocks.push(`🅿️ *Parking*`);
    blocks.push(`    ${show.parking_notes}`);
    blocks.push("");
  }

  if (has("loadIn") && show.load_in_details) {
    blocks.push(`📦 *Load In*`);
    blocks.push(`    ${show.load_in_details}`);
    blocks.push("");
  }

  if (has("greenRoom") && show.green_room_info) {
    blocks.push(`🛋️ *Green Room*`);
    blocks.push(`    ${show.green_room_info}`);
    blocks.push("");
  }

  if (has("guestList") && show.guest_list_details) {
    blocks.push(`📋 *Guest List*`);
    blocks.push(`    ${show.guest_list_details}`);
    blocks.push("");
  }

  if (has("wifi") && (show.wifi_network || show.wifi_password)) {
    blocks.push(`📶 *WiFi*`);
    if (show.wifi_network) blocks.push(`    Network: \`${show.wifi_network}\``);
    if (show.wifi_password) blocks.push(`    Password: \`${show.wifi_password}\``);
    blocks.push("");
  }

  if (has("settlement") && (show.settlement_method || show.settlement_guarantee)) {
    blocks.push(`💰 *Settlement*`);
    if (show.settlement_method) blocks.push(`    ${show.settlement_method}`);
    if (show.settlement_guarantee) blocks.push(`    ${show.settlement_guarantee}`);
    blocks.push("");
  }

  if (has("hotel") && show.hotel_name) {
    blocks.push(`🏨 *Hotel*`);
    blocks.push(`    ${show.hotel_name}`);
    if (show.hotel_address) blocks.push(`    ${show.hotel_address}`);
    if (show.hotel_confirmation) blocks.push(`    Confirmation: \`${show.hotel_confirmation}\``);
    if (show.hotel_checkin) blocks.push(`    Check-in: ${show.hotel_checkin}`);
    if (show.hotel_checkout) blocks.push(`    Check-out: ${show.hotel_checkout}`);
    blocks.push("");
  }

  if (has("travel") && show.travel_notes) {
    blocks.push(`🗺️ *Travel*`);
    blocks.push(`    ${show.travel_notes}`);
    blocks.push("");
  }

  if (has("additional") && show.additional_info) {
    blocks.push(`ℹ️ *Additional Info*`);
    blocks.push(`    ${show.additional_info}`);
    blocks.push("");
  }

  return blocks.join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { showId, sections: sectionsArr } = await req.json();
    if (!showId) {
      return new Response(JSON.stringify({ error: "showId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get show with schedule
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

    // Get webhook URL from settings
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
        JSON.stringify({ error: `Slack responded with ${slackRes.status}: ${errText}` }),
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
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
