import { supabase } from "@/integrations/supabase/client";
import { isDuplicateContact } from "@/lib/contactRoles";
import { resolveShowTimezoneInBackground } from "@/lib/resolveShowTimezone";

export interface ParsedShowSchedule {
  time: string;
  label: string;
  is_band?: boolean;
}

export interface ParsedShowContact {
  name: string;
  phone?: string | null;
  email?: string | null;
  role?: string;
  role_label?: string | null;
  notes?: string | null;
}

export interface ParsedShow {
  venue_name: string;
  city: string;
  date: string;
  schedule?: ParsedShowSchedule[];
  contacts?: ParsedShowContact[];
  [key: string]: unknown;
}

export interface SaveParsedShowResult {
  showId: string;
  isNew: boolean;
}

function normalizeContact(c: ParsedShowContact) {
  const role = c.role && c.role.trim() ? c.role.trim() : "day_of_show";
  return {
    name: (c.name ?? "").trim(),
    phone: c.phone?.trim() || null,
    email: c.email?.trim() || null,
    role,
    role_label: role === "custom" ? (c.role_label?.trim() || null) : null,
    notes: c.notes?.trim() || null,
  };
}

/**
 * Save a parsed show: match existing by venue_name + date (scoped to team),
 * update if found or insert if new, replace schedule entries, and append any
 * parsed contacts (deduping against existing rows on the show).
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
  const contacts = (parsed.contacts ?? []).filter((c) => c && c.name && c.name.trim());
  const { schedule: _schedule, contacts: _contacts, ...showFields } = parsed;
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

    if (contacts.length > 0) {
      const { data: existingContacts, error: existingErr } = await supabase
        .from("show_contacts")
        .select("name, phone, email, sort_order")
        .eq("show_id", showId);
      if (existingErr) throw existingErr;
      const baseSort = existingContacts?.length ?? 0;
      const toInsert = contacts
        .map(normalizeContact)
        .filter((c) => !isDuplicateContact(c, existingContacts ?? []));
      if (toInsert.length > 0) {
        const { error: contactErr } = await supabase.from("show_contacts").insert(
          toInsert.map((c, i) => ({ ...c, show_id: showId, sort_order: baseSort + i })),
        );
        if (contactErr) throw contactErr;
      }
    }

    resolveShowTimezoneInBackground({
      showId,
      venue_address: (showFields as Record<string, unknown>).venue_address as string | null | undefined,
      city: parsed.city,
      venue_name: parsed.venue_name,
    });
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

  if (contacts.length > 0) {
    const { error: contactErr } = await supabase.from("show_contacts").insert(
      contacts.map(normalizeContact).map((c, i) => ({
        ...c,
        show_id: newShow.id,
        sort_order: i,
      })),
    );
    if (contactErr) throw contactErr;
  }

  resolveShowTimezoneInBackground({
    showId: newShow.id,
    venue_address: (showFields as Record<string, unknown>).venue_address as string | null | undefined,
    city: parsed.city,
    venue_name: parsed.venue_name,
  });

  return { showId: newShow.id, isNew: true };
}
