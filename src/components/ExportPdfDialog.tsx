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
      // ── Document setup ──────────────────────────────────────────────────
      const doc = new jsPDF({ unit: "pt", format: "letter" });
      const PW = doc.internal.pageSize.getWidth();   // 612 pt
      const PH = doc.internal.pageSize.getHeight();  // 792 pt

      // Margins
      const ML = 52;  // left margin
      const MR = 52;  // right margin
      const MT = 44;  // top margin — enough to breathe, not wasteful
      const MB = 44;  // bottom margin

      const CW = PW - ML - MR; // content width = 500 pt

      // Fill canvas with warm off-white (instead of default white)
      const paintCanvas = () => {
        doc.setFillColor(...T.canvas);
        doc.rect(0, 0, PW, PH, "F");
      };
      paintCanvas();

      let y = MT;

      // ── Utility: page break ─────────────────────────────────────────────
      const checkPage = (needed: number) => {
        if (y + needed > PH - MB) {
          doc.addPage();
          paintCanvas();
          y = MT;
        }
      };

      // ── Utility: draw the left-accent section rule ──────────────────────
      // Mirrors the app's `border-l-2` + small-caps section label pattern.
      const drawSectionLabel = (title: string, extraGap = 0) => {
        checkPage(30);
        y += 16 + extraGap;

        // Accent bar — 2 pt wide, 11 pt tall, vertically centered on label
        doc.setFillColor(...T.accent);
        doc.rect(ML, y - 8, 2, 10, "F");

        // Small-caps label (simulated via uppercase + tracking via character spacing)
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(...T.muted);
        doc.setCharSpace(1.4); // wide tracking like the app's `tracking-widest`
        doc.text(title.toUpperCase(), ML + 10, y);
        doc.setCharSpace(0);   // reset

        y += 11;
      };

      // ── Utility: stacked field (label above, value below) ───────────────
      // This mirrors the app's FieldRow pattern: muted small label on top,
      // heavier value below — NOT the old side-by-side column layout.
      const drawStackedField = (
        label: string,
        value: string | null,
        opts?: { mono?: boolean; bold?: boolean }
      ) => {
        if (!value) return;
        const lines = doc.splitTextToSize(value, CW - 10);
        const blockH = 11 + lines.length * 13 + 7;
        checkPage(blockH);

        // Label
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...T.muted);
        if (label) doc.text(label, ML + 10, y);
        y += 11;

        // Value
        doc.setFontSize(9.5);
        doc.setTextColor(...T.ink);
        if (opts?.mono) {
          doc.setFont("courier", opts.bold ? "bold" : "normal");
        } else {
          doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
        }
        doc.text(lines, ML + 10, y);
        y += lines.length * 13 + 7;
      };

      // ── Utility: inline key-value pair (for compact single-line fields) ─
      const drawInlineField = (
        label: string,
        value: string | null,
        opts?: { mono?: boolean }
      ) => {
        if (!value) return;
        checkPage(15);
        const labelW = 88;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...T.muted);
        doc.text(label, ML + 10, y);

        doc.setFontSize(8.5);
        doc.setTextColor(...T.ink);
        if (opts?.mono) doc.setFont("courier", "normal");
        else doc.setFont("helvetica", "normal");

        const valLines = doc.splitTextToSize(value, CW - 10 - labelW);
        doc.text(valLines, ML + 10 + labelW, y);
        y += valLines.length * 13 + 1;
      };

      const has = (key: SectionKey) => hasData(show, key);

      // ════════════════════════════════════════════════════════════════════
      // HEADER BLOCK
      // Layout: "Advance" wordmark (serif, small) left — Tour name right
      //         Venue name large (serif display)
      //         Date · City  (muted, small caps feel)
      //         Thin hairline rule
      // ════════════════════════════════════════════════════════════════════

      // Wordmark row
      doc.setFont("times", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...T.ink);
      doc.text("Advance", ML, y);

      // Tour name — right-aligned, small pill style
      const tourName = (show as any).tours?.name;
      if (tourName) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setCharSpace(1.2);
        doc.setTextColor(...T.muted);
        const tourLabel = tourName.toUpperCase();
        const tourW = doc.getTextWidth(tourLabel);
        // Pill background
        const pillX = PW - MR - tourW - 10;
        const pillY = y - 8;
        const pillH = 12;
        doc.setFillColor(...T.accentLight);
        doc.roundedRect(pillX - 5, pillY, tourW + 14, pillH, 3, 3, "F");
        doc.setTextColor(...T.accent);
        doc.text(tourLabel, pillX, y);
        doc.setCharSpace(0);
      }

      y += 18;

      // Venue name — large serif display, tight tracking
      doc.setFont("times", "bold");
      doc.setFontSize(26);
      doc.setTextColor(...T.ink);
      // Wrap if venue name is very long
      const venueLines = doc.splitTextToSize(show.venue_name, CW);
      doc.text(venueLines, ML, y);
      y += venueLines.length * 28;

      // Date · City — muted metadata line
      const dateStr = format(parseISO(show.date), "EEEE, MMMM d, yyyy");
      const cityStr = formatCityState(show.city);
      const metaStr = cityStr ? `${cityStr}  ·  ${dateStr}` : dateStr;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...T.muted);
      doc.text(metaStr, ML, y);
      y += 13;

      // Hairline rule — full content width
      doc.setDrawColor(...T.border);
      doc.setLineWidth(0.75);
      doc.line(ML, y, ML + CW, y);
      y += 3;

      // ════════════════════════════════════════════════════════════════════
      // SECTIONS — band-relevant, in fixed order
      // ════════════════════════════════════════════════════════════════════

      // ── Contact ─────────────────────────────────────────────────────────
      if (has("contact")) {
        drawSectionLabel("Day of Show Contact");
        drawInlineField("Name", val(show.dos_contact_name));
        drawInlineField("Phone", val(show.dos_contact_phone), { mono: true });
      }

      // ── Venue Address ────────────────────────────────────────────────────
      if (has("venue") && val(show.venue_address)) {
        drawSectionLabel("Venue");
        drawInlineField(
          "Address",
          val(show.venue_address)?.replace(/,\s*United States$/i, "") ?? null
        );
      }

      // ── Schedule ─────────────────────────────────────────────────────────
      // Special treatment: time in Courier/muted left column, event name right.
      // Band's set time is bold. Curfew appended at end.
      if (has("schedule")) {
        const entries = (show.schedule_entries ?? [])
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order);

        if (entries.length > 0) {
          drawSectionLabel("Schedule");

          const timeColW = 60;
          const rowH = 15;

          for (const entry of entries) {
            checkPage(rowH + 4);

            const isBand = entry.is_band;

            // Time — Courier, muted
            doc.setFont("courier", "normal");
            doc.setFontSize(8.5);
            doc.setTextColor(...T.muted);
            doc.text(entry.time, ML + 10, y);

            // Event label — heavier if band
            doc.setFont("helvetica", isBand ? "bold" : "normal");
            doc.setFontSize(9);
            doc.setTextColor(...T.ink);

            doc.text(entry.label, ML + 10 + timeColW, y);
            y += rowH;
          }

          // Curfew row
          if (val(show.curfew)) {
            checkPage(rowH + 4);
            y += 1;
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

          // Set length + curfew as standalone fields below grid if not in schedule
          if (val(show.set_length) && !entries.some((e) => e.is_band)) {
            y += 4;
            drawInlineField("Set Length", val(show.set_length));
          }
        }
      }

      // ── Departure ────────────────────────────────────────────────────────
      if (has("departure")) {
        drawSectionLabel("Departure");
        drawInlineField("Time", val(show.departure_time), { mono: true });
        drawStackedField("Notes", val(show.departure_notes));
      }

      // ── Parking ──────────────────────────────────────────────────────────
      if (has("parking")) {
        drawSectionLabel("Parking");
        drawStackedField("Notes", val(show.parking_notes));
      }

      // ── Load In ──────────────────────────────────────────────────────────
      if (has("loadIn")) {
        drawSectionLabel("Load In");
        drawStackedField("Details", val(show.load_in_details));
      }

      // ── Green Room ───────────────────────────────────────────────────────
      if (has("greenRoom")) {
        drawSectionLabel("Green Room");
        drawStackedField("Info", val(show.green_room_info));
      }

      // ── Venue Details ────────────────────────────────────────────────────
      if (has("venueDetails")) {
        const cap = val(show.venue_capacity);
        const age = val(show.age_restriction);
        if (cap || age) {
          drawSectionLabel("Venue Details");
          drawInlineField("Capacity", cap);
          drawInlineField("Age Restriction", age);
        }
      }

      // ── Band & Performance ────────────────────────────────────────────────
      {
        const setLen = val(show.set_length);
        const curfew = val(show.curfew);
        // Only render if we have values AND schedule didn't already show them
        if ((setLen || curfew) && !has("schedule")) {
          drawSectionLabel("Band & Performance");
          drawInlineField("Set Length", setLen);
          drawInlineField("Curfew", curfew, { mono: true });
        }
      }

      // ── WiFi ─────────────────────────────────────────────────────────────
      if (has("wifi")) {
        drawSectionLabel("WiFi");
        drawInlineField("Network", val(show.wifi_network), { mono: true });
        drawInlineField("Password", val(show.wifi_password), { mono: true });
      }

      // ── Hotel / Accommodations ────────────────────────────────────────────
      if (has("hotel")) {
        drawSectionLabel("Accommodations");
        drawInlineField("Hotel", val(show.hotel_name));
        drawInlineField("Address", val(show.hotel_address)?.replace(/,?\s*United States$/i, "") ?? null);
        drawInlineField("Confirmation", val(show.hotel_confirmation), { mono: true });
        drawInlineField("Check-in", val(show.hotel_checkin), { mono: true });
        drawInlineField("Check-out", val(show.hotel_checkout), { mono: true });
      }

      // ── Guest List ────────────────────────────────────────────────────────
      if (has("guestList") && val(show.guest_list_details)) {
        drawSectionLabel("Guest List");
        const formatted = formatGuestList(val(show.guest_list_details)!);
        drawStackedField("", formatted);
      }

      // ════════════════════════════════════════════════════════════════════
      // FOOTER — "Generated with Advance · advancetouring.com"
      // Sits at the bottom of the LAST page only, muted, small.
      // This is the word-of-mouth seed per the roadmap.
      // ════════════════════════════════════════════════════════════════════
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);

        // Hairline above footer
        doc.setDrawColor(...T.border);
        doc.setLineWidth(0.5);
        doc.line(ML, PH - MB + 10, ML + CW, PH - MB + 10);

        // Left: page number (if multi-page)
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...T.muted);
        if (totalPages > 1) {
          doc.text(`${i} / ${totalPages}`, ML, PH - MB + 22);
        }

        // Right: Advance branding
        doc.setCharSpace(0.3);
        const brandStr = "advancetouring.com";
        const brandW = doc.getTextWidth(brandStr);
        doc.text(brandStr, PW - MR - brandW, PH - MB + 22);
        doc.setCharSpace(0);
      }

      // ── Save ──────────────────────────────────────────────────────────────
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
