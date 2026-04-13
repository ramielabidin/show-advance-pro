const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { input } = await req.json();
    if (!input || typeof input !== "string" || input.trim().length < 2) {
      return new Response(
        JSON.stringify({ predictions: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Google Places API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use Places Autocomplete API restricted to geocodes (cities, regions, addresses)
    const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
    url.searchParams.set("input", input.trim());
    url.searchParams.set("types", "(cities)");
    url.searchParams.set("components", "country:us");
    url.searchParams.set("key", apiKey);

    const res = await fetch(url.toString());
    const data = await res.json();

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      return new Response(
        JSON.stringify({ error: `Places API error: ${data.status}`, predictions: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const predictions = (data.predictions ?? []).slice(0, 6).map((p: any) => ({
      description: p.description,
      place_id: p.place_id,
    }));

    return new Response(
      JSON.stringify({ predictions }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: msg, predictions: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
