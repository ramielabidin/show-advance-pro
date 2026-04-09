import { useState } from "react";
import { Download, Loader2, Users, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { format, parseISO } from "date-fns";
import jsPDF from "jspdf";
import type { Show, ScheduleEntry } from "@/lib/types";
import { formatCityState } from "@/lib/utils";

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
  { key: "hotel", label: "Accommodations" },
  { key: "travel", label: "Travel" },
  { key: "additional", label: "Additional Info" },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

const BAND_VIEW_KEYS: SectionKey[] = [
  "contact", "departure", "schedule", "venue", "loadIn",
  "parking", "greenRoom", "wifi", "hotel", "travel", "guestList",
];

const allKeys = (): Set<SectionKey> => new Set(SECTIONS.map((s) => s.key));

function val(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || s.toLowerCase() === "tbd") return null;
  return s;
}

interface Props {
  show: Show & { schedule_entries?: ScheduleEntry[] };
  trigger?: React.ReactNode;
}

export default function ExportPdfDialog({ show, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<SectionKey>>(allKeys);
  const [generating, setGenerating] = useState(false);

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

  const handleOpen = (v: boolean) => {
    setOpen(v);
    if (v) setSelected(allKeys());
  };

  const generatePdf = () => {
    setGenerating(true);
    try {
      const doc = new jsPDF({ unit: "pt", format: "letter" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 50;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;
      const lineHeight = 16;
      const sectionGap = 20;

      const has = (key: string) => selected.has(key as SectionKey);

      const checkPage = (needed: number) => {
        const pageHeight = doc.internal.pageSize.getHeight();
        if (y + needed > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
      };

      const drawSectionTitle = (title: string) => {
        checkPage(lineHeight * 2 + sectionGap);
        y += sectionGap;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(title, margin, y);
        y += 4;
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, y, margin + contentWidth, y);
        y += lineHeight;
      };

      const drawField = (label: string, value: string | null, opts?: { mono?: boolean }) => {
        if (!value) return;
        checkPage(lineHeight);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(120, 120, 120);
        doc.text(label, margin + 8, y);
        doc.setTextColor(30, 30, 30);
        if (opts?.mono) doc.setFont("courier", "normal");

        // Wrap long values
        const labelWidth = 110;
        const valX = margin + 8 + labelWidth;
        const maxValWidth = contentWidth - 8 - labelWidth;
        const lines = doc.splitTextToSize(value, maxValWidth);
        doc.text(lines, valX, y);
        y += lineHeight * lines.length;
      };

      // Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("DAY SHEET", margin, y);
      y += 24;

      doc.setFontSize(14);
      doc.text(show.venue_name, margin, y);
      y += 18;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      const dateStr = format(parseISO(show.date), "EEEE, MMMM d, yyyy");
      doc.text(`${formatCityState(show.city)}  ·  ${dateStr}`, margin, y);
      doc.setTextColor(30, 30, 30);
      y += lineHeight + 8;
      doc.setDrawColor(60, 60, 60);
      doc.setLineWidth(1);
      doc.line(margin, y, margin + contentWidth, y);
      y += 4;

      // Sections
      if (has("contact") && (val(show.dos_contact_name) || val(show.dos_contact_phone))) {
        drawSectionTitle("Day of Show Contact");
        drawField("Name", val(show.dos_contact_name));
        drawField("Phone", val(show.dos_contact_phone), { mono: true });
      }

      if (has("venue") && val(show.venue_address)) {
        drawSectionTitle("Venue Address");
        drawField("Address", val(show.venue_address));
      }

      if (has("departure") && (val(show.departure_time) || val(show.departure_location))) {
        drawSectionTitle("Departure");
        drawField("Time", val(show.departure_time), { mono: true });
        drawField("Location", val(show.departure_location));
      }

      if (has("schedule")) {
        const entries = (show.schedule_entries ?? [])
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order);
        if (entries.length > 0) {
          drawSectionTitle("Schedule");
          for (const entry of entries) {
            checkPage(lineHeight);
            doc.setFont("courier", "normal");
            doc.setFontSize(9);
            doc.setTextColor(120, 120, 120);
            doc.text(entry.time, margin + 8, y);
            doc.setTextColor(30, 30, 30);
            const isBand = entry.is_band || entry.label.toUpperCase().includes("JUICE");
            doc.setFont("helvetica", isBand ? "bold" : "normal");
            doc.text(entry.label, margin + 80, y);
            y += lineHeight;
          }
        }
      }

      if (has("band")) {
        const fields: [string, string | null][] = [
          ["Set Length", val(show.set_length)],
          ["Curfew", val(show.curfew)],
          ["Changeover", val(show.changeover_time)],
          ["Backline", val(show.backline_provided)],
          ["Catering", val(show.catering_details)],
        ];
        if (fields.some(([, v]) => v)) {
          drawSectionTitle("Band / Performance");
          for (const [label, v] of fields) drawField(label, v);
        }
      }

      if (has("venueDetails")) {
        const fields: [string, string | null][] = [
          ["Capacity", val(show.venue_capacity)],
          ["Ticket Price", val(show.ticket_price)],
          ["Age Restriction", val(show.age_restriction)],
        ];
        if (fields.some(([, v]) => v)) {
          drawSectionTitle("Venue Details");
          for (const [label, v] of fields) drawField(label, v);
        }
      }

      if (has("dealTerms")) {
        const fields: [string, string | null][] = [
          ["Guarantee", val(show.guarantee)],
          ["Backend", val(show.backend_deal)],
        ];
        if (fields.some(([, v]) => v)) {
          drawSectionTitle("Deal Terms");
          for (const [label, v] of fields) drawField(label, v, { mono: true });
        }
      }

      if (has("production")) {
        const fields: [string, string | null][] = [
          ["Hospitality", val(show.hospitality)],
          ["Support Act", val(show.support_act)],
          ["Support Pay", val(show.support_pay)],
          ["Merch Split", val(show.merch_split)],
        ];
        if (fields.some(([, v]) => v)) {
          drawSectionTitle("Production & Logistics");
          for (const [label, v] of fields) drawField(label, v);
        }
      }

      if (has("projections")) {
        const fields: [string, string | null][] = [
          ["Walkout Potential", val(show.walkout_potential)],
          ["Net/Gross", val(show.net_gross)],
          ["Artist Comps", val(show.artist_comps)],
        ];
        if (fields.some(([, v]) => v)) {
          drawSectionTitle("Projections & Comps");
          for (const [label, v] of fields) drawField(label, v, { mono: true });
        }
      }

      if (has("parking") && val(show.parking_notes)) {
        drawSectionTitle("Parking");
        drawField("Notes", val(show.parking_notes));
      }

      if (has("loadIn") && val(show.load_in_details)) {
        drawSectionTitle("Load In");
        drawField("Details", val(show.load_in_details));
      }

      if (has("greenRoom") && val(show.green_room_info)) {
        drawSectionTitle("Green Room");
        drawField("Info", val(show.green_room_info));
      }

      if (has("guestList") && val(show.guest_list_details)) {
        drawSectionTitle("Guest List");
        drawField("Details", val(show.guest_list_details));
      }

      if (has("wifi") && (val(show.wifi_network) || val(show.wifi_password))) {
        drawSectionTitle("WiFi");
        drawField("Network", val(show.wifi_network), { mono: true });
        drawField("Password", val(show.wifi_password), { mono: true });
      }

      if (has("settlement") && (val(show.settlement_method) || val(show.settlement_guarantee))) {
        drawSectionTitle("Settlement");
        drawField("Method", val(show.settlement_method));
        drawField("Guarantee", val(show.settlement_guarantee), { mono: true });
      }

      if (has("hotel") && (val(show.hotel_name) || val(show.hotel_address))) {
        drawSectionTitle("Accommodations");
        drawField("Name", val(show.hotel_name));
        drawField("Address", val(show.hotel_address));
        drawField("Confirmation", val(show.hotel_confirmation), { mono: true });
        drawField("Check-in", val(show.hotel_checkin), { mono: true });
        drawField("Check-out", val(show.hotel_checkout), { mono: true });
      }

      if (has("travel") && val(show.travel_notes)) {
        drawSectionTitle("Travel");
        drawField("Notes", val(show.travel_notes));
      }

      if (has("additional") && val(show.additional_info)) {
        drawSectionTitle("Additional Info");
        drawField("Details", val(show.additional_info));
      }

      // Generate filename
      const venueSafe = show.venue_name.replace(/[^a-zA-Z0-9]/g, "");
      const filename = `${show.date}-${venueSafe}-DaySheet.pdf`;
      doc.save(filename);
      toast.success("PDF downloaded");
      setOpen(false);
    } catch (err: any) {
      console.error("PDF error:", err);
      toast.error("Failed to generate PDF");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="h-4 w-4" /> PDF
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Day Sheet PDF</DialogTitle>
          <DialogDescription>Choose which sections to include in the PDF.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-4">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setSelected(new Set(BAND_VIEW_KEYS))}>
              <Users className="h-3.5 w-3.5" /> Band View
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setSelected(allKeys())}>
              <Building2 className="h-3.5 w-3.5" /> Internal View
            </Button>
          </div>
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <Checkbox
              id="pdf-select-all"
              checked={selected.size === SECTIONS.length}
              onCheckedChange={toggleAll}
            />
            <Label htmlFor="pdf-select-all" className="text-sm font-medium cursor-pointer">
              Select All
            </Label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {SECTIONS.map((s) => (
              <div key={s.key} className="flex items-center gap-2">
                <Checkbox
                  id={`pdf-section-${s.key}`}
                  checked={selected.has(s.key)}
                  onCheckedChange={() => toggle(s.key)}
                />
                <Label htmlFor={`pdf-section-${s.key}`} className="text-sm cursor-pointer">
                  {s.label}
                </Label>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={generatePdf} disabled={generating || selected.size === 0} className="gap-1.5">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
