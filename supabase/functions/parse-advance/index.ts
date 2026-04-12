import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const { emailText } = await req.json();
    if (!emailText || typeof emailText !== "string" || emailText.trim().length < 10) {
      return new Response(JSON.stringify({ error: "Text is required (min 10 chars)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

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
- For the schedule, extract ALL timed events (not just the band's). Mark events that are clearly the band's own events (load in, soundcheck, set time) with is_band=true.
- For additional_info, include anything relevant that doesn't fit the structured fields — production specs, dressing room codes, misc venue policies, etc.
- Dates should be in YYYY-MM-DD format.
- Times should be in simple format like "3:00 PM" or "15:00".
- If a field isn't clearly present in the text, OMIT it entirely. Never guess or fabricate values.
- If the input is messy or partial, do your best — even extracting 2-3 fields is valuable.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
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
                departure_location: { type: "string", description: "Departure meetup location" },
                parking_notes: { type: "string", description: "Parking instructions" },
                load_in_details: { type: "string", description: "Load-in logistics details" },
                green_room_info: { type: "string", description: "Green room / dressing room details" },
                guest_list_details: { type: "string", description: "Guest list info and policies" },
                wifi_network: { type: "string", description: "WiFi network name" },
                wifi_password: { type: "string", description: "WiFi password" },
                hotel_name: { type: "string", description: "Hotel / accommodations name" },
                hotel_address: { type: "string", description: "Hotel / accommodations address" },
                hotel_confirmation: { type: "string", description: "Hotel confirmation number" },
                hotel_checkin: { type: "string", description: "Hotel check-in time" },
                hotel_checkout: { type: "string", description: "Hotel check-out time" },
                travel_notes: { type: "string", description: "Travel/drive notes" },
                set_length: { type: "string", description: "Duration of the band's set, e.g. '75 min'" },
                curfew: { type: "string", description: "Stage or venue curfew time, e.g. '11:00 PM'" },
                backline_provided: { type: "string", description: "Backline/gear provided by the venue" },
                changeover_time: { type: "string", description: "Changeover time between acts, e.g. '20 min'" },
                venue_capacity: { type: "string", description: "Venue capacity" },
                ticket_price: { type: "string", description: "Ticket price" },
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
                      is_band: { type: "boolean", description: "True if this is the band's own event (their load in, soundcheck, set, etc.)" },
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
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const result = await response.json();
    const toolUse = result.content?.find((block: { type: string }) => block.type === "tool_use");

    if (!toolUse?.input) {
      throw new Error("AI did not return structured data");
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = typeof toolUse.input === "string" ? JSON.parse(toolUse.input) : toolUse.input;
    } catch {
      throw new Error("AI returned invalid JSON");
    }

    return new Response(JSON.stringify({ show: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-advance error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
