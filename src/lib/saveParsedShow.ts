import { supabase } from "@/integrations/supabase/client";

export interface ParsedShowSchedule {
  time: string;
  label: string;
  is_band?: boolean;
}

export interface ParsedShow {
  venue_name: string;
  city: string;
  date: string;
  schedule?: ParsedShowSchedule[];
  [key: string]: unknown;
}

export interface SaveParsedShowResult {
  showId: string;
  isNew: boolean;
}

/**
 * Save a parsed show: match existing by venue_name + date (scoped to team),
 * update if found or insert if new, and replace schedule entries.
 *
 * Mirrors the behaviour previously inlined in CreateShowDialog so the inbound
 * email review flow can save directly without opening that dialog.
 */
export async function saveParsedShow(
  parsed: ParsedShow,
  teamId: string,
): Promise<SaveParsedShowResult> {
  if (!parsed.venue_name || !parsed.city || !parsed.date) {
    throw new Error("Parsed result is missing venue, city, or date");
  }

  const schedule = parsed.schedule ?? [];
  const { schedule: _schedule, ...showFields } = parsed;
  const advanceImportedAt = new Date().toISOString();

  const { data: existingShows, error: lookupErr } = await supabase
    .from("shows")
    .select("id")
    .eq("team_id", teamId)
    .eq("venue_name", parsed.venue_name)
    .eq("date", parsed.date)
    .limit(1);
  if (lookupErr) throw lookupErr;

  if (existingShows && existingShows.length > 0) {
    const showId = existingShows[0].id;
    const { error: updateError } = await supabase
      .from("shows")
      .update({ ...showFields, is_reviewed: false, advance_imported_at: advanceImportedAt })
      .eq("id", showId);
    if (updateError) throw updateError;

    await supabase.from("schedule_entries").delete().eq("show_id", showId);
    if (schedule.length > 0) {
      const { error: scheduleErr } = await supabase.from("schedule_entries").insert(
        schedule.map((entry, i) => ({
          show_id: showId,
          time: entry.time,
          label: entry.label,
          is_band: entry.is_band ?? false,
          sort_order: i,
        })),
      );
      if (scheduleErr) throw scheduleErr;
    }
    return { showId, isNew: false };
  }

  const { data: newShow, error: insertError } = await supabase
    .from("shows")
    .insert({ ...showFields, is_reviewed: false, team_id: teamId, advance_imported_at: advanceImportedAt })
    .select("id")
    .single();
  if (insertError || !newShow) throw insertError ?? new Error("Failed to create show");

  if (schedule.length > 0) {
    const { error: scheduleErr } = await supabase.from("schedule_entries").insert(
      schedule.map((entry, i) => ({
        show_id: newShow.id,
        time: entry.time,
        label: entry.label,
        is_band: entry.is_band ?? false,
        sort_order: i,
      })),
    );
    if (scheduleErr) throw scheduleErr;
  }
  return { showId: newShow.id, isNew: true };
}
