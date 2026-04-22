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

      y += 12;

      // ════════════════════════════════════════════════════════════════════
      // SET LIST — bordered card with auto-sized rows
      //
      // Fit strategy (one-page guarantee is the hard constraint):
      //   1. Try single-column with a readable 14pt floor.
      //   2. If that doesn't fit, switch to two-column with an 11pt floor —
      //      doubles capacity without shrinking as aggressively.
      //   3. Numbering stays continuous: left column 1..N/2, right N/2+1..N.
      // ════════════════════════════════════════════════════════════════════

      const FOOTER_H = 16;
      const availableH = PH - MB - FOOTER_H - y;

      const FONT_MAX = 22;
      const FONT_MIN_SINGLE = 14;
      const FONT_MIN_DOUBLE = 11;
      const STEP = 0.5;
      const LINE_GAP = 1.6;
      const CARD_PAD_Y = 14;
      const CARD_PAD_X = 18;

      const rowCount = entries.length;

      const fit = (columns: number, floor: number) => {
        const rowsPerCol = Math.ceil(rowCount / columns);
        const heightAt = (fs: number) =>
          rowCount === 0 ? 0 : CARD_PAD_Y * 2 + rowsPerCol * fs * LINE_GAP;
        let fs = FONT_MAX;
        while (fs > floor && heightAt(fs) > availableH) fs -= STEP;
        return { fs, fits: heightAt(fs) <= availableH, rowsPerCol };
      };

      const singleTry = fit(1, FONT_MIN_SINGLE);
      const useTwoColumn = !singleTry.fits;
      const chosen = useTwoColumn ? fit(2, FONT_MIN_DOUBLE) : singleTry;

      const columns = useTwoColumn ? 2 : 1;
      const fontSize = chosen.fs;
      const rowsPerCol = chosen.rowsPerCol;

      const rowH = fontSize * LINE_GAP;
      const cardH = rowCount === 0 ? 0 : CARD_PAD_Y * 2 + rowsPerCol * rowH;
      const cardW = CW;
      const cardX = ML;
      const cardY = y;

      doc.setFillColor(...T.card);
      doc.roundedRect(cardX, cardY, cardW, cardH, 10, 10, "F");

      const colGap = 28;
      const totalInnerW = cardW - CARD_PAD_X * 2;
      const colW = (totalInnerW - (columns - 1) * colGap) / columns;

      let visibleIdx = 0;

      for (let c = 0; c < columns; c++) {
        const colX = cardX + CARD_PAD_X + c * (colW + colGap);
        const numColX = colX;
        const titleColX = numColX + fontSize * 2.2;
        let rowY = cardY + CARD_PAD_Y + rowH * 0.7;

        const startI = c * rowsPerCol;
        const endI = Math.min(startI + rowsPerCol, rowCount);

        for (let i = startI; i < endI; i++) {
          const entry = entries[i];
          const isNote = entry.kind === "note";

          if (!isNote) {
            visibleIdx += 1;
            doc.setFont("courier", "normal");
            doc.setFontSize(fontSize * 0.7);
            doc.setTextColor(...T.mutedSoft);
            doc.text(`${visibleIdx}.`, numColX, rowY);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(fontSize);
            doc.setTextColor(...T.ink);
            doc.text(titleOf(entry), titleColX, rowY);
          } else {
            doc.setFont("helvetica", "italic");
            doc.setFontSize(fontSize * 0.82);
            doc.setTextColor(...T.muted);
            doc.text(titleOf(entry), numColX, rowY);
          }

          // Hairline divider within this column (not after the last row)
          if (i < endI - 1) {
            const divY = cardY + CARD_PAD_Y + (i - startI + 1) * rowH;
            doc.setDrawColor(...T.borderSoft);
            doc.setLineWidth(0.4);
            doc.line(colX, divY, colX + colW, divY);
          }

          rowY += rowH;
        }
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
