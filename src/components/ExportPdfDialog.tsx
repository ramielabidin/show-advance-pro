import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import jsPDF from "jspdf";
import type { Show, ScheduleEntry } from "@/lib/types";
import { formatCityState } from "@/lib/utils";

// ─── Helpers ────────────────────────────────────────────────────────────────

function val(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || s.toLowerCase() === "tbd" || s.toLowerCase() === "n/a") return null;
  return s;
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface Props {
  show: Show & { schedule_entries?: ScheduleEntry[] };
  trigger?: React.ReactNode;
}

// ─── Design tokens ──────────────────────────────────────────────────────────
//
// This PDF is a run-of-show poster meant to be printed and taped to a wall.
// Everything not essential to glancing at from across the green room is
// intentionally omitted — load in, parking, hotel, guest list, etc. live in
// the email and Slack day sheet where people have time to read them.
//
// Colors mirror the app's light-mode palette:
//   –background:       #F5F3EF
//   –foreground:       #1A1714
//   –muted-foreground: #8B7E76
//   –border:           #E2DAD4
//   –accent-green:     #3D7A5C

const T = {
  canvas:      [245, 243, 239] as [number, number, number],
  ink:         [26,  23,  20]  as [number, number, number],
  muted:       [139, 126, 118] as [number, number, number],
  border:      [220, 213, 207] as [number, number, number],
  accent:      [61,  122, 92]  as [number, number, number],
  accentLight: [237, 243, 240] as [number, number, number],
} as const;

// ─── Main component ─────────────────────────────────────────────────────────

