import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import jsPDF from "jspdf";
import type { Show, ScheduleEntry } from "@/lib/types";
import { formatCityState } from "@/lib/utils";
import { hasData, type SectionKey } from "@/lib/daysheetSections";

// ─── Helpers ────────────────────────────────────────────────────────────────

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
    // not JSON — fall through
  }
  return raw;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface Props {
  show: Show & { schedule_entries?: ScheduleEntry[] };
  trigger?: React.ReactNode;
}

// ─── Design tokens (mirroring the app's light-mode palette) ─────────────────
//
// The PDF renders in light mode — paper is light. Colors map directly to the
// app's CSS variables when the theme is `light`:
//
//   --background:         #F5F3EF  (warm off-white canvas)
//   --foreground:         #1A1714  (near-black, never pure #000)
//   --muted-foreground:   #8B7E76  (warm gray for labels / meta)
//   --border:             #E2DAD4  (warm hairline)
//   --accent-green:       #3D7A5C  (Advanced badge green)
//
// Typography: Geist Sans isn't embeddable in jsPDF without a custom font
// registration workflow, so we use Helvetica (the closest system equivalent)
// for sans and Courier for mono — both built into jsPDF. The display serif
// headings use Times, but ONLY for the "Advance" wordmark and venue name,
// mirroring the app's `font-display` serif used on those elements.

const T = {
  // Colors as [R, G, B] tuples for jsPDF setTextColor / setDrawColor
  canvas:      [245, 243, 239] as [number, number, number], // warm off-white
  ink:         [26,  23,  20]  as [number, number, number], // near-black
  muted:       [139, 126, 118] as [number, number, number], // warm gray labels
  border:      [220, 213, 207] as [number, number, number], // warm hairline
  accent:      [61,  122, 92]  as [number, number, number], // green accent
  accentLight: [237, 243, 240] as [number, number, number], // green pill bg
} as const;

// ─── Main component ──────────────────────────────────────────────────────────

