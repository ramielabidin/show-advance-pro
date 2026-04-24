// Scheduled entry point for Slack day-sheet automation.
//
// Dispatched every 5 minutes by pg_cron → pg_net (see the
// `dispatch_scheduled_slack_pushes()` function in migration
// 20260424014442_slack_auto_daysheet.sql). Authenticates the caller via a
// shared `X-Cron-Secret` header — JWT verification is intentionally disabled
// for this function so pg_net can reach it without a user session.
//
// For each team that has Slack connected + automation enabled, find today's
// (or the adjacent day's) shows that haven't yet been pushed, resolve the
// venue's IANA timezone lazily if missing, and push the day sheet once the
// venue-local wall clock has crossed the configured push time.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import {
  ensureDaySheetGuestUrl,
  postDaySheetToSlack,
  type DaySheetScheduleEntry,
} from "../_shared/slack-daysheet.ts";
import { nowInTimezone, resolveVenueTimezone } from "../_shared/timezone.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

// Safety valve — per team, how many scheduled pushes we'll dispatch per hour
// regardless of how many eligible shows the query returns. Stops a schema
// regression from paging the artist's Slack channel.
const RATE_LIMIT_MAX = 50;
const RATE_LIMIT_WINDOW_SEC = 3600;

interface TeamAutomationSettings {
  team_id: string;
  slack_webhook_url: string;
  slack_auto_daysheet_time: string; // HH:MM (24h)
}

interface ShowRow {
  id: string;
  team_id: string;
  venue_name: string;
  venue_address: string | null;
  city: string | null;
  date: string;
  venue_timezone: string | null;
  slack_daysheet_pushed_at: string | null;
  schedule_entries?: DaySheetScheduleEntry[] | null;
}

function adjacentDates(now: Date): string[] {
  // Cover yesterday-UTC / today-UTC / tomorrow-UTC so the "show date in local
  // tz" comparison below has a candidate row for every IANA zone regardless of
  // where we are in the UTC day.
  const out: string[] = [];
  for (const offset of [-1, 0, 1]) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() + offset);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function baseUrlFromSupabaseUrl(): string | null {
  const raw = Deno.env.get("SLACK_DAYSHEET_APP_URL")
    ?? Deno.env.get("APP_URL")
    ?? null;
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

async function getVenueTimezone(
  supabase: SupabaseClient,
  show: ShowRow,
  googleKey: string | null,
): Promise<string | null> {
  if (show.venue_timezone) return show.venue_timezone;
  if (!googleKey) {
    console.warn(`No Google API key; cannot resolve tz for show ${show.id}`);
    return null;
  }
  const resolved = await resolveVenueTimezone(
    {
      venue_address: show.venue_address,
      city: show.city,
      venue_name: show.venue_name,
    },
    googleKey,
  );
  if (!resolved) return null;
  const { error } = await supabase
    .from("shows")
    .update({ venue_timezone: resolved })
    .eq("id", show.id);
  if (error) console.error(`Failed to persist venue_timezone for ${show.id}:`, error);
  return resolved;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const providedSecret = req.headers.get("x-cron-secret");
  const expectedSecret = Deno.env.get("CRON_SECRET");
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const googleKey = Deno.env.get("GOOGLE_PLACES_API_KEY") ?? null;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const appBaseUrl = baseUrlFromSupabaseUrl();

    const { data: teamSettings, error: settingsErr } = await supabase
      .from("app_settings")
      .select("team_id, slack_webhook_url, slack_auto_daysheet_time")
      .eq("slack_auto_daysheet_enabled", true)
      .not("slack_webhook_url", "is", null)
      .returns<TeamAutomationSettings[]>();
    if (settingsErr) throw settingsErr;

    const summary = {
      success: true,
      teams: teamSettings?.length ?? 0,
      processed: 0,
      pushed: 0,
      skipped: 0,
      errors: [] as { showId: string; error: string }[],
    };
    if (!teamSettings || teamSettings.length === 0) {
      return new Response(JSON.stringify(summary), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dateWindow = adjacentDates(new Date());

    for (const settings of teamSettings) {
      const rl = await checkRateLimit({
        admin: supabase,
        bucket: "scheduled-slack-daysheet",
        key: `team:${settings.team_id}`,
        maxRequests: RATE_LIMIT_MAX,
        windowSeconds: RATE_LIMIT_WINDOW_SEC,
      });
      if (!rl.allowed) {
        console.warn(`Rate limit hit for team ${settings.team_id}; skipping this tick`);
        continue;
      }

      const { data: shows, error: showsErr } = await supabase
        .from("shows")
        .select(
          "id, team_id, venue_name, venue_address, city, date, venue_timezone, slack_daysheet_pushed_at, schedule_entries(*)",
        )
        .eq("team_id", settings.team_id)
        .is("slack_daysheet_pushed_at", null)
        .in("date", dateWindow)
        .returns<ShowRow[]>();
      if (showsErr) {
        console.error(`Failed to fetch shows for team ${settings.team_id}:`, showsErr);
        continue;
      }

      for (const show of shows ?? []) {
        summary.processed += 1;
        try {
          const tz = await getVenueTimezone(supabase, show, googleKey);
          if (!tz) {
            console.warn(`No timezone for show ${show.id}; skipping`);
            summary.skipped += 1;
            continue;
          }
          const { date: localDate, time: localTime } = nowInTimezone(tz);
          if (localDate !== show.date) {
            summary.skipped += 1;
            continue;
          }
          if (localTime < settings.slack_auto_daysheet_time) {
            summary.skipped += 1;
            continue;
          }

          const guestUrl = appBaseUrl
            ? await ensureDaySheetGuestUrl(supabase, show.id, null, appBaseUrl)
            : null;

          const result = await postDaySheetToSlack(supabase, {
            show,
            webhookUrl: settings.slack_webhook_url,
            guestUrl,
          });
          if (result.ok) {
            summary.pushed += 1;
          } else {
            summary.errors.push({
              showId: show.id,
              error: result.error ?? `status ${result.status}`,
            });
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error(`Scheduled push failed for show ${show.id}:`, msg);
          summary.errors.push({ showId: show.id, error: msg });
        }
      }
    }

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("run-scheduled-slack-pushes error:", msg);
    return new Response(
      JSON.stringify({ success: false, error: "An internal error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
