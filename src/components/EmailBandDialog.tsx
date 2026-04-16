import { Mail } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/components/TeamProvider";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatCityState } from "@/lib/utils";
import { hasData, type SectionKey } from "@/lib/daysheetSections";
import type { Show } from "@/lib/types";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function fieldLine(label: string, value: string | null | undefined): string {
  if (!value?.trim()) return "";
  return `${label}: ${value.trim()}`;
}

function val(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || s.toLowerCase() === "tbd" || s.toLowerCase() === "n/a") return null;
  return s;
}

function formatGuestList(raw: string | null | undefined): string {
  if (!raw?.trim()) return "";
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((entry: any) => {
          const name = entry.name ?? entry.Name ?? "";
          const plus = entry.plusOnes ?? entry.plus_ones ?? entry.plusOne ?? 0;
          return plus > 0 ? `${String(name)} +${plus}` : String(name);
        })
        .filter(Boolean)
        .join("\n");
    }
  } catch {
    // not JSON
  }
  return raw!.trim();
}

function sectionBlock(title: string, lines: string[]): string {
  const filled = lines.filter(Boolean);
  if (filled.length === 0) return "";
  return `${title.toUpperCase()}\n${filled.join("\n")}`;
}

const DEFAULT_GREETING = "Hey fellas —";

function buildPlainTextBody(show: Show & { schedule_entries?: any[] }): string {
  const parts: string[] = [];
  const has = (k: SectionKey) => hasData(show, k);

  parts.push(DEFAULT_GREETING);

  if (has("contact")) {
    parts.push(sectionBlock("Day of Show Contact", [
      fieldLine("Name", val(show.dos_contact_name)),
      fieldLine("Phone", val(show.dos_contact_phone)),
    ]));
  }

  if (has("venue")) {
    const rawAddr = show.venue_address?.replace(/,?\s*United States$/i, "") ?? "";
    parts.push(sectionBlock("Venue", [rawAddr ? `Address: ${rawAddr}` : ""]));
  }

  if (has("schedule") && show.schedule_entries?.length) {
    const sorted = [...show.schedule_entries].sort((a, b) => a.sort_order - b.sort_order);
    const lines = sorted.map((e) => {
      const setInline = e.is_band && val(show.set_length) ? ` (${val(show.set_length)})` : "";
      return `${e.time}  ${e.label}${setInline}`;
    });
    if (val(show.curfew)) lines.push(`${val(show.curfew)}  Curfew`);
    parts.push(sectionBlock("Schedule", lines));
  }

  if (has("departure")) {
    parts.push(sectionBlock("Departure", [
      fieldLine("Time", val(show.departure_time)),
      fieldLine("Notes", val(show.departure_location)),
    ]));
  }

  if (has("parking")) {
    parts.push(sectionBlock("Parking", [val(show.parking_notes)!]));
  }

  if (has("loadIn")) {
    parts.push(sectionBlock("Load In", [val(show.load_in_details)!]));
  }

  if (has("greenRoom")) {
    parts.push(sectionBlock("Green Room", [val(show.green_room_info)!]));
  }

  if (has("venueDetails")) {
    const fields: string[] = [];
    if (val(show.venue_capacity)) fields.push(fieldLine("Capacity", val(show.venue_capacity)));
    if (val(show.age_restriction)) fields.push(fieldLine("Age Restriction", val(show.age_restriction)));
    if (fields.some(Boolean)) parts.push(sectionBlock("Venue Details", fields));
  }

  if (has("guestList")) {
    parts.push(sectionBlock("Guest List", [formatGuestList(show.guest_list_details)]));
  }

  if (has("wifi")) {
    parts.push(sectionBlock("WiFi", [
      fieldLine("Network", val(show.wifi_network)),
      fieldLine("Password", val(show.wifi_password)),
    ]));
  }

  if (has("hotel")) {
    parts.push(sectionBlock("Accommodations", [
      fieldLine("Name", val(show.hotel_name)),
      fieldLine("Address", val(show.hotel_address)),
      fieldLine("Confirmation #", val(show.hotel_confirmation)),
      fieldLine("Check In", val(show.hotel_checkin)),
      fieldLine("Check Out", val(show.hotel_checkout)),
    ]));
  }

  return parts.filter(Boolean).join("\n\n");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface EmailBandDialogProps {
  show: Show & { schedule_entries?: any[] };
  trigger?: React.ReactNode;
}

export default function EmailBandDialog({ show, trigger }: EmailBandDialogProps) {
  const { teamId } = useTeam();

  const { data: members = [] } = useQuery({
    queryKey: ["touring-party", teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("touring_party_members")
        .select("email")
        .eq("team_id", teamId!);
      if (error) throw error;
      return data;
    },
    enabled: !!teamId,
  });

  const handleSend = () => {
    const emails = members.map((m) => m.email).filter(Boolean);
    if (emails.length === 0) {
      toast.error("No touring party members with email addresses");
      return;
    }
    const dateStr = format(parseISO(show.date), "EEEE, MMMM d, yyyy");
    const subject = `${dateStr} - ${show.venue_name} (${formatCityState(show.city)}) - Day Sheet`;
    const body = buildPlainTextBody(show);
    const gmailUrl =
      "https://mail.google.com/mail/?view=cm" +
      `&to=${encodeURIComponent(emails.join(","))}` +
      `&su=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, "_blank");
  };

  if (trigger) {
    return (
      <span
        onClick={(e) => {
          e.preventDefault();
          handleSend();
        }}
      >
        {trigger}
      </span>
    );
  }

  return (
    <Button variant="outline" size="sm" className="gap-1.5" onClick={handleSend}>
      <Mail className="h-4 w-4" /> Email Band
    </Button>
  );
}