export default function ExportPdfDialog({ show, trigger }: Props) {
  const [generating, setGenerating] = useState(false);

  const generatePdf = () => {
    setGenerating(true);

    try {
      const doc = new jsPDF({ unit: "pt", format: "letter" });
      const PW = doc.internal.pageSize.getWidth();  // 612 pt
      const PH = doc.internal.pageSize.getHeight(); // 792 pt

      const ML = 52;
      const MR = 52;
      const MT = 48;
      const MB = 48;
      const CW = PW - ML - MR; // 508 pt

      const paintCanvas = () => {
        doc.setFillColor(...T.canvas);
        doc.rect(0, 0, PW, PH, "F");
      };
      paintCanvas();

      let y = MT;

      const checkPage = (needed: number) => {
        if (y + needed > PH - MB) {
          doc.addPage();
          paintCanvas();
          y = MT;
        }
      };

      // ── Section header: accent bar + small-caps label ───────────────────
      // Always call with a pre-gap so sections breathe relative to each other.
      const sectionHeader = (title: string, preGap = 18) => {
        checkPage(preGap + 24);
        y += preGap;
        doc.setFillColor(...T.accent);
        doc.rect(ML, y - 8, 2, 10, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(...T.muted);
        doc.setCharSpace(1.5);
        doc.text(title.toUpperCase(), ML + 10, y);
        doc.setCharSpace(0);
        y += 12;
      };

      // ── Simple section: label IS the heading, value flows directly below ─
      // Use for single-value sections (Parking, Load In, Green Room, etc.)
      // No redundant sub-label like "Notes" or "Details".
      const drawSimpleSection = (title: string, value: string | null, opts?: { mono?: boolean }) => {
        if (!value) return;
        const lines = doc.splitTextToSize(value, CW - 10);
        checkPage(18 + 24 + lines.length * 13 + 6);
        sectionHeader(title);
        doc.setFont(opts?.mono ? "courier" : "helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...T.ink);
        doc.text(lines, ML + 10, y);
        y += lines.length * 13 + 6;
      };

      // ── Inline field: label left (muted), value right ───────────────────
      // Use inside multi-field sections (Contact, Hotel, etc.)
      const drawField = (
        label: string,
        value: string | null,
        opts?: { mono?: boolean; labelW?: number }
      ) => {
        if (!value) return;
        const lw = opts?.labelW ?? 96;
        const valLines = doc.splitTextToSize(value, CW - 10 - lw);
        checkPage(valLines.length * 13 + 3);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...T.muted);
        doc.text(label, ML + 10, y);

        doc.setFont(opts?.mono ? "courier" : "helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...T.ink);
        doc.text(valLines, ML + 10 + lw, y);

        y += valLines.length * 13 + 3;
      };

      const has = (key: SectionKey) => hasData(show, key);

      // ════════════════════════════════════════════════════════════════════
      // HEADER
      // "Advance" wordmark left · Tour pill right
      // Venue name large
      // City · Date muted
      // Hairline
      // ════════════════════════════════════════════════════════════════════

      // Wordmark
      doc.setFont("times", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...T.ink);
      doc.text("Advance", ML, y);

      // Tour pill — measure BEFORE setting charSpace so width is accurate
      const tourName = (show as any).tours?.name;
      if (tourName) {
        const tourLabel = tourName.toUpperCase();
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        // Measure without charSpace first
        const tourW = doc.getTextWidth(tourLabel);
        const pillPad = 8;
        const pillW = tourW + pillPad * 2;
        const pillX = PW - MR - pillW;
        const pillY = y - 9;

        doc.setFillColor(...T.accentLight);
        doc.roundedRect(pillX, pillY, pillW, 12, 2, 2, "F");

        doc.setCharSpace(1.0);
        doc.setTextColor(...T.accent);
        doc.text(tourLabel, pillX + pillPad, y);
        doc.setCharSpace(0);
      }

      y += 20;

      // Venue name
      doc.setFont("times", "bold");
      doc.setFontSize(26);
      doc.setTextColor(...T.ink);
      const venueLines = doc.splitTextToSize(show.venue_name, CW);
      doc.text(venueLines, ML, y);
      y += venueLines.length * 28;

      // City · Date
      const dateStr = format(parseISO(show.date), "EEEE, MMMM d, yyyy");
      const cityStr = formatCityState(show.city);
      const metaStr = cityStr ? `${cityStr}  ·  ${dateStr}` : dateStr;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...T.muted);
      doc.text(metaStr, ML, y);
      y += 14;

      // Hairline
      doc.setDrawColor(...T.border);
      doc.setLineWidth(0.75);
      doc.line(ML, y, ML + CW, y);
      y += 2;

      // ════════════════════════════════════════════════════════════════════
      // SECTIONS
      // ════════════════════════════════════════════════════════════════════

      // ── Contact ──────────────────────────────────────────────────────────
      if (has("contact")) {
        sectionHeader("Day of Show Contact");
        drawField("Name", val(show.dos_contact_name));
        drawField("Phone", val(show.dos_contact_phone), { mono: true });
      }

      // ── Venue ─────────────────────────────────────────────────────────────
      if (has("venue") && val(show.venue_address)) {
        drawSimpleSection(
          "Venue",
          val(show.venue_address)?.replace(/,?\s*United States$/i, "") ?? null
        );
      }

      // ── Schedule ──────────────────────────────────────────────────────────
      // Time in mono/muted left, event label right. No bold — is_band data
      // is unreliable; uniform weight looks cleaner anyway.
      if (has("schedule")) {
        const entries = (show.schedule_entries ?? [])
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order);

        if (entries.length > 0) {
          sectionHeader("Schedule");

          const timeColW = 58;
          const rowH = 14;

          for (const entry of entries) {
            checkPage(rowH + 2);
            doc.setFont("courier", "normal");
            doc.setFontSize(8.5);
            doc.setTextColor(...T.muted);
            doc.text(entry.time, ML + 10, y);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(...T.ink);
            doc.text(entry.label, ML + 10 + timeColW, y);
            y += rowH;
          }

          // Curfew — rendered muted since it's a constraint, not an event
          if (val(show.curfew)) {
            checkPage(rowH + 2);
            doc.setFont("courier", "normal");
            doc.setFontSize(8.5);
            doc.setTextColor(...T.muted);
            doc.text(val(show.curfew)!, ML + 10, y);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(...T.muted);
            doc.text("Curfew", ML + 10 + timeColW, y);
            y += rowH;
          }

          y += 4;
        }
      }

      // ── Set Length ────────────────────────────────────────────────────────
      // Always show as its own simple section when present.
      if (val(show.set_length)) {
        drawSimpleSection("Set Length", val(show.set_length));
      }

      // ── Departure ─────────────────────────────────────────────────────────
      // Two fields so it gets a proper header + inline fields.
      if (has("departure")) {
        const dTime = val(show.departure_time);
        const dNotes = val(show.departure_notes);
        if (dTime || dNotes) {
          sectionHeader("Departure");
          drawField("Time", dTime, { mono: true });
          // Notes can be long — give it full width, no label
          if (dNotes) {
            const noteLines = doc.splitTextToSize(dNotes, CW - 10);
            checkPage(noteLines.length * 13 + 3);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(...T.ink);
            doc.text(noteLines, ML + 10, y);
            y += noteLines.length * 13 + 3;
          }
        }
      }

      // ── Parking ───────────────────────────────────────────────────────────
      drawSimpleSection("Parking", val(show.parking_notes));

      // ── Load In ───────────────────────────────────────────────────────────
      drawSimpleSection("Load In", val(show.load_in_details));

      // ── Green Room ────────────────────────────────────────────────────────
      drawSimpleSection("Green Room", val(show.green_room_info));

      // ── Venue Details ─────────────────────────────────────────────────────
      {
        const cap = val(show.venue_capacity);
        const age = val(show.age_restriction);
        if (cap || age) {
          sectionHeader("Venue Details");
          drawField("Capacity", cap);
          drawField("Age Restriction", age);
        }
      }

      // ── WiFi ──────────────────────────────────────────────────────────────
      {
        const net = val(show.wifi_network);
        const pw = val(show.wifi_password);
        if (net || pw) {
          sectionHeader("WiFi");
          drawField("Network", net, { mono: true });
          drawField("Password", pw, { mono: true });
        }
      }

      // ── Accommodations ────────────────────────────────────────────────────
      // Keep all hotel fields together — checkPage before the block.
      if (has("hotel")) {
        const hotelFields = [
          val(show.hotel_name),
          val(show.hotel_address),
          val(show.hotel_confirmation),
          val(show.hotel_checkin),
          val(show.hotel_checkout),
        ].filter(Boolean);

        if (hotelFields.length > 0) {
          // Estimate block height so it doesn't split across pages
          const blockH = 24 + hotelFields.length * 16 + 10;
          checkPage(blockH);
          sectionHeader("Accommodations");
          drawField("Hotel", val(show.hotel_name));
          drawField(
            "Address",
            val(show.hotel_address)?.replace(/,?\s*United States$/i, "") ?? null
          );
          drawField("Confirmation", val(show.hotel_confirmation), { mono: true });
          drawField("Check-in", val(show.hotel_checkin), { mono: true });
          drawField("Check-out", val(show.hotel_checkout), { mono: true });
        }
      }

      // ── Guest List ────────────────────────────────────────────────────────
      if (has("guestList") && val(show.guest_list_details)) {
        const formatted = formatGuestList(val(show.guest_list_details)!);
        drawSimpleSection("Guest List", formatted);
      }

      // ════════════════════════════════════════════════════════════════════
      // FOOTER — hairline + page number left, advancetouring.com right
      // ════════════════════════════════════════════════════════════════════
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setDrawColor(...T.border);
        doc.setLineWidth(0.5);
        doc.line(ML, PH - MB + 8, ML + CW, PH - MB + 8);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...T.muted);

        if (totalPages > 1) {
          doc.text(`${i} / ${totalPages}`, ML, PH - MB + 20);
        }

        const brandStr = "advancetouring.com";
        // Measure without charSpace
        doc.setCharSpace(0);
        const brandW = doc.getTextWidth(brandStr);
        doc.text(brandStr, PW - MR - brandW, PH - MB + 20);
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

  // ── Render ─────────────────────────────────────────────────────────────────

  if (trigger) {
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
      {generating ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      PDF
    </Button>
  );
}
