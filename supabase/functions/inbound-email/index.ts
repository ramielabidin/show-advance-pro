import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { checkRateLimit } from "../_shared/rate-limit.ts";

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

// Cap on the concatenated thread blob stored on a single pending event.
// parse-advance accepts up to 40k chars; we keep a generous 3x that so the
// full conversation is preserved for display / audit, and truncate oldest
// content first if a thread grows past the cap.
const MAX_THREAD_CHARS = 120_000;
const TRUNCATION_MARKER = "[… earlier messages truncated …]\n\n";

// Per-team rate limit. A leaked or guessed routing token would otherwise let
// an attacker flood inbound_parse_events + the attachments bucket; this caps
// legitimate teams to a generous 50 inbound emails / hour.
const RATE_LIMIT_MAX = 50;
const RATE_LIMIT_WINDOW_SEC = 60 * 60;

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

// Dedup key: the Gmail thread ID. The forwarding script is the preferred
// source — it passes `gmail_thread_id` explicitly after calling threads.get
// to concatenate every message in the thread into one blob. For inbound that
// arrives straight from SendGrid we fall back to the `Thread-Index` /
// `References` / `In-Reply-To` headers so retries and forwards of existing
// threads still dedupe correctly.
//
// Known limitation: if a forwarding setup strips `References:` but keeps
// `In-Reply-To:`, each reply picks up its parent's Message-ID as the thread
// key instead of the root's, so replies in the same conversation land as
// separate rows. The common Gmail path preserves `References:` and groups
// correctly; fix this only if real-world breakage shows up.
function extractThreadId(form: FormData): string | null {
  const explicit = String(form.get("gmail_thread_id") ?? "").trim();
  if (explicit) return explicit;
  const headers = String(form.get("headers") ?? "");
  if (!headers) return null;
  const threadIndex = /^Thread-Index:\s*(\S+)/im.exec(headers);
  if (threadIndex) return threadIndex[1].trim();
  const references = /^References:\s*<([^<>\s]+)>/im.exec(headers);
  if (references) return references[1].trim();
  const inReplyTo = /^In-Reply-To:\s*<([^<>\s]+)>/im.exec(headers);
  if (inReplyTo) return inReplyTo[1].trim();
  const messageId = /^Message-ID:\s*<?([^<>\s]+)>?/im.exec(headers);
  return messageId ? messageId[1].trim() : null;
}

// Heuristic match: score upcoming shows against the email's subject + body.
// Returns the best candidate and a coarse confidence bucket.
//   high → venue name + date both present in the email
//   low  → only one signal present, or venue found but no explicit date
// Runs on substrings, not AI, so a venue like "9:30 Club" matches "9:30 club".
interface MatchCandidate { id: string; venue_name: string; city: string | null; date: string }

function scoreShow(show: MatchCandidate, haystack: string): { score: number; dateHit: boolean; venueHit: boolean } {
  const venueHit = show.venue_name.length >= 3 && haystack.includes(show.venue_name.toLowerCase());
  const datePatterns = buildDatePatterns(show.date);
  const dateHit = datePatterns.some((p) => haystack.includes(p));
  let score = 0;
  if (venueHit) score += 2;
  if (dateHit) score += 2;
  if (venueHit && dateHit) score += 1; // combined bonus to break ties
  return { score, dateHit, venueHit };
}

function buildDatePatterns(isoDate: string): string[] {
  // isoDate is YYYY-MM-DD. Generate a handful of common written forms,
  // lowercase so they align with the normalized haystack.
  const [y, m, d] = isoDate.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return [isoDate];
  const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  const monthsLong = ["january","february","march","april","may","june","july","august","september","october","november","december"];
  const mShort = months[m - 1];
  const mLong = monthsLong[m - 1];
  return [
    isoDate,
    `${m}/${d}/${y}`,
    `${m}/${d}/${String(y).slice(2)}`,
    `${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}/${y}`,
    `${mShort} ${d}`,
    `${mShort}. ${d}`,
    `${mLong} ${d}`,
    `${d} ${mShort}`,
    `${d} ${mLong}`,
  ];
}

