import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// SendGrid Inbound Parse webhook.
// Accepts multipart/form-data, extracts the routing token from the `to`
// header, and queues the email for JT to review via the existing parse flow.
// Always returns 200 so SendGrid does not retry. PII is never logged.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
};

const MAX_ATTACHMENTS = 10;
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const BUCKET = "inbound-attachments";

function ok(body: unknown = { ok: true }) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Parse the local part of an RFC 5322 address field. SendGrid's `to` may be
// `"Advance" <abc123de@parse.advancetouring.com>, other@foo.com` — we want the
// first local part that looks like our token (8 chars, lowercase alnum).
function extractToken(rawTo: string): string | null {
  if (!rawTo) return null;
  const addressPattern = /<?([^<>@\s,;]+)@[^<>\s,;]+>?/g;
  let match: RegExpExecArray | null;
  while ((match = addressPattern.exec(rawTo)) !== null) {
    const local = match[1].toLowerCase();
    if (/^[a-z2-9]{8}$/.test(local)) return local;
  }
  return null;
}

// Minimal HTML → text fallback when SendGrid omits the `text` field.
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120) || "file";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") return ok();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("inbound-email missing env");
      return ok();
    }
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    let form: FormData;
    try {
      form = await req.formData();
    } catch (e) {
      console.error("inbound-email form parse failed:", e instanceof Error ? e.message : "unknown");
      return ok();
    }

    const to = String(form.get("to") ?? "");
    const token = extractToken(to);
    if (!token) return ok();

    const { data: settings, error: settingsErr } = await admin
      .from("app_settings")
      .select("team_id")
      .eq("inbound_email_token", token)
      .limit(1)
      .maybeSingle();
    if (settingsErr) {
      console.error("inbound-email settings lookup failed:", settingsErr.message);
      return ok();
    }
    if (!settings?.team_id) return ok();
    const teamId: string = settings.team_id;

    const text = String(form.get("text") ?? "").trim();
    const html = String(form.get("html") ?? "").trim();
    const rawEmailText = text || (html ? htmlToText(html) : "");
    if (!rawEmailText) {
      console.error("inbound-email empty body");
      return ok();
    }

    const from = String(form.get("from") ?? "").trim() || null;
    const subject = String(form.get("subject") ?? "").trim() || null;

    const { data: event, error: insertErr } = await admin
      .from("inbound_parse_events")
      .insert({
        team_id: teamId,
        raw_email_text: rawEmailText,
        from_address: from,
        email_subject: subject,
      })
      .select("id")
      .single();
    if (insertErr || !event) {
      console.error("inbound-email event insert failed:", insertErr?.message);
      return ok();
    }
    const eventId: string = event.id;

    // Collect PDF attachments. SendGrid exposes them as attachment1, attachment2, …
    // and the count in the `attachments` field. Non-PDFs are silently skipped.
    const attachmentCount = parseInt(String(form.get("attachments") ?? "0"), 10) || 0;
    let totalBytes = 0;
    const saved: Array<{ storage_path: string; original_filename: string; content_type: string; size_bytes: number }> = [];

    for (let i = 1; i <= attachmentCount && i <= MAX_ATTACHMENTS; i++) {
      const file = form.get(`attachment${i}`);
      if (!(file instanceof File)) continue;
      const contentType = file.type || "application/octet-stream";
      if (contentType !== "application/pdf") continue;
      const size = file.size;
      if (size <= 0 || totalBytes + size > MAX_ATTACHMENT_BYTES) continue;
      totalBytes += size;

      const original = sanitizeFilename(file.name || `attachment-${i}.pdf`);
      const path = `${teamId}/${eventId}/${i}-${original}`;
      const buf = new Uint8Array(await file.arrayBuffer());

      const { error: uploadErr } = await admin.storage
        .from(BUCKET)
        .upload(path, buf, { contentType, upsert: false });
      if (uploadErr) {
        console.error("inbound-email upload failed:", uploadErr.message);
        continue;
      }
      saved.push({
        storage_path: path,
        original_filename: original,
        content_type: contentType,
        size_bytes: size,
      });
    }

    if (saved.length > 0) {
      const { error: attachErr } = await admin
        .from("inbound_email_attachments")
        .insert(
          saved.map((s) => ({
            event_id: eventId,
            team_id: teamId,
            storage_path: s.storage_path,
            original_filename: s.original_filename,
            content_type: s.content_type,
            size_bytes: s.size_bytes,
          })),
        );
      if (attachErr) {
        console.error("inbound-email attachment row insert failed:", attachErr.message);
      }
    }

    return ok();
  } catch (e) {
    console.error("inbound-email unhandled:", e instanceof Error ? e.message : "unknown");
    return ok();
  }
});