export default function ExportPdfDialog({ show, trigger }: Props) {
  const [generating, setGenerating] = useState(false);

  const generatePdf = () => {
    setGenerating(true);

    try {
      const doc = new jsPDF({ unit: "pt", format: "letter" });
      const PW = doc.internal.pageSize.getWidth();  // 612
      const PH = doc.internal.pageSize.getHeight(); // 792

      const ML = 56;
      const MR = 56;
      const MT = 56;
      const MB = 56;
      const CW = PW - ML - MR;

      // Paint warm canvas
      doc.setFillColor(...T.canvas);
      doc.rect(0, 0, PW, PH, "F");

      // ════════════════════════════════════════════════════════════════════
      // HEADER — wordmark + tour pill
      // ════════════════════════════════════════════════════════════════════
      let y = MT;

      doc.setFont("times", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...T.ink);
      doc.text("Advance", ML, y);

      const tourName = (show as any).tours?.name;
      if (tourName) {
        const tourLabel = tourName.toUpperCase();
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        const tourW = doc.getTextWidth(tourLabel);
        const pillPad = 9;
        const pillW = tourW + pillPad * 2 + 6; // room for charSpace
        const pillX = PW - MR - pillW;
        const pillY = y - 9;

        doc.setFillColor(...T.accentLight);
        doc.roundedRect(pillX, pillY, pillW, 13, 6.5, 6.5, "F");

        doc.setCharSpace(1.2);
        doc.setTextColor(...T.accent);
        doc.text(tourLabel, pillX + pillPad, y);
        doc.setCharSpace(0);
      }

      y += 40;

      // ════════════════════════════════════════════════════════════════════
      // VENUE + DATE
      // ════════════════════════════════════════════════════════════════════
      doc.setFont("times", "bold");
      doc.setFontSize(38);
      doc.setTextColor(...T.ink);
      const venueLines = doc.splitTextToSize(show.venue_name, CW);
      doc.text(venueLines, ML, y);
      y += venueLines.length * 40;

      const dateStr = format(parseISO(show.date), "EEEE, MMMM d, yyyy");
      const cityStr = formatCityState(show.city);
      const metaStr = cityStr ? `${cityStr}  ·  ${dateStr}` : dateStr;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...T.muted);
      doc.text(metaStr, ML, y);
      y += 48;

      // ════════════════════════════════════════════════════════════════════
      // SCHEDULE — the hero of this page
      //
      // Layout plan:
      //   - Reserve bottom strip (contact + wifi + footer) so schedule has
      //     a bounded area to fit in.
      //   - Start at a large font (22pt) and auto-shrink by 0.5pt steps
      //     until the schedule fits the available height, with an absolute
      //     floor of 13pt. This guarantees one page without ever going
      //     so small the wall poster becomes useless.
      //   - Times left (muted, tabular), events right (ink).
      //   - The band's set row (entry.is_band === true) gets accent green.
      //     Set length shown inline as muted suffix ("Juice · 75 min").
      //   - Curfew gets a separate muted row below the last entry.
      // ════════════════════════════════════════════════════════════════════

      const entries = (show.schedule_entries ?? [])
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order);

      // Calculate bottom strip height so we know how much room the
      // schedule has. Bottom strip = hairline + padding + label + 2 lines,
      // ~64pt tall. Footer brand = 16pt.
      const BOTTOM_STRIP_H = 64;
      const FOOTER_H = 16;
      const availableH = PH - MB - FOOTER_H - BOTTOM_STRIP_H - y;

      const curfewVal = val(show.curfew);
      const setLenVal = val(show.set_length);

      // Band's set row is whichever entry is flagged is_band.
      const bandIdx = entries.findIndex((e) => e.is_band);

      // Total row count (schedule entries + optional curfew row)
      const totalRows = entries.length + (curfewVal ? 1 : 0);

      // Auto-size: try 22pt → 13pt in 0.5pt steps
      let fontSize = 22;
      const FONT_MIN = 13;
      const STEP = 0.5;
      const lineGap = 1.45; // line-height multiplier

      const calcHeight = (fs: number) => totalRows * fs * lineGap;

      while (fontSize > FONT_MIN && calcHeight(fontSize) > availableH) {
        fontSize -= STEP;
      }
      // If it STILL doesn't fit at the floor, accept overflow gracefully —
      // 13pt is readable, and the footer will still render on page 1.
      // In practice this only happens with 20+ schedule entries, which
      // is extremely rare for a band daysheet.

      const rowH = fontSize * lineGap;
      // Time column width scales with font size so it stays proportional.
      const timeColW = fontSize * 4.8;

      if (totalRows > 0) {
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          const isBand = i === bandIdx;

          // Time — muted
          doc.setFont("helvetica", "normal");
          doc.setFontSize(fontSize);
          doc.setTextColor(...T.muted);
          doc.text(entry.time, ML, y);

          // Event label — ink normally, accent green + bold for band's set
          doc.setFont("helvetica", isBand ? "bold" : "normal");
          doc.setTextColor(...(isBand ? T.accent : T.ink));
          doc.text(entry.label, ML + timeColW, y);

          // Set length suffix on band's row — muted, smaller inline
          if (isBand && setLenVal) {
            const labelW = doc.getTextWidth(entry.label);
            const suffixFs = Math.max(fontSize * 0.65, 10);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(suffixFs);
            doc.setTextColor(...T.muted);
            doc.text(`  ·  ${setLenVal}`, ML + timeColW + labelW, y);
          }

          y += rowH;
        }

        // Curfew row — muted, same size as schedule
        if (curfewVal) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(fontSize);
          doc.setTextColor(...T.muted);
          doc.text(curfewVal, ML, y);
          doc.text("Curfew", ML + timeColW, y);
          y += rowH;
        }
      }

      // ════════════════════════════════════════════════════════════════════
      // BOTTOM STRIP — Contact + WiFi
      // Positioned absolutely at the bottom so it's always anchored.
      // ════════════════════════════════════════════════════════════════════
      const stripY = PH - MB - FOOTER_H - BOTTOM_STRIP_H + 12;

      // Hairline above the strip
      doc.setDrawColor(...T.border);
      doc.setLineWidth(0.5);
      doc.line(ML, stripY, ML + CW, stripY);

      const colW = CW / 2;
      const stripLabelY = stripY + 18;
      const stripLine1Y = stripY + 34;
      const stripLine2Y = stripY + 50;

      // Left column — Day of Show Contact
      const contactName = val(show.dos_contact_name);
      const contactPhone = val(show.dos_contact_phone);
      if (contactName || contactPhone) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(...T.muted);
        doc.setCharSpace(1.4);
        doc.text("DAY OF SHOW CONTACT", ML, stripLabelY);
        doc.setCharSpace(0);

        if (contactName) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(12);
          doc.setTextColor(...T.ink);
          doc.text(contactName, ML, stripLine1Y);
        }
        if (contactPhone) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(11);
          doc.setTextColor(...T.ink);
          doc.text(contactPhone, ML, stripLine2Y);
        }
      }

      // Right column — WiFi
      const wifiNet = val(show.wifi_network);
      const wifiPw = val(show.wifi_password);
      if (wifiNet || wifiPw) {
        const wifiX = ML + colW;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(...T.muted);
        doc.setCharSpace(1.4);
        doc.text("WIFI", wifiX, stripLabelY);
        doc.setCharSpace(0);

        if (wifiNet) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(12);
          doc.setTextColor(...T.ink);
          doc.text(wifiNet, wifiX, stripLine1Y);
        }
        if (wifiPw) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(11);
          doc.setTextColor(...T.muted);
          doc.text(wifiPw, wifiX, stripLine2Y);
        }
      }

      // ════════════════════════════════════════════════════════════════════
      // FOOTER — brand only, bottom right
      // ════════════════════════════════════════════════════════════════════
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...T.muted);
      const brandStr = "advancetouring.com";
      const brandW = doc.getTextWidth(brandStr);
      doc.text(brandStr, PW - MR - brandW, PH - MB + 6);

      // ────────────────────────────────────────────────────────────────────
      // Save
      // ────────────────────────────────────────────────────────────────────
      const venueSafe = show.venue_name.replace(/[^a-zA-Z0-9]/g, "");
      const filename = `${show.date}-${venueSafe}-RunOfShow.pdf`;
      doc.save(filename);
      toast.success("PDF downloaded");
    } catch (err: any) {
      console.error("PDF error:", err);
      toast.error("Failed to generate PDF");
    } finally {
      setGenerating(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

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
      Run of Show
    </Button>
  );
}
