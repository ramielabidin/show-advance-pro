// Shared Slack day-sheet push logic, used by both the manual push
// (`push-slack-daysheet`) and the scheduled push (`run-scheduled-slack-pushes`).
//
// Keep this module self-contained and framework-free — both callers pass in an
// already-constructed service-role Supabase client.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

type Block = Record<string, unknown>;

export interface DaySheetScheduleEntry {
  label?: string | null;
  time?: string | null;
  is_band?: boolean | null;
  [key: string]: unknown;
}

export interface DaySheetShow {
  id: string;
  venue_name?: string | null;
  venue_address?: string | null;
  date: string;
  schedule_entries?: DaySheetScheduleEntry[] | null;
  [key: string]: unknown;
}

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
 *
 * `createdBy` is optional — the scheduled path has no acting user, so we mint
 * links with a null creator there.
 */
export async function ensureDaySheetGuestUrl(
  supabase: SupabaseClient,
  showId: string,
  createdBy: string | null,
  baseUrl: string,
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
    const insertPayload: Record<string, unknown> = {
      token,
      show_id: showId,
      link_type: "daysheet",
    };
    if (createdBy) insertPayload.created_by = createdBy;
    const { error: insertError } = await supabase
      .from("guest_links")
      .insert(insertPayload);
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

/**
 * Render the band day sheet as a minimal Slack Block Kit "show card":
 * venue header, date + address, Load In / Set fields, and a primary
 * button linking to the guest day sheet. Everything else lives behind
 * the link.
 */
export function buildDaySheetBlocks(
  show: DaySheetShow,
  guestUrl: string | null,
): Block[] {
  const blocks: Block[] = [];

  const venue = val(show.venue_name) ?? "Show";
  blocks.push({
    type: "header",
    text: { type: "plain_text", text: venue.slice(0, 150), emoji: false },
  });

  const parts: string[] = [formatDate(show.date)];
  const addr = val(show.venue_address);
  if (addr) {
    const clean = stripCountry(addr);
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clean)}`;
    parts.push(`<${mapsUrl}|${clean}>`);
  }
  blocks.push({
    type: "section",
    text: { type: "mrkdwn", text: parts.join("\n\n") },
  });

  const entries = Array.isArray(show.schedule_entries) ? show.schedule_entries : [];
  const loadInTime =
    val(entries.find((e) => e?.label && /\bload[-\s]*in\b/i.test(String(e.label)))?.time) ?? "—";
  const setTime = val(entries.find((e) => e?.is_band)?.time) ?? "—";
  blocks.push({
    type: "section",
    fields: [
      { type: "mrkdwn", text: `*Load In*\n${loadInTime}` },
      { type: "mrkdwn", text: `*Set*\n${setTime}` },
    ],
  });

  if (guestUrl) {
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "View Day Sheet", emoji: false },
          url: guestUrl,
          style: "primary",
        },
      ],
    });
  }

  return blocks;
}

/**
 * Build the plain-text Slack `text` fallback used when a client can't render
 * Block Kit (mobile notifications, email digests, etc.).
 */
export function buildDaySheetFallback(show: DaySheetShow): string {
  return `Day sheet — ${show.venue_name} — ${formatDate(show.date)}`;
}

export interface PostDaySheetResult {
  ok: boolean;
  status: number;
  error?: string;
}

/**
 * Post a fully-formed day-sheet payload to the given webhook URL. Stamps
 * `shows.slack_daysheet_pushed_at` on success so that subsequent scheduler
 * ticks (and manual pushes on the same day) no-op. Stamping is best-effort:
 * a failure to stamp is logged but does not fail the push, since the message
 * has already gone out.
 */
export async function postDaySheetToSlack(
  supabase: SupabaseClient,
  opts: {
    show: DaySheetShow;
    webhookUrl: string;
    guestUrl: string | null;
  },
): Promise<PostDaySheetResult> {
  const { show, webhookUrl, guestUrl } = opts;
  const blocks = buildDaySheetBlocks(show, guestUrl);
  const text = buildDaySheetFallback(show);

  let slackRes: Response;
  try {
    slackRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks, text }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "network error";
    console.error("Slack webhook fetch error:", msg);
    return { ok: false, status: 0, error: `Slack request failed: ${msg}` };
  }

  if (!slackRes.ok) {
    const errText = await slackRes.text().catch(() => "");
    console.error("Slack webhook error:", slackRes.status, errText);
    return {
      ok: false,
      status: slackRes.status,
      error: `Slack responded with ${slackRes.status}`,
    };
  }
  await slackRes.text().catch(() => "");

  const { error: stampErr } = await supabase
    .from("shows")
    .update({ slack_daysheet_pushed_at: new Date().toISOString() })
    .eq("id", show.id);
  if (stampErr) {
    console.error("Failed to stamp slack_daysheet_pushed_at:", stampErr);
  }

  return { ok: true, status: slackRes.status };
}
