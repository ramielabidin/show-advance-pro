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
  // deno-lint-ignore no-explicit-any
  supabase: any,
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

function sectionHeader(text: string): Block {
  return { type: "section", text: { type: "mrkdwn", text } };
}

function sectionText(text: string): Block {
  return { type: "section", text: { type: "mrkdwn", text } };
}

function fieldsBlock(fields: string[]): Block {
  return {
    type: "section",
    fields: fields.map((text) => ({ type: "mrkdwn", text })),
  };
}

/**
 * Render the band day sheet as Slack Block Kit blocks.
 * Band-relevant sections only, populated fields only.
 */
function buildDaySheetBlocks(show: any, guestUrl: string | null): Block[] {
  const blocks: Block[] = [];

  const pushDivider = () => {
    if (blocks.length && (blocks[blocks.length - 1] as any).type !== "divider") {
      blocks.push({ type: "divider" });
    }
  };

  const artist = val(show.teams?.name);
  const venue = show.venue_name;
  const heroLines: string[] = [];
  heroLines.push(artist ? `*${artist} at ${venue}*` : `*${venue}*`);
  heroLines.push(formatDate(show.date));
  const addr = val(show.venue_address);
  if (addr) heroLines.push(stripCountry(addr));
  blocks.push(sectionText(heroLines.join("\n")));

  if (guestUrl) {
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Open Day Sheet", emoji: true },
          url: guestUrl,
          style: "primary",
        },
      ],
    });
  }

  if (show.schedule_entries?.length > 0) {
    pushDivider();
    blocks.push(sectionHeader("*🕐 SCHEDULE*"));
    const sorted = [...show.schedule_entries].sort(
      (a: any, b: any) => a.sort_order - b.sort_order
    );
    const fields: string[] = [];
    for (const entry of sorted) {
      const setInline =
        entry.is_band && val(show.set_length) ? ` (${val(show.set_length)})` : "";
      fields.push(`*${entry.time}*`);
      fields.push(`${entry.label}${setInline}`);
    }
    for (let i = 0; i < fields.length; i += 8) {
      blocks.push(fieldsBlock(fields.slice(i, i + 8)));
    }
  }

  if (val(show.dos_contact_name) || val(show.dos_contact_phone)) {
    pushDivider();
    blocks.push(sectionHeader("*📞 DAY OF SHOW CONTACT*"));
    const fields: string[] = [];
    if (val(show.dos_contact_name)) fields.push(`*Name:* ${val(show.dos_contact_name)}`);
    if (val(show.dos_contact_phone)) fields.push(`*Phone:* ${val(show.dos_contact_phone)}`);
    blocks.push(fieldsBlock(fields));
  }

  if (val(show.departure_time) || val(show.departure_notes)) {
    pushDivider();
    blocks.push(sectionHeader("*🚗 DEPARTURE*"));
    const parts: string[] = [];
    if (val(show.departure_time)) parts.push(`*Time:* ${val(show.departure_time)}`);
    if (val(show.departure_notes)) parts.push(`*Notes:* ${val(show.departure_notes)}`);
    blocks.push(sectionText(parts.join("\n\n")));
  }

  if (val(show.parking_notes) || val(show.load_in_details)) {
    pushDivider();
    blocks.push(sectionHeader("*📍 ARRIVAL*"));
    const parts: string[] = [];
    if (val(show.parking_notes)) parts.push(`*Parking:* ${val(show.parking_notes)}`);
    if (val(show.load_in_details)) parts.push(`*Load In:* ${val(show.load_in_details)}`);
    blocks.push(sectionText(parts.join("\n\n")));
  }

  const hasGreenRoom = !!val(show.green_room_info);
  const hasWifi = !!val(show.wifi_network) && !!val(show.wifi_password);
  const hasHospitality = !!val(show.hospitality);
  if (hasGreenRoom || hasWifi || hasHospitality) {
    blocks.push(sectionHeader("*🎸 AT THE VENUE*"));
    const parts: string[] = [];
    if (hasGreenRoom) parts.push(`*Green Room:* ${val(show.green_room_info)}`);
    if (hasWifi)
      parts.push(
        `*WiFi:* Network: ${val(show.wifi_network)} · Password: ${val(show.wifi_password)}`
      );
    if (hasHospitality) parts.push(`*Hospitality:* ${val(show.hospitality)}`);
    blocks.push(sectionText(parts.join("\n\n")));
  }

  if (val(show.hotel_name)) {
    pushDivider();
    blocks.push(sectionHeader("*🏨 ACCOMMODATIONS*"));
    const parts: string[] = [`*Hotel:* ${val(show.hotel_name)}`];
    if (val(show.hotel_address)) parts.push(`*Address:* ${val(show.hotel_address)}`);
    if (val(show.hotel_confirmation))
      parts.push(`*Confirmation:* ${val(show.hotel_confirmation)}`);
    const ci = val(show.hotel_checkin);
    const co = val(show.hotel_checkout);
    if (ci && co) parts.push(`*Check-in:* ${ci} · *Check-out:* ${co}`);
    else if (ci) parts.push(`*Check-in:* ${ci}`);
    else if (co) parts.push(`*Check-out:* ${co}`);
    blocks.push(sectionText(parts.join("\n\n")));
  }

  if (val(show.guest_list_details)) {
    const formatted = formatGuestList(val(show.guest_list_details)!);
    if (formatted) {
      pushDivider();
      blocks.push(sectionHeader("*📝 GUEST LIST*"));
      blocks.push(sectionText(formatted));
    }
  }

  blocks.push({
    type: "context",
    elements: [
      { type: "mrkdwn", text: "Sent with <https://advancetouring.com|Advance>" },
    ],
  });

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
