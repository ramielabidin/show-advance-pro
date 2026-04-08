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

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function fieldHtml(label: string, value: string | null | undefined): string {
  if (!value?.trim()) return "";
  return `${esc(label)}: ${esc(value.trim())}`;
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
          return plus > 0 ? `${esc(String(name))} +${plus}` : esc(String(name));
        })
        .filter(Boolean)
        .join("<br>");
    }
  } catch {
    // not JSON — fall through to plain text
  }
  return esc(raw.trim());
}

function sectionBlock(title: string, lines: string[]): string {
  const filled = lines.filter(Boolean);
  if (filled.length === 0) return "";
  return `<b>${esc(title)}</b><br>${filled.join("<br>")}`;
}

function buildHtmlBody(
  show: Show & { schedule_entries?: any[] },
  selected: Set<SectionKey>,
  greeting: string
): string {
  const parts: string[] = [];

  if (greeting.trim()) {
    parts.push(esc(greeting.trim()));
  }

  if (selected.has("venue")) {
    const rawAddr = show.venue_address?.replace(/,?\s*United States$/i, "") ?? "";
    const addrDisplay = esc(rawAddr);
    const mapsUrl = rawAddr
      ? `https://maps.google.com/?q=${encodeURIComponent(rawAddr)}`
      : null;
    const addrLine = rawAddr
      ? mapsUrl
        ? `Address: <a href="${mapsUrl}">${addrDisplay}</a>`
        : `Address: ${addrDisplay}`
      : "";
    parts.push(sectionBlock("Venue", [
      addrLine,
      fieldHtml("City", formatCityState(show.city)),
    ]));
  }
  if (selected.has("contact")) {
    parts.push(sectionBlock("Day of Show Contact", [
      fieldHtml("Name", show.dos_contact_name),
      fieldHtml("Phone", show.dos_contact_phone),
    ]));
  }
  if (selected.has("departure")) {
    parts.push(sectionBlock("Departure", [
      fieldHtml("Time", show.departure_time),
      fieldHtml("Location", show.departure_location),
    ]));
  }
  if (selected.has("schedule") && show.schedule_entries?.length) {
    const sorted = [...show.schedule_entries].sort((a, b) => a.sort_order - b.sort_order);
    parts.push(sectionBlock("Schedule", sorted.map((e) => `${esc(e.time)}  ${esc(e.label)}`)));
  }
  if (selected.has("band")) {
    parts.push(sectionBlock("Band / Performance", [
      fieldHtml("Set Length", show.set_length),
      fieldHtml("Curfew", show.curfew),
      fieldHtml("Changeover", show.changeover_time),
      fieldHtml("Backline", show.backline_provided),
      fieldHtml("Catering", show.catering_details),
    ]));
  }
  if (selected.has("venueDetails")) {
    parts.push(sectionBlock("Venue Details", [
      fieldHtml("Capacity", show.venue_capacity),
      fieldHtml("Ticket Price", show.ticket_price),
      fieldHtml("Age Restriction", show.age_restriction),
    ]));
  }
  if (selected.has("dealTerms")) {
    parts.push(sectionBlock("Deal Terms", [
      fieldHtml("Guarantee", show.guarantee),
      fieldHtml("Backend Deal", show.backend_deal),
    ]));
  }
  if (selected.has("production")) {
    parts.push(sectionBlock("Production", [
      fieldHtml("Hospitality", show.hospitality),
      fieldHtml("Support Act", show.support_act),
      fieldHtml("Support Pay", show.support_pay),
      fieldHtml("Merch Split", show.merch_split),
    ]));
  }
  if (selected.has("projections")) {
    parts.push(sectionBlock("Projections", [
      fieldHtml("Walkout Potential", show.walkout_potential),
      fieldHtml("Net Gross", show.net_gross),
      fieldHtml("Artist Comps", show.artist_comps),
    ]));
  }
  if (selected.has("parking") && show.parking_notes?.trim()) {
    parts.push(sectionBlock("Parking", [esc(show.parking_notes.trim())]));
  }
  if (selected.has("loadIn") && show.load_in_details?.trim()) {
    parts.push(sectionBlock("Load In", [esc(show.load_in_details.trim())]));
  }
  if (selected.has("greenRoom") && show.green_room_info?.trim()) {
    parts.push(sectionBlock("Green Room", [esc(show.green_room_info.trim())]));
  }
  if (selected.has("guestList")) {
    const gl = formatGuestList(show.guest_list_details);
    if (gl) parts.push(sectionBlock("Guest List", [gl]));
  }
  if (selected.has("wifi")) {
    parts.push(sectionBlock("WiFi", [
      fieldHtml("Network", show.wifi_network),
      fieldHtml("Password", show.wifi_password),
    ]));
  }
  if (selected.has("settlement")) {
    parts.push(sectionBlock("Settlement", [
      fieldHtml("Method", show.settlement_method),
      fieldHtml("Guarantee", show.settlement_guarantee),
    ]));
  }
  if (selected.has("hotel")) {
    parts.push(sectionBlock("Accommodations", [
      fieldHtml("Name", show.hotel_name),
      fieldHtml("Address", show.hotel_address),
      fieldHtml("Confirmation #", show.hotel_confirmation),
      fieldHtml("Check In", show.hotel_checkin),
      fieldHtml("Check Out", show.hotel_checkout),
    ]));
  }
  if (selected.has("travel") && show.travel_notes?.trim()) {
    parts.push(sectionBlock("Travel", [esc(show.travel_notes.trim())]));
  }
  if (selected.has("additional") && show.additional_info?.trim()) {
    parts.push(sectionBlock("Additional Info", [esc(show.additional_info.trim())]));
  }

  return parts.filter(Boolean).join("<br><br>");
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
    const body = buildHtmlBody(show, selected, greeting);
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
