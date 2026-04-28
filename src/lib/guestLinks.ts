import { nanoid } from "nanoid";
import { supabase } from "@/integrations/supabase/client";

// The guest_links table and RPCs aren't in the generated Database types yet —
// regenerate src/integrations/supabase/types.ts after applying the migration and
// the casts below can be tightened. Until then, use a pragmatic untyped handle.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as unknown as any;

export type GuestLinkType = "daysheet" | "guestlist";

export interface GuestLinkRow {
  id: string;
  token: string;
  show_id: string;
  link_type: GuestLinkType;
  created_by: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  label: string | null;
}

export interface GuestScheduleEntry {
  id: string;
  time: string | null;
  label: string | null;
  is_band: boolean | null;
  sort_order: number | null;
}

export interface GuestContact {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  role: string;
  role_label: string | null;
  notes: string | null;
  sort_order: number | null;
}

export interface GuestAttachment {
  id: string;
  original_filename: string;
  size_bytes: number | null;
  content_type: string | null;
}

// Payload returned by the `get_guest_show` RPC. Deal / financial fields are
// deliberately omitted server-side so they never reach the client.
export interface GuestShowPayload {
  link_type: GuestLinkType;
  expires_at: string;
  id: string;
  artist_name: string | null;
  date: string | null;
  venue_name: string | null;
  venue_address: string | null;
  city: string | null;
  departure_time: string | null;
  departure_notes: string | null;
  parking_notes: string | null;
  load_in_details: string | null;
  green_room_info: string | null;
  guest_list_details: string | null;
  artist_comps: string | null;
  venue_capacity: number | string | null;
  wifi_network: string | null;
  wifi_password: string | null;
  hotel_name: string | null;
  hotel_address: string | null;
  hotel_confirmation: string | null;
  hotel_checkin: string | null;
  hotel_checkin_date: string | null;
  hotel_checkout: string | null;
  hotel_checkout_date: string | null;
  set_length: string | null;
  additional_info: string | null;
  schedule_entries: GuestScheduleEntry[];
  contacts: GuestContact[];
  attachments: GuestAttachment[];
}

const TOKEN_LENGTH = 17;

export function buildGuestUrl(token: string): string {
  return `${window.location.origin}/guest/${token}`;
}

export async function getActiveGuestLink(
  showId: string,
  linkType: GuestLinkType,
): Promise<GuestLinkRow | null> {
  const { data, error } = await sb
    .from("guest_links")
    .select("*")
    .eq("show_id", showId)
    .eq("link_type", linkType)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as GuestLinkRow | null) ?? null;
}

async function revokeActiveLinksForShow(showId: string, linkType: GuestLinkType): Promise<void> {
  const { error } = await sb
    .from("guest_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("show_id", showId)
    .eq("link_type", linkType)
    .is("revoked_at", null);
  if (error) throw error;
}

export async function revokeGuestLink(linkId: string): Promise<void> {
  const { error } = await sb
    .from("guest_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", linkId);
  if (error) throw error;
}

export async function generateGuestLink(
  showId: string,
  linkType: GuestLinkType,
  createdBy: string,
): Promise<GuestLinkRow> {
  await revokeActiveLinksForShow(showId, linkType);
  const token = nanoid(TOKEN_LENGTH);
  const { data, error } = await sb
    .from("guest_links")
    .insert({
      token,
      show_id: showId,
      link_type: linkType,
      created_by: createdBy,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as GuestLinkRow;
}

export async function fetchGuestShow(token: string): Promise<GuestShowPayload | null> {
  const { data, error } = await sb.rpc("get_guest_show", { p_token: token });
  if (error) throw error;
  return (data as GuestShowPayload | null) ?? null;
}

export async function updateGuestListByToken(token: string, guestList: string): Promise<void> {
  const { error } = await sb.rpc("update_guest_list_by_token", {
    p_token: token,
    p_guest_list: guestList,
  });
  if (error) throw error;
}
