import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import jsPDF from "jspdf";
import type { Show, ScheduleEntry } from "@/lib/types";
import { formatCityState } from "@/lib/utils";
import { hasData, type SectionKey } from "@/lib/daysheetSections";

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
  const [generating, setGenerating] = useState(false);

  const generatePdf = () => {
    setGenerating(true);
    try {
      const doc = new jsPDF({ unit: "pt", format: "letter" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 56;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;
      const lineHeight = 17;
      const sectionGap = 22;
      const labelWidth = 108;

      // Warm color palette matching the UI
      const C_DARK: [number, number, number] = [30, 24, 20];
      const C_MUTED: [number, number, number] = [138, 126, 120];
      const C_BORDER: [number, number, number] = [222, 216, 210];

      const has = (key: SectionKey) => hasData(show, key);

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
        doc.setFontSize(8);
        doc.setTextColor(...C_MUTED);
        doc.text(title.toUpperCase(), margin, y);
        y += 5;
        doc.setDrawColor(...C_BORDER);
        doc.setLineWidth(0.5);
        doc.line(margin, y, margin + contentWidth, y);
        y += lineHeight - 4;
      };

      const drawField = (label: string, value: string | null, opts?: { mono?: boolean }) => {
        if (!value) return;
        checkPage(lineHeight);
        doc.setFontSize(9.5);
        doc.setTextColor(...C_MUTED);
        doc.setFont("helvetica", "normal");
        if (label) doc.text(label, margin + 6, y);
        doc.setTextColor(...C_DARK);
        if (opts?.mono) doc.setFont("courier", "normal");
        else doc.setFont("helvetica", "normal");
        const valX = margin + 6 + labelWidth;
        const maxValWidth = contentWidth - 6 - labelWidth;
        const lines = doc.splitTextToSize(value, maxValWidth);
        doc.text(lines, valX, y);
        y += lineHeight * lines.length;
      };

      // ── Header ──────────────────────────────────────────────────────────
      doc.setFont("times", "bold");
      doc.setFontSize(22);
      doc.setTextColor(...C_DARK);
      doc.text("DAY SHEET", margin, y);
      y += 27;

      doc.setFont("times", "normal");
      doc.setFontSize(15);
      doc.setTextColor(...C_DARK);
      doc.text(show.venue_name, margin, y);
      y += 20;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...C_MUTED);
      const dateStr = format(parseISO(show.date), "EEEE, MMMM d, yyyy");
      const cityStr = formatCityState(show.city);
      doc.text(cityStr ? `${cityStr}  ·  ${dateStr}` : dateStr, margin, y);
      doc.setTextColor(...C_DARK);
      y += 14;

      doc.setDrawColor(...C_BORDER);
      doc.setLineWidth(1);
      doc.line(margin, y, margin + contentWidth, y);
      y += 6;

      // ── Sections (band-relevant only, in fixed order) ───────────────────

      if (has("contact")) {
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
            doc.setFontSize(9.5);
            doc.setFont("courier", "normal");
            doc.setTextColor(...C_MUTED);
            doc.text(entry.time, margin + 6, y);
            doc.setTextColor(...C_DARK);
            doc.setFont("helvetica", entry.is_band ? "bold" : "normal");
            const labelWithSet = entry.is_band && val(show.set_length) ? `${entry.label} (${val(show.set_length)})` : entry.label;
            doc.text(labelWithSet, margin + 84, y);
            y += lineHeight;
          }
          if (val(show.curfew)) {
            checkPage(lineHeight);
            doc.setFontSize(9.5);
            doc.setFont("courier", "normal");
            doc.setTextColor(...C_MUTED);
            doc.text(val(show.curfew)!, margin + 6, y);
            doc.setTextColor(...C_DARK);
            doc.setFont("helvetica", "normal");
            doc.text("Curfew", margin + 84, y);
            y += lineHeight;
          }
        }
      }

      if (has("departure")) {
        drawSectionTitle("Departure");
        drawField("Time", val(show.departure_time), { mono: true });
        drawField("Notes", val(show.departure_location));
      }

      if (has("parking")) {
        drawSectionTitle("Parking");
        drawField("Notes", val(show.parking_notes));
      }

      if (has("loadIn")) {
        drawSectionTitle("Load In");
        drawField("Details", val(show.load_in_details));
      }

      if (has("greenRoom")) {
        drawSectionTitle("Green Room");
        drawField("Info", val(show.green_room_info));
      }

      if (has("venueDetails")) {
        const fields: [string, string | null][] = [
          ["Capacity", val(show.venue_capacity)],
          ["Age Restriction", val(show.age_restriction)],
        ];
        if (fields.some(([, v]) => v)) {
          drawSectionTitle("Venue Details");
          for (const [label, v] of fields) drawField(label, v);
        }
      }

      if (has("guestList") && val(show.guest_list_details)) {
        drawSectionTitle("Guest List");
        const formatted = formatGuestList(val(show.guest_list_details)!);
        drawField("", formatted);
      }

      if (has("wifi")) {
        drawSectionTitle("WiFi");
        drawField("Network", val(show.wifi_network), { mono: true });
        drawField("Password", val(show.wifi_password), { mono: true });
      }

      if (has("hotel")) {
        drawSectionTitle("Accommodations");
        drawField("Name", val(show.hotel_name));
        drawField("Address", val(show.hotel_address));
        drawField("Confirmation", val(show.hotel_confirmation), { mono: true });
        drawField("Check-in", val(show.hotel_checkin), { mono: true });
        drawField("Check-out", val(show.hotel_checkout), { mono: true });
      }

      const venueSafe = show.venue_name.replace(/[^a-zA-Z0-9]/g, "");
      const filename = `${show.date}-${venueSafe}-DaySheet.pdf`;
      doc.save(filename);
      toast.success("PDF downloaded");
    } catch (err: any) {
      console.error("PDF error:", err);
      toast.error("Failed to generate PDF");
    } finally {
      setGenerating(false);
    }
  };

  if (trigger) {
    // Caller provided a custom trigger (e.g. a DropdownMenuItem) — wire click through.
    return (
      <span
        onClick={(e) => {
          e.preventDefault();
          if (!generating) generatePdf();
        }}
      >
        {trigger}
      </span>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5"
      onClick={generatePdf}
      disabled={generating}
    >
      {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      PDF
    </Button>
  );
}
