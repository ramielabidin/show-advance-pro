import { useState } from "react";
import { Mail, Users, Building2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/components/TeamProvider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import type { Show } from "@/lib/types";

const SECTIONS = [
  { key: "contact", label: "Day of Show Contact" },
  { key: "venue", label: "Venue Address" },
  { key: "departure", label: "Departure" },
  { key: "schedule", label: "Schedule" },
  { key: "band", label: "Band / Performance" },
  { key: "venueDetails", label: "Venue Details" },
  { key: "dealTerms", label: "Deal Terms" },
  { key: "production", label: "Production" },
  { key: "projections", label: "Projections" },
  { key: "parking", label: "Parking" },
  { key: "loadIn", label: "Load In" },
  { key: "greenRoom", label: "Green Room" },
  { key: "guestList", label: "Guest List" },
  { key: "wifi", label: "WiFi" },
  { key: "settlement", label: "Settlement" },
  { key: "hotel", label: "Hotel" },
  { key: "travel", label: "Travel" },
  { key: "additional", label: "Additional Info" },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

const BAND_VIEW_KEYS: SectionKey[] = [
  "contact", "departure", "schedule", "venue", "loadIn",
  "parking", "greenRoom", "wifi", "hotel", "travel", "guestList",
];

const allKeys = (): Set<SectionKey> => new Set(SECTIONS.map((s) => s.key));

function field(label: string, value: string | null | undefined): string {
  if (!value?.trim()) return "";
  return `${label}: ${value.trim()}`;
}

function section(title: string, lines: string[]): string {
  const filled = lines.filter(Boolean);
  if (filled.length === 0) return "";
  return `--- ${title} ---\n${filled.join("\n")}`;
}

function buildBody(show: Show & { schedule_entries?: any[] }, selected: Set<SectionKey>, note: string): string {
  const parts: string[] = [];

  if (note.trim()) {
    parts.push(note.trim());
    parts.push("");
  }

  if (selected.has("venue")) {
    parts.push(section("Venue", [
      field("Address", show.venue_address),
      field("City", formatCityState(show.city)),
    ]));
  }

  if (selected.has("contact")) {
    parts.push(section("Day of Show Contact", [
      field("Name", show.dos_contact_name),
      field("Phone", show.dos_contact_phone),
    ]));
  }

  if (selected.has("departure")) {
    parts.push(section("Departure", [
      field("Time", show.departure_time),
      field("Location", show.departure_location),
    ]));
  }

  if (selected.has("schedule") && show.schedule_entries?.length) {
    const sorted = [...show.schedule_entries].sort((a, b) => a.sort_order - b.sort_order);
    const lines = sorted.map((e) => `${e.time}  ${e.label}`);
    parts.push(section("Schedule", lines));
  }

  if (selected.has("band")) {
    parts.push(section("Band / Performance", [
      field("Set Length", show.set_length),
      field("Curfew", show.curfew),
      field("Changeover", show.changeover_time),
      field("Backline", show.backline_provided),
      field("Catering", show.catering_details),
    ]));
  }

  if (selected.has("venueDetails")) {
    parts.push(section("Venue Details", [
      field("Capacity", show.venue_capacity),
      field("Ticket Price", show.ticket_price),
      field("Age Restriction", show.age_restriction),
    ]));
  }

  if (selected.has("dealTerms")) {
    parts.push(section("Deal Terms", [
      field("Guarantee", show.guarantee),
      field("Backend Deal", show.backend_deal),
    ]));
  }

  if (selected.has("production")) {
    parts.push(section("Production", [
      field("Hospitality", show.hospitality),
      field("Support Act", show.support_act),
      field("Support Pay", show.support_pay),
      field("Merch Split", show.merch_split),
    ]));
  }

  if (selected.has("projections")) {
    parts.push(section("Projections", [
      field("Walkout Potential", show.walkout_potential),
      field("Net Gross", show.net_gross),
      field("Artist Comps", show.artist_comps),
    ]));
  }

  if (selected.has("parking")) {
    parts.push(section("Parking", [show.parking_notes?.trim() || ""].filter(Boolean)));
  }

  if (selected.has("loadIn")) {
    parts.push(section("Load In", [show.load_in_details?.trim() || ""].filter(Boolean)));
  }

  if (selected.has("greenRoom")) {
    parts.push(section("Green Room", [show.green_room_info?.trim() || ""].filter(Boolean)));
  }

  if (selected.has("guestList")) {
    parts.push(section("Guest List", [show.guest_list_details?.trim() || ""].filter(Boolean)));
  }

  if (selected.has("wifi")) {
    parts.push(section("WiFi", [
      field("Network", show.wifi_network),
      field("Password", show.wifi_password),
    ]));
  }

  if (selected.has("settlement")) {
    parts.push(section("Settlement", [
      field("Method", show.settlement_method),
      field("Guarantee", show.settlement_guarantee),
    ]));
  }

  if (selected.has("hotel")) {
    parts.push(section("Hotel", [
      field("Name", show.hotel_name),
      field("Address", show.hotel_address),
      field("Confirmation #", show.hotel_confirmation),
      field("Check In", show.hotel_checkin),
      field("Check Out", show.hotel_checkout),
    ]));
  }

  if (selected.has("travel")) {
    parts.push(section("Travel", [show.travel_notes?.trim() || ""].filter(Boolean)));
  }

  if (selected.has("additional")) {
    parts.push(section("Additional Info", [show.additional_info?.trim() || ""].filter(Boolean)));
  }

  return parts.filter(Boolean).join("\n\n");
}

export default function EmailBandDialog({ show, trigger }: { show: Show & { schedule_entries?: any[] }; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<SectionKey>>(allKeys);
  const [note, setNote] = useState("");
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

  const toggle = (key: SectionKey) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(selected.size === SECTIONS.length ? new Set() : allKeys());
  };

  const applyBandView = () => setSelected(new Set(BAND_VIEW_KEYS));
  const applyInternalView = () => setSelected(allKeys());

  const handleSend = () => {
    const emails = members.map((m) => m.email).filter(Boolean);
    if (emails.length === 0) {
      toast.error("No touring party members with email addresses");
      return;
    }

    const dateStr = format(parseISO(show.date), "yyyy-MM-dd");
    const subject = `${dateStr} - ${show.venue_name} (${formatCityState(show.city)}) - Day Sheet`;
    const body = buildBody(show, selected, note);

    const mailto = `mailto:${emails.join(",")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailto, "_blank");
    setOpen(false);
  };

  const handleOpen = (v: boolean) => {
    setOpen(v);
    if (v) {
      setSelected(allKeys());
      setNote("");
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
          {/* Personal note */}
          <div className="space-y-1.5 pb-2 border-b border-border">
            <Label htmlFor="email-note" className="text-sm text-muted-foreground">
              Personal note (optional)
            </Label>
            <Textarea
              id="email-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note to the top of the email..."
              className="text-sm min-h-[60px]"
            />
          </div>

          {/* Preset buttons */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={applyBandView}>
              <Users className="h-3.5 w-3.5" /> Band View
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={applyInternalView}>
              <Building2 className="h-3.5 w-3.5" /> Internal View
            </Button>
          </div>

          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <Checkbox
              id="email-select-all"
              checked={selected.size === SECTIONS.length}
              onCheckedChange={toggleAll}
            />
            <Label htmlFor="email-select-all" className="text-sm font-medium cursor-pointer">
              Select All
            </Label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {SECTIONS.map((s) => (
              <div key={s.key} className="flex items-center gap-2">
                <Checkbox
                  id={`email-section-${s.key}`}
                  checked={selected.has(s.key)}
                  onCheckedChange={() => toggle(s.key)}
                />
                <Label htmlFor={`email-section-${s.key}`} className="text-sm cursor-pointer">
                  {s.label}
                </Label>
              </div>
            ))}
          </div>
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