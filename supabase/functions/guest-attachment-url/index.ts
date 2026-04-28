import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const BUCKET = "inbound-attachments";
const SIGNED_URL_EXPIRY_SECS = 3600; // 1 hour

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { token, attachment_id } = await req.json();
    if (!token || !attachment_id) {
      return json({ error: "token and attachment_id are required" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Validate the guest token and resolve the show_id.
    const { data: link, error: linkError } = await supabase
      .from("guest_links")
      .select("show_id")
      .eq("token", token)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .limit(1)
      .maybeSingle();

    if (linkError || !link) {
      return json({ error: "Invalid or expired guest link" }, 401);
    }

    // Verify the attachment belongs to this show (prevents cross-show enumeration).
    const { data: attachment, error: attError } = await supabase
      .from("inbound_email_attachments")
      .select("storage_path")
      .eq("id", attachment_id)
      .eq("show_id", link.show_id)
      .maybeSingle();

    if (attError || !attachment) {
      return json({ error: "Attachment not found" }, 404);
    }

    const { data: signed, error: signError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(attachment.storage_path, SIGNED_URL_EXPIRY_SECS);

    if (signError || !signed?.signedUrl) {
      return json({ error: "Failed to generate download URL" }, 500);
    }

    return json({ url: signed.signedUrl });
  } catch (err) {
    console.error("guest-attachment-url error:", err);
    return json({ error: "Internal error" }, 500);
  }
});
