import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_INPUT_CHARS = 40_000;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_REQUESTS = 10;
const DUPLICATE_SUPPRESSION_SECONDS = 5;
const ANTHROPIC_MAX_RETRIES = 2;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function callAnthropicWithRetry(body: string, apiKey: string) {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= ANTHROPIC_MAX_RETRIES; attempt++) {
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body,
      });
      if (response.ok) return response;
      // Retry on 429 and 5xx; bail on other 4xx.
      if (response.status !== 429 && response.status < 500) return response;
      lastErr = new Error(`Anthropic ${response.status}`);
    } catch (e) {
      lastErr = e;
    }
    if (attempt < ANTHROPIC_MAX_RETRIES) {
      const delayMs = 250 * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr ?? new Error("Anthropic request failed");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return json({ error: "Missing authorization header" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      console.error("parse-advance auth failed:", authError?.status);
      return json({ error: "Unauthorized" }, 401);
    }

    const { emailText } = await req.json();
    if (!emailText || typeof emailText !== "string" || emailText.trim().length < 10) {
      return json({ error: "Text is required (min 10 chars)" }, 400);
    }
    if (emailText.length > MAX_INPUT_CHARS) {
      return json(
        { error: `Input too large (max ${MAX_INPUT_CHARS.toLocaleString()} chars)` },
        413,
      );
    }

    // Rate limiting + duplicate suppression. Uses service role so the
    // table stays invisible to clients.
    const admin = serviceRoleKey
      ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
      : null;

    const contentHash = await sha256Hex(emailText);

    if (admin) {
      const windowStart = new Date(
        Date.now() - RATE_LIMIT_WINDOW_SECONDS * 1000,
      ).toISOString();
      const { count, error: countErr } = await admin
        .from("parse_advance_requests")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", windowStart);
      if (countErr) {
        console.error("parse-advance rate check failed:", countErr.message);
      } else if ((count ?? 0) >= RATE_LIMIT_MAX_REQUESTS) {
        return json(
          { error: "Too many parse requests. Please wait a moment and try again." },
          429,
        );
      }

      const dupWindowStart = new Date(
        Date.now() - DUPLICATE_SUPPRESSION_SECONDS * 1000,
      ).toISOString();
      const { data: dup, error: dupErr } = await admin
        .from("parse_advance_requests")
        .select("id")
        .eq("user_id", user.id)
        .eq("content_hash", contentHash)
        .gte("created_at", dupWindowStart)
        .limit(1);
      if (dupErr) {
        console.error("parse-advance dedup check failed:", dupErr.message);
      } else if (dup && dup.length > 0) {
        return json(
          { error: "Duplicate submission — wait a few seconds before retrying." },
          429,
        );
      }

      const { error: insertErr } = await admin.from("parse_advance_requests").insert({
        user_id: user.id,
        content_hash: contentHash,
        input_bytes: emailText.length,
      });
      if (insertErr) {
        console.error("parse-advance rate insert failed:", insertErr.message);
      }
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const systemPrompt = `You are an expert at parsing advance information for live music shows.

You will receive text that could be in ANY of these formats:
- A forwarded advance email thread between a band's manager and a venue contact
- A venue tech packet or production rider (often extracted from a PDF)
- Copy-pasted text from a venue's website
- A partial advance with only a few fields filled in
- Raw text with scattered show details

Your job is to extract ALL structured data you can find, regardless of input format.

Key rules:
- Extract whatever relevant fields you can find. It's fine if most fields are missing — only return what's actually present in the text.
- If multiple emails are in a thread, synthesize the most up-to-date information.
- For the schedule, extract ALL timed events (not just the band's). Mark only the band's actual performance/set slot with is_band=true — do NOT mark logistical events like load in or soundcheck as is_band.
- For additional_info, include anything relevant that doesn't fit the structured fields — production specs, dressing room codes, misc venue policies, etc.
- Dates should be in YYYY-MM-DD format.
- Times should be in simple format like "3:00 PM" or "15:00".
- If a field isn't clearly present in the text, OMIT it entirely. Never guess or fabricate values.
- If the input is messy or partial, do your best — even extracting 2-3 fields is valuable.`;

    const requestBody = JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        { role: "user", content: `Parse the following text and extract all show details you can find:\n\n${emailText}` },
      ],
      tools: [
        {
          name: "extract_show_details",
          description: "Extract structured show details from advance text in any format",
          input_schema: {
            type: "object",
            properties: {
              venue_name: { type: "string", description: "Name of the venue" },
              venue_address: { type: "string", description: "Full street address of the venue" },
              city: { type: "string", description: "City and state, e.g. 'Nashville, TN'" },
              date: { type: "string", description: "Show date in YYYY-MM-DD format" },
              dos_contact_name: { type: "string", description: "Day of show contact person name" },
              dos_contact_phone: { type: "string", description: "Day of show contact phone number" },
              departure_time: { type: "string", description: "Departure/call time" },
              departure_notes: { type: "string", description: "Departure notes and meetup location" },
              parking_notes: { type: "string", description: "Parking instructions" },
              load_in_details: { type: "string", description: "Load-in logistics details" },
              green_room_info: { type: "string", description: "Green room / dressing room details" },
              guest_list_details: { type: "string", description: "Actual guest names only (e.g. 'John Smith +1, Jane Doe'). Leave null if the text only describes a guest list policy, deadline, or request — not real names." },
              wifi_network: { type: "string", description: "WiFi network name" },
              wifi_password: { type: "string", description: "WiFi password" },
              hotel_name: { type: "string", description: "Hotel / accommodations name" },
              hotel_address: { type: "string", description: "Hotel / accommodations address" },
              hotel_confirmation: { type: "string", description: "Hotel confirmation number" },
              hotel_checkin: { type: "string", description: "Hotel check-in time" },
              hotel_checkout: { type: "string", description: "Hotel check-out time" },
              set_length: { type: "string", description: "Duration of the band's set, e.g. '75 min'" },
              backline_provided: { type: "string", description: "Backline/gear provided by the venue" },
              changeover_time: { type: "string", description: "Changeover time between acts, e.g. '20 min'" },
              venue_capacity: { type: "string", description: "Venue capacity" },
              ticket_price: { type: "string", description: "Ticket price. If multiple tiers exist (e.g. presale/advance/door), preserve them with slash separators exactly as written, e.g. '$18/$20/$25'. Do NOT concatenate digits or omit the slashes." },
              guarantee: { type: "string", description: "Guarantee amount" },
              backend_deal: { type: "string", description: "Backend deal terms" },
              hospitality: { type: "string", description: "Hospitality / rider details" },
              walkout_potential: { type: "string", description: "Walkout potential amount" },
              artist_comps: { type: "string", description: "Artist comp tickets" },
              additional_info: { type: "string", description: "Any other relevant info that doesn't fit the structured fields above" },
              schedule: {
                type: "array",
                description: "All timed events for the day",
                items: {
                  type: "object",
                  properties: {
                    time: { type: "string", description: "Event time, e.g. '3:00 PM'" },
                    label: { type: "string", description: "Event description, e.g. 'Load In' or 'Doors'" },
                    is_band: { type: "boolean", description: "True only if this is the band's actual performance/set slot. False for load in, soundcheck, doors, opener, curfew, and all other events." },
                  },
                  required: ["time", "label", "is_band"],
                },
              },
            },
            required: ["venue_name", "city", "date"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "extract_show_details" },
    });

    const response = await callAnthropicWithRetry(requestBody, ANTHROPIC_API_KEY);

    if (!response.ok) {
      if (response.status === 429) {
        return json(
          { error: "Rate limit exceeded. Please try again in a moment." },
          429,
        );
      }
      console.error("parse-advance upstream error:", response.status);
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const result = await response.json();
    const toolUse = result.content?.find((block: { type: string }) => block.type === "tool_use");
    if (!toolUse?.input) throw new Error("AI did not return structured data");

    let parsed: Record<string, unknown>;
    try {
      parsed = typeof toolUse.input === "string" ? JSON.parse(toolUse.input) : toolUse.input;
    } catch {
      throw new Error("AI returned invalid JSON");
    }

    return json({ show: parsed });
  } catch (e) {
    // Intentionally minimal: never log the user's input text (may contain
    // PII such as phone numbers, addresses, guest names).
    console.error("parse-advance error:", e instanceof Error ? e.message : "unknown");
    return json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      500,
    );
  }
});