async function findBestMatch(
  admin: ReturnType<typeof createClient>,
  teamId: string,
  subject: string | null,
  body: string,
): Promise<{ showId: string; confidence: "high" | "low" } | null> {
  const haystack = `${subject ?? ""}\n${body}`.toLowerCase();
  if (!haystack.trim()) return null;

  const today = new Date().toISOString().slice(0, 10);
  const { data: shows, error } = await admin
    .from("shows")
    .select("id, venue_name, city, date")
    .eq("team_id", teamId)
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(100);
  if (error || !shows || shows.length === 0) return null;

  let best: { show: MatchCandidate; score: number; venueHit: boolean; dateHit: boolean } | null = null;
  for (const raw of shows as MatchCandidate[]) {
    const s = scoreShow(raw, haystack);
    if (s.score === 0) continue;
    if (!best || s.score > best.score) {
      best = { show: raw, ...s };
    }
  }
  if (!best) return null;

  const confidence: "high" | "low" = best.venueHit && best.dateHit ? "high" : "low";
  return { showId: best.show.id, confidence };
}

// Append a new reply onto an existing thread blob, keeping chronological
// order (oldest first). Clamps to MAX_THREAD_CHARS by dropping from the
// front, which preserves the most recent content — the AI parser is
// instructed to prefer the most up-to-date information in a thread.
function appendToThread(existing: string, incoming: string, from: string | null): string {
  const stamp = new Date().toISOString();
  const fromLabel = from ? ` from ${from}` : "";
  const separator = `\n\n--- Reply on ${stamp}${fromLabel} ---\n\n`;
  const combined = `${existing}${separator}${incoming}`;
  if (combined.length <= MAX_THREAD_CHARS) return combined;
  const keep = MAX_THREAD_CHARS - TRUNCATION_MARKER.length;
  const tail = combined.slice(combined.length - keep);
  return `${TRUNCATION_MARKER}${tail}`;
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

    // Silently drop (still 200) when a team is over its hourly inbound budget.
    // Returning non-200 would make SendGrid retry the message and amplify the
    // very thing we're trying to suppress.
    const rl = await checkRateLimit({
      admin,
      bucket: "inbound-email",
      key: `team:${teamId}`,
      maxRequests: RATE_LIMIT_MAX,
      windowSeconds: RATE_LIMIT_WINDOW_SEC,
    });
    if (!rl.allowed) {
      console.error("inbound-email rate limited:", teamId);
      return ok({ ok: true, rate_limited: true });
    }

    const text = String(form.get("text") ?? "").trim();
    const html = String(form.get("html") ?? "").trim();
    const rawEmailText = text || (html ? htmlToText(html) : "");
    if (!rawEmailText) {
      console.error("inbound-email empty body");
      return ok();
    }

    const from = String(form.get("from") ?? "").trim() || null;
    const subject = String(form.get("subject") ?? "").trim() || null;
    const threadId = extractThreadId(form);

    // Thread-based dedupe. If we've seen this thread before:
    //   - status='pending'       → append the new reply onto the existing
    //                              raw_email_text so parse-advance later sees
    //                              the full conversation, not just the last
    //                              reply. from_address / email_subject track
    //                              the latest sender (most useful in the queue).
    //   - reviewed or dismissed  → leave JT's existing work alone, skip insert
    //                              and skip attachments — don't silently
    //                              re-open a settled thread.
    let eventId: string | null = null;
    if (threadId) {
      const { data: existing, error: lookupErr } = await admin
        .from("inbound_parse_events")
        .select("id, status, raw_email_text")
        .eq("gmail_thread_id", threadId)
        .maybeSingle();
      if (lookupErr) {
        console.error("inbound-email thread lookup failed:", lookupErr.message);
      } else if (existing) {
        if (existing.status !== "pending") {
          return ok({ ok: true, deduped: true, event_id: existing.id });
        }
        const merged = appendToThread(
          String(existing.raw_email_text ?? ""),
          rawEmailText,
          from,
        );
        const { error: updateErr } = await admin
          .from("inbound_parse_events")
          .update({
            raw_email_text: merged,
            email_subject: subject,
            from_address: from,
          })
          .eq("id", existing.id);
        if (updateErr) {
          console.error("inbound-email thread update failed:", updateErr.message);
        }
        eventId = String(existing.id);
      }
    }

    if (!eventId) {
      const match = await findBestMatch(admin, teamId, subject, rawEmailText);

      const { data: event, error: insertErr } = await admin
        .from("inbound_parse_events")
        .insert({
          team_id: teamId,
          raw_email_text: rawEmailText,
          from_address: from,
          email_subject: subject,
          gmail_thread_id: threadId,
          matched_show_id: match?.showId ?? null,
          match_confidence: match?.confidence ?? null,
        })
        .select("id")
        .single();
      if (insertErr || !event) {
        console.error("inbound-email event insert failed:", insertErr?.message);
        return ok();
      }
      eventId = String(event.id);
    }

    // Unreachable — every branch above either assigned eventId or returned —
    // but narrows the type for the attachment block.
    if (!eventId) return ok();

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
