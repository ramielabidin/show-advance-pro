import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  SECTIONS,
  ALL_SECTION_KEYS,
  BAND_VIEW_KEYS,
  withData,
  isBandHidden,
  type SectionKey,
} from "@/lib/daysheetSections";
import DaySheetSectionPicker from "@/components/DaySheetSectionPicker";

function val(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || s.toLowerCase() === "tbd" || s.toLowerCase() === "n/a") return null;
  return s;
}

function formatGuestList(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((g: any) => {
          const name = g.name ?? g.Name ?? "Guest";
          const plus = g.plusOnes ?? g.plus_ones ?? g.guests ?? 0;
          return plus > 0 ? `${name} +${plus}` : String(name);
        })
        .filter(Boolean)
        .join(", ");
    }
  } catch {
    // not JSON
  }
  return raw;
}

interface Props {
  show: Show & { schedule_entries?: ScheduleEntry[] };
  trigger?: React.ReactNode;
}

export default function ExportPdfDialog({ show, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<SectionKey>>(new Set());
  const [bandMode, setBandMode] = useState(false);
  const [generating, setGenerating] = useState(false);

  const handleOpen = (v: boolean) => {
    setOpen(v);
    if (v) {
      setSelected(withData(ALL_SECTION_KEYS, show));
      setBandMode(false);
    }
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

      const has = (key: SectionKey) => selected.has(key);
      const hidden = (sec: SectionKey, field: string) => isBandHidden(sec, field, bandMode);

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

      // --- Sections ---

      if (has("contact") && (val(show.dos_contact_name) || val(show.dos_contact_phone))) {
        drawSectionTitle("Day of Show Contact");
        drawField("Name", val(show.dos_contact_name));
        drawField("Phone", val(show.dos_contact_phone), { mono: true });
      }

      if (has("venue") && val(show.venue_address)) {
        drawSectionTitle("Venue Address");
        drawField("Address", val(show.venue_address)?.replace(/,\s*United States$/i, "") ?? null);
      }

      if (has("schedule")) {
        const entries = (show.schedule_entries ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
        if (entries.length > 0) {
          drawSectionTitle("Schedule");
          for (const entry of entries) {
            checkPage(lineHeight);
            doc.setFont("courier", "normal");
            doc.setFontSize(9);
            doc.setTextColor(120, 120, 120);
            doc.text(entry.time, margin + 8, y);
            doc.setTextColor(30, 30, 30);
            doc.setFont("helvetica", entry.is_band ? "bold" : "normal");
            const setInline = entry.is_band && val(show.set_length) ? ` (${val(show.set_length)})` : "";
            doc.text(`${entry.label}${setInline}`, margin + 80, y);
            y += lineHeight;
          }
          if (val(show.curfew)) {
            checkPage(lineHeight);
            doc.setFont("courier", "normal");
            doc.setFontSize(9);
            doc.setTextColor(120, 120, 120);
            doc.text(val(show.curfew)!, margin + 8, y);
            doc.setTextColor(30, 30, 30);
            doc.setFont("helvetica", "normal");
            doc.text("Curfew", margin + 80, y);
            y += lineHeight;
          }
        }
      }

      if (has("departure") && (val(show.departure_time) || val(show.departure_location))) {
        drawSectionTitle("Departure");
        drawField("Time", val(show.departure_time), { mono: true });
        drawField("Notes", val(show.departure_location));
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

      if (has("venueDetails")) {
        const fields: [string, string | null][] = [
          ["Capacity", val(show.venue_capacity)],
          ...(!hidden("venueDetails", "ticket_price") ? [["Ticket Price", val(show.ticket_price)] as [string, string | null]] : []),
          ["Age Restriction", val(show.age_restriction)],
        ];
        if (fields.some(([, v]) => v)) {
          drawSectionTitle("Venue Details");
          for (const [label, v] of fields) drawField(label, v);
        }
      }

      if (has("band")) {
        const fields: [string, string | null][] = [
          ["Set Length", val(show.set_length)],
          ["Curfew", val(show.curfew)],
          ["Support Act", val(show.support_act)],
          ...(!hidden("band", "support_pay") ? [["Support Pay", val(show.support_pay)] as [string, string | null]] : []),
        ];
        if (fields.some(([, v]) => v)) {
          drawSectionTitle("Band & Performance");
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

      if (has("hospitality") && val(show.hospitality)) {
        drawSectionTitle("Hospitality");
        drawField("Details", val(show.hospitality));
      }

      if (has("guestList") && val(show.guest_list_details)) {
        drawSectionTitle("Guest List");
        const formatted = formatGuestList(val(show.guest_list_details)!);
        drawField("", formatted);
      }

      if (has("projections")) {
        const fields: [string, string | null][] = [
          ["Walkout Potential", val(show.walkout_potential)],
          ["Net/Gross", val(show.net_gross)],
        ];
        if (fields.some(([, v]) => v)) {
          drawSectionTitle("Projections");
          for (const [label, v] of fields) drawField(label, v, { mono: true });
        }
      }

      if (has("wifi") && (val(show.wifi_network) || val(show.wifi_password))) {
        drawSectionTitle("WiFi");
        drawField("Network", val(show.wifi_network), { mono: true });
        drawField("Password", val(show.wifi_password), { mono: true });
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

      if (has("additional")) {
        const lines: [string, string | null][] = [
          ["Details", val(show.additional_info)],
          ["Merch Split", val(show.merch_split)],
        ];
        if (lines.some(([, v]) => v)) {
          drawSectionTitle("Additional Info");
          for (const [label, v] of lines) drawField(label, v);
        }
      }

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
          <DaySheetSectionPicker
            show={show}
            selected={selected}
            onChange={setSelected}
            onBandModeChange={setBandMode}
            idPrefix="pdf"
          />
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
