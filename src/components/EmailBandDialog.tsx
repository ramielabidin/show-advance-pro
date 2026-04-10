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
import { ALL_SECTION_KEYS, BAND_VIEW_KEYS, withData, type SectionKey } from "@/lib/daysheetSections";
import DaySheetSectionPicker from "@/components/DaySheetSectionPicker";
import type { Show } from "@/lib/types";

// ---------------------------------------------------------------------------
// HTML email body builder
// ---------------------------------------------------------------------------

function fieldLine(label: string, value: string | null | undefined): string {
  if (!value?.trim()) return "";
  return `${label}: ${value.trim()}`;
}

/** Parse guest_list_details which may be JSON or plain text. */
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
    // not JSON — fall through to plain text
  }
  return raw.trim();
}

function sectionBlock(title: string, lines: string[]): string {
  const filled = lines.filter(Boolean);
  if (filled.length === 0) return "";
  return `${title.toUpperCase()}\n${filled.join("\n")}`;
}

function buildPlainTextBody(
  show: Show & { schedule_entries?: any[] },
  selected: Set<SectionKey>,
  greeting: string
): string {
  const parts: string[] = [];

  if (greeting.trim()) {
    parts.push(greeting.trim());
  }

  if (selected.has("venue")) {
    const rawAddr = show.venue_address?.replace(/,?\s*United States$/i, "") ?? "";
    const addrLine = rawAddr ? `Address: ${rawAddr}` : "";
    parts.push(sectionBlock("Venue", [addrLine]));
  }
  if (selected.has("schedule") && show.schedule_entries?.length) {
    const sorted = [...show.schedule_entries].sort((a, b) => a.sort_order - b.sort_order);
    const lines = sorted.map((e) => `${e.time}  ${e.label}`);
    if (show.set_length?.trim()) lines.push(`Set Length: ${show.set_length.trim()}`);
    parts.push(sectionBlock("Schedule", lines));
  }
  if (selected.has("departure")) {
    parts.push(sectionBlock("Departure", [
      fieldLine("Time", show.departure_time),
      fieldLine("Location", show.departure_location),
    ]));
  }
  if (selected.has("contact")) {
    parts.push(sectionBlock("Day of Show Contact", [
      fieldLine("Name", show.dos_contact_name),
      fieldLine("Phone", show.dos_contact_phone),
    ]));
  }
  if (selected.has("loadIn") && show.load_in_details?.trim()) {
    parts.push(sectionBlock("Load In", [show.load_in_details.trim()]));
  }
  if (selected.has("parking") && show.parking_notes?.trim()) {
    parts.push(sectionBlock("Parking", [show.parking_notes.trim()]));
  }
  if (selected.has("backline") && show.backline_provided?.trim()) {
    parts.push(sectionBlock("Backline", [show.backline_provided.trim()]));
  }
  if (selected.has("greenRoom") && show.green_room_info?.trim()) {
    parts.push(sectionBlock("Green Room", [show.green_room_info.trim()]));
  }
  if (selected.has("hospitality") && show.hospitality?.trim()) {
    parts.push(sectionBlock("Hospitality", [show.hospitality.trim()]));
  }
  if (selected.has("wifi")) {
    parts.push(sectionBlock("WiFi", [
      fieldLine("Network", show.wifi_network),
      fieldLine("Password", show.wifi_password),
    ]));
  }
  if (selected.has("guestList") && show.guest_list_details?.trim()) {
    parts.push(sectionBlock("Guest List", [formatGuestList(show.guest_list_details)]));
  }
  if (selected.has("hotel")) {
    parts.push(sectionBlock("Accommodations", [
      fieldLine("Name", show.hotel_name),
      fieldLine("Address", show.hotel_address),
      fieldLine("Confirmation #", show.hotel_confirmation),
      fieldLine("Check In", show.hotel_checkin),
      fieldLine("Check Out", show.hotel_checkout),
    ]));
  }
  if (selected.has("travel") && show.travel_notes?.trim()) {
    parts.push(sectionBlock("Travel", [show.travel_notes.trim()]));
  }
  if (selected.has("dealTerms")) {
    parts.push(sectionBlock("Deal Terms", [
      fieldLine("Guarantee", show.guarantee),
      fieldLine("Ticket Price", show.ticket_price),
      fieldLine("Capacity", show.venue_capacity),
      fieldLine("Walkout Potential", show.walkout_potential),
      fieldLine("Backend Deal", show.backend_deal),
    ]));
  }
  if (selected.has("additional") && show.additional_info?.trim()) {
    parts.push(sectionBlock("Additional Info", [show.additional_info.trim()]));
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
    const body = buildPlainTextBody(show, selected, greeting);
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
      setSelected(new Set(BAND_VIEW_KEYS));
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
          {/* Greeting line */}
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
