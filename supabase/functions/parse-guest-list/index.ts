import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { checkRateLimit } from "../_shared/rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_INPUT_CHARS = 20_000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const ANTHROPIC_MAX_RETRIES = 2;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
      console.error("parse-guest-list auth failed:", authError?.status);
      return json({ error: "Unauthorized" }, 401);
    }

    const { text } = await req.json();
    if (!text || typeof text !== "string" || text.trim().length < 2) {
      return json({ error: "Text is required" }, 400);
    }
    if (text.length > MAX_INPUT_CHARS) {
      return json(
        { error: `Input too large (max ${MAX_INPUT_CHARS.toLocaleString()} chars)` },
        413,
      );
    }

    if (serviceRoleKey) {
      const admin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
      });
      const rl = await checkRateLimit({
        admin,
        bucket: "parse-guest-list",
        key: `user:${user.id}`,
        maxRequests: RATE_LIMIT_MAX_REQUESTS,
        windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
      });
      if (!rl.allowed) {
        return json(
          { error: "Too many parse requests. Please wait a moment and try again." },
          429,
        );
      }
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const systemPrompt = `You extract a guest list from arbitrary text.

The input may be:
- A messy free-text list ("john smith +1, jane doe plus 2, mike (artist guest)")
- A CSV (with or without headers; columns vary)
- A pasted spreadsheet
- A Slack thread or email body that contains names mixed with chatter
- Any combination of the above

Your job is to return a clean array of { name, plus_ones } objects.

Rules:
- Each entry should be one real person's name. Use the cleanest version (proper case, no leading bullets/numbers/dashes).
- "+1", "plus one", "plus 1", "+2 guests", "and a guest", "and 2 friends" all map to plus_ones (1, 1, 1, 2, 1, 2).
- If no plus-ones are mentioned for a person, set plus_ones to 0.
- A name like "Smith, John" (CSV style) should be flipped to "John Smith".
- If the input has a header row (e.g. "Name, +1, Notes" or "first,last,guests"), use it to interpret columns. Do NOT include the header itself as a guest.
- Skip non-name lines: chatter, commentary, "here's the list:", "thanks!", section headers like "ARTIST GUESTS", policy text, deadlines, ticket-policy reminders.
- Do NOT invent names. If you can't read it, skip it.
- Cap plus_ones at 9 (anything higher is almost certainly a parse error).
- Preserve order from the input where possible.
- If the input clearly contains zero guest names, return an empty array.`;

    const requestBody = JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Extract the guest list from the following text:\n\n${text}`,
        },
      ],
      tools: [
        {
          name: "extract_guest_list",
          description: "Extract a clean guest list from arbitrary input text",
          input_schema: {
            type: "object",
            properties: {
              guests: {
                type: "array",
                description: "The cleaned guest list, in the order they appear in the input.",
                items: {
                  type: "object",
                  properties: {
                    name: {
                      type: "string",
                      description: "Full name of the guest in proper case.",
                    },
                    plus_ones: {
                      type: "integer",
                      minimum: 0,
                      maximum: 9,
                      description: "Number of additional guests this person is bringing (0 if none mentioned).",
                    },
                  },
                  required: ["name", "plus_ones"],
                },
              },
            },
            required: ["guests"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "extract_guest_list" },
    });

    const response = await callAnthropicWithRetry(requestBody, ANTHROPIC_API_KEY);

    if (!response.ok) {
      if (response.status === 429) {
        return json(
          { error: "Rate limit exceeded. Please try again in a moment." },
          429,
        );
      }
      console.error("parse-guest-list upstream error:", response.status);
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const result = await response.json();
    const toolUse = result.content?.find((block: { type: string }) => block.type === "tool_use");
    if (!toolUse?.input) throw new Error("AI did not return structured data");

    let parsed: { guests?: unknown };
    try {
      parsed = typeof toolUse.input === "string" ? JSON.parse(toolUse.input) : toolUse.input;
    } catch {
      throw new Error("AI returned invalid JSON");
    }

    const rawGuests = Array.isArray(parsed.guests) ? parsed.guests : [];
    const guests = rawGuests
      .filter(
        (g): g is { name: string; plus_ones: number } =>
          !!g &&
          typeof g === "object" &&
          typeof (g as { name?: unknown }).name === "string" &&
          (g as { name: string }).name.trim().length > 0,
      )
      .map((g) => ({
        name: g.name.trim(),
        plus_ones: Math.max(
          0,
          Math.min(9, Number.isFinite(g.plus_ones) ? Math.floor(g.plus_ones) : 0),
        ),
      }));

    return json({ guests });
  } catch (e) {
    // Never log the user's input text — it may contain PII (guest names).
    console.error(
      "parse-guest-list error:",
      e instanceof Error ? e.message : "unknown",
    );
    return json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      500,
    );
  }
});
