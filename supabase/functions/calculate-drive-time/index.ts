const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { origin, destination } = await req.json();
    if (!origin || !destination) {
      return new Response(
        JSON.stringify({ error: "origin and destination are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Google Places API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url =
      `https://maps.googleapis.com/maps/api/distancematrix/json` +
      `?origins=${encodeURIComponent(origin)}` +
      `&destinations=${encodeURIComponent(destination)}` +
      `&units=imperial` +
      `&key=${apiKey}`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== "OK") {
      return new Response(
        JSON.stringify({ error: "Distance Matrix request failed", status: data.status, message: data.error_message }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const element = data.rows?.[0]?.elements?.[0];
    if (!element || element.status !== "OK") {
      return new Response(
        JSON.stringify({ error: "No route found", status: element?.status ?? "UNKNOWN" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        duration_seconds: element.duration.value as number,
        duration_text: element.duration.text as string,
        distance_text: element.distance?.text as string | undefined,
        origin_resolved: data.origin_addresses?.[0] as string | undefined,
        destination_resolved: data.destination_addresses?.[0] as string | undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
