import { useState } from "react";
import { Mail } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/components/TeamProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatCityState } from "@/lib/utils";
import {
  ALL_SECTION_KEYS,
  BAND_VIEW_KEYS,
  withData,
  isBandHidden,
  type SectionKey,
} from "@/lib/daysheetSections";
import DaySheetSectionPicker from "@/components/DaySheetSectionPicker";
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

function buildPlainTextBody(
  show: Show & { schedule_entries?: any[] },
  selected: Set<SectionKey>,
  greeting: string,
  bandMode: boolean
): string {
  const parts: string[] = [];
  const has = (k: SectionKey) => selected.has(k);
  const hidden = (sec: SectionKey, field: string) => isBandHidden(sec, field, bandMode);

  if (greeting.trim()) parts.push(greeting.trim());

  if (has("contact") && (val(show.dos_contact_name) || val(show.dos_contact_phone))) {
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

  if (has("departure") && (val(show.departure_time) || val(show.departure_location))) {
    parts.push(sectionBlock("Departure", [
      fieldLine("Time", val(show.departure_time)),
      fieldLine("Notes", val(show.departure_location)),
    ]));
  }

  if (has("parking") && val(show.parking_notes)) {
    parts.push(sectionBlock("Parking", [val(show.parking_notes)!]));
  }

  if (has("loadIn") && val(show.load_in_details)) {
    parts.push(sectionBlock("Load In", [val(show.load_in_details)!]));
  }

  if (has("greenRoom") && val(show.green_room_info)) {
    parts.push(sectionBlock("Green Room", [val(show.green_room_info)!]));
  }

  if (has("venueDetails")) {
    const fields: string[] = [];
    if (val(show.venue_capacity)) fields.push(fieldLine("Capacity", val(show.venue_capacity)));
    if (!hidden("venueDetails", "ticket_price") && val(show.ticket_price))
      fields.push(fieldLine("Ticket Price", val(show.ticket_price)));
    if (val(show.age_restriction)) fields.push(fieldLine("Age Restriction", val(show.age_restriction)));
    if (fields.some(Boolean)) parts.push(sectionBlock("Venue Details", fields));
  }

  if (has("band")) {
    const fields: string[] = [];
    if (val(show.set_length)) fields.push(fieldLine("Set Length", val(show.set_length)));
    if (val(show.curfew)) fields.push(fieldLine("Curfew", val(show.curfew)));
    if (val(show.support_act)) fields.push(fieldLine("Support Act", val(show.support_act)));
    if (!hidden("band", "support_pay") && val(show.support_pay))
      fields.push(fieldLine("Support Pay", val(show.support_pay)));
    if (fields.some(Boolean)) parts.push(sectionBlock("Band & Performance", fields));
  }

  if (has("dealTerms")) {
    parts.push(sectionBlock("Deal Terms", [
      fieldLine("Guarantee", val(show.guarantee)),
      fieldLine("Backend", val(show.backend_deal)),
    ]));
  }

  if (has("hospitality") && val(show.hospitality)) {
    parts.push(sectionBlock("Hospitality", [val(show.hospitality)!]));
  }

  if (has("guestList") && val(show.guest_list_details)) {
    parts.push(sectionBlock("Guest List", [formatGuestList(show.guest_list_details)]));
  }

  if (has("projections")) {
    parts.push(sectionBlock("Projections", [
      fieldLine("Walkout Potential", val(show.walkout_potential)),
      fieldLine("Net/Gross", val(show.net_gross)),
    ]));
  }

  if (has("wifi") && (val(show.wifi_network) || val(show.wifi_password))) {
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

  if (has("travel") && val(show.travel_notes)) {
    parts.push(sectionBlock("Travel", [val(show.travel_notes)!]));
  }

  if (has("additional")) {
    const lines: string[] = [];
    if (val(show.additional_info)) lines.push(val(show.additional_info)!);
    if (val(show.merch_split)) lines.push(fieldLine("Merch Split", val(show.merch_split)));
    if (lines.length) parts.push(sectionBlock("Additional Info", lines));
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
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<SectionKey>>(new Set());
  const [bandMode, setBandMode] = useState(true);
  const [greeting, setGreeting] = useState("Hey fellas —");
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
    enabled: open && !!teamId,
  });

  const handleSend = () => {
    const emails = members.map((m) => m.email).filter(Boolean);
    if (emails.length === 0) {
      toast.error("No touring party members with email addresses");
      return;
    }
    const dateStr = format(parseISO(show.date), "EEEE, MMMM d, yyyy");
    const subject = `${dateStr} - ${show.venue_name} (${formatCityState(show.city)}) - Day Sheet`;
    const body = buildPlainTextBody(show, selected, greeting, bandMode);
    const gmailUrl =
      "https://mail.google.com/mail/?view=cm" +
      `&to=${encodeURIComponent(emails.join(","))}` +
      `&su=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, "_blank");
    setOpen(false);
  };

  const handleOpen = (v: boolean) => {
    setOpen(v);
    if (v) {
      setSelected(withData(BAND_VIEW_KEYS, show));
      setBandMode(true);
      setGreeting("Hey fellas —");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-1.5">
            <Mail className="h-4 w-4" /> Email Band
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Email Day Sheet to Band</DialogTitle>
          <DialogDescription>
            Choose sections to include. Opens your email client with the day sheet pre-filled.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <div className="space-y-1.5 pb-3 border-b border-border">
            <Label htmlFor="email-greeting" className="text-sm text-muted-foreground">
              Greeting
            </Label>
            <Input
              id="email-greeting"
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              className="text-sm"
            />
          </div>

          <DaySheetSectionPicker
            show={show}
            selected={selected}
            onChange={setSelected}
            onBandModeChange={setBandMode}
            idPrefix="email"
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSend} disabled={selected.size === 0} className="gap-1.5">
            <Mail className="h-4 w-4" />
            Send Email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
