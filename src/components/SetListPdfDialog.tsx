import { useState } from "react";
import { Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import jsPDF from "jspdf";
import type { Show, SetListEntry } from "@/lib/types";
import { formatCityState } from "@/lib/utils";

// ─── Design tokens ──────────────────────────────────────────────────────────
//
// Mirrors ExportPdfDialog so set list prints read as a companion artifact
// taped next to the run-of-show poster. Any token change here should also
// happen in ExportPdfDialog.

const T = {
  canvas:      [250, 248, 245] as [number, number, number],
  card:        [253, 253, 252] as [number, number, number],
  ink:         [34,  31,  28]  as [number, number, number],
  muted:       [138, 128, 117] as [number, number, number],
  mutedSoft:   [164, 158, 152] as [number, number, number],
  border:      [234, 230, 225] as [number, number, number],
  borderSoft:  [240, 236, 231] as [number, number, number],
  accent:      [52,  101, 56]  as [number, number, number],
  accentSoft:  [237, 243, 236] as [number, number, number],
} as const;

interface Props {
  show: Show;
  entries: SetListEntry[];
  trigger?: React.ReactNode;
}

function titleOf(e: SetListEntry): string {
  if (e.kind === "note") return e.text;
  return e.title;
}

export default function SetListPdfDialog({ show, entries, trigger }: Props) {
  const [generating, setGenerating] = useState(false);

  const generatePdf = () => {
    if (entries.length === 0) {
      toast.error("Add at least one song before exporting.");
      return;
    }
    setGenerating(true);

    try {
      const doc = new jsPDF({ unit: "pt", format: "letter" });
      const PW = doc.internal.pageSize.getWidth();
      const PH = doc.internal.pageSize.getHeight();

      const ML = 56;
      const MR = 56;
      const MT = 56;
      const MB = 56;
      const CW = PW - ML - MR;

      doc.setFillColor(...T.canvas);
      doc.rect(0, 0, PW, PH, "F");

      // ════════════════════════════════════════════════════════════════════
      // HEADER — venue + date + location (mirrors ExportPdfDialog)
      // ════════════════════════════════════════════════════════════════════
      let y = MT + 36;

      doc.setFont("times", "bold");
      doc.setFontSize(38);
      doc.setTextColor(...T.ink);
      const venueLines = doc.splitTextToSize(show.venue_name, CW);
      doc.text(venueLines, ML, y);
      y += venueLines.length * 38 - 4;

      const dateStr = format(parseISO(show.date), "EEEE, MMMM d, yyyy");
      y += 10;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(...T.muted);
      doc.text(dateStr, ML, y);
      y += 16;

      const cityStr = formatCityState(show.city);
      if (cityStr) {
        y += 4;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(...T.muted);
        doc.text(cityStr, ML, y);
        y += 12;
      }

      y += 28;

      // ════════════════════════════════════════════════════════════════════
      // SET LIST — section label + bordered card with auto-sized rows
      // ════════════════════════════════════════════════════════════════════

      const SECTION_LABEL_RESERVE = 26;
      const FOOTER_H = 16;
      const availableH = PH - MB - FOOTER_H - y - SECTION_LABEL_RESERVE;

      // Auto-size: start at 22pt, shrink to 11pt if needed
      const FONT_MAX = 22;
      const FONT_MIN = 11;
      const STEP = 0.5;
      const LINE_GAP = 1.6;
      const CARD_PAD_Y = 14;
      const CARD_PAD_X = 18;

      const rowCount = entries.length;
      const cardHeightAt = (fs: number) =>
        rowCount === 0 ? 0 : CARD_PAD_Y * 2 + rowCount * fs * LINE_GAP;

      let fontSize = FONT_MAX;
      while (fontSize > FONT_MIN && cardHeightAt(fontSize) > availableH) {
        fontSize -= STEP;
      }

      const rowH = fontSize * LINE_GAP;
      const cardH = cardHeightAt(fontSize);
      const cardW = CW;
      const cardX = ML;

      const centerOffset = Math.min(Math.max(0, (availableH - cardH) / 2), 40);
      const cardY = y + SECTION_LABEL_RESERVE + centerOffset;

      // Section label: slim vertical bar + uppercase tracking label
      const labelY = cardY - 12;
      doc.setFillColor(196, 194, 191);
      doc.roundedRect(ML, labelY - 8, 2, 10, 1, 1, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...T.muted);
      doc.setCharSpace(1.8);
      doc.text("SET LIST", ML + 8, labelY);
      doc.setCharSpace(0);

      // Card fill
      doc.setFillColor(...T.card);
      doc.roundedRect(cardX, cardY, cardW, cardH, 10, 10, "F");

      // Number column width scales with type size
      const numColX = cardX + CARD_PAD_X;
      const titleColX = numColX + fontSize * 2.2;
      let rowY = cardY + CARD_PAD_Y + rowH * 0.7;

      // Track visible-index (songs + customs increment; notes do not)
      let visibleIdx = 0;

      for (let i = 0; i < rowCount; i++) {
        const entry = entries[i];
        const isNote = entry.kind === "note";

        if (!isNote) {
          visibleIdx += 1;
          // Number (mono, muted)
          doc.setFont("courier", "normal");
          doc.setFontSize(fontSize * 0.7);
          doc.setTextColor(...T.mutedSoft);
          doc.text(`${visibleIdx}.`, numColX, rowY);

          // Title (sans, ink)
          doc.setFont("helvetica", "normal");
          doc.setFontSize(fontSize);
          doc.setTextColor(...T.ink);
          doc.text(titleOf(entry), titleColX, rowY);
        } else {
          // Note (italic, muted, indented into the number column)
          doc.setFont("helvetica", "italic");
          doc.setFontSize(fontSize * 0.82);
          doc.setTextColor(...T.muted);
          doc.text(titleOf(entry), numColX, rowY);
        }

        if (i < rowCount - 1) {
          const divY = cardY + CARD_PAD_Y + (i + 1) * rowH;
          doc.setDrawColor(...T.borderSoft);
          doc.setLineWidth(0.4);
          doc.line(cardX + CARD_PAD_X, divY, cardX + cardW - CARD_PAD_X, divY);
        }

        rowY += rowH;
      }

      // Border last so it sits on top of any fills
      doc.setDrawColor(...T.border);
      doc.setLineWidth(0.6);
      doc.roundedRect(cardX, cardY, cardW, cardH, 10, 10, "S");

      // ════════════════════════════════════════════════════════════════════
      // FOOTER
      // ════════════════════════════════════════════════════════════════════
      doc.setFont("times", "italic");
      doc.setFontSize(9);
      doc.setTextColor(...T.mutedSoft);
      const brandStr = "Advance";
      const brandW = doc.getTextWidth(brandStr);
      doc.text(brandStr, PW - MR - brandW, PH - MB + 6);

      const venueSafe = show.venue_name.replace(/[^a-zA-Z0-9]/g, "");
      const filename = `${show.date}-${venueSafe}-SetList.pdf`;
      doc.save(filename);
      toast.success("Set list PDF downloaded");
    } catch (err: any) {
      console.error("Set list PDF error:", err);
      toast.error("Failed to generate PDF");
    } finally {
      setGenerating(false);
    }
  };

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
        <FileText className="h-4 w-4" />
      )}
      Export PDF
    </Button>
  );
}
