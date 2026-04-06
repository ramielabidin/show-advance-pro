import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { emailText } = await req.json();
    if (!emailText || typeof emailText !== "string" || emailText.trim().length < 10) {
      return new Response(JSON.stringify({ error: "Email text is required (min 10 chars)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are an expert at parsing advance emails for live music shows. 
An "advance" is an email exchange between a band's manager/tour manager and a venue's production contact. 
It contains logistics for an upcoming show: load-in times, soundcheck, set times, parking, green room info, WiFi, settlement details, hotel info, etc.

Your job is to extract all structured data from the email thread. 
- If multiple emails are in the thread, synthesize the most up-to-date information.
- For the schedule, extract ALL timed events (not just the band's). Mark events that are clearly the band's own events (load in, soundcheck, set time, doors for their show) with is_band=true.
- For additional_info, include anything relevant that doesn't fit the structured fields — catering details, merch info, age restrictions, curfew, production specs, guest parking, dressing room codes, etc.
- Dates should be in YYYY-MM-DD format.
- Times should be in simple format like "3:00 PM" or "15:00".
- If a field isn't mentioned in the email, omit it (don't guess).`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Parse this advance email and extract all show details:\n\n${emailText}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_show_details",
              description: "Extract structured show details from an advance email",
              parameters: {
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
                  settlement_method: { type: "string", description: "Payment method (check, cash, wire, etc.)" },
                  settlement_guarantee: { type: "string", description: "Guarantee amount" },
                  hotel_name: { type: "string", description: "Hotel name" },
                  hotel_address: { type: "string", description: "Hotel address" },
                  hotel_confirmation: { type: "string", description: "Hotel confirmation number" },
                  hotel_checkin: { type: "string", description: "Hotel check-in time" },
                  hotel_checkout: { type: "string", description: "Hotel check-out time" },
                  travel_notes: { type: "string", description: "Travel/drive notes" },
                  set_length: { type: "string", description: "Duration of the band's set, e.g. '75 min', '60-90 min'" },
                  curfew: { type: "string", description: "Stage or venue curfew time, e.g. '11:00 PM'" },
                  backline_provided: { type: "string", description: "Backline/gear provided by the venue, e.g. 'Full backline, no amps'" },
                  catering_details: { type: "string", description: "Catering info, meal times, buyouts, rider details" },
                  changeover_time: { type: "string", description: "Changeover time between acts, e.g. '20 min'" },
                  additional_info: { type: "string", description: "Any other relevant info from the email that doesn't fit the structured fields above — merch, production specs, age restrictions, dressing room codes, etc." },
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
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_show_details" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings → Workspace → Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("AI did not return structured data");
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(toolCall.function.arguments);
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
