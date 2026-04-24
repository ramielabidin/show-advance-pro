import { useState } from "react";
import { Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import jsPDF from "jspdf";
import type { Show, SetListEntry } from "@/lib/types";
import { formatCityState } from "@/lib/utils";
import { shareOrDownloadPdf } from "@/lib/sharePdf";

// ─── Design tokens ──────────────────────────────────────────────────────────
//
// Set lists get printed and taped to the wall — pure black-and-white so it
// reads cleanly on any home/office printer and doesn't waste color/grayscale
// toner on a warm background. The Run-of-Show poster keeps its warm palette
// (see ExportPdfDialog) since it's a hero artifact, not a printable utility.

const T = {
  ink:       [0,   0,   0]   as [number, number, number],
  muted:     [80,  80,  80]  as [number, number, number],
  mutedSoft: [120, 120, 120] as [number, number, number],
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

  const generatePdf = async () => {
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

      // No page fill — leave the page natively white. Skipping the fill means
      // printers that interpret near-white as a tint won't waste toner on the
      // background.

      // ════════════════════════════════════════════════════════════════════
      // HEADER — venue left, date + city stacked right, baseline-anchored
      // ════════════════════════════════════════════════════════════════════

      const cityStr = formatCityState(show.city);
      const dateStr = format(parseISO(show.date), "EEE, MMM d, yyyy");
      const rightReserveW = cityStr ? 200 : 170;
      const venueMaxW = CW - rightReserveW - 16;

      const VENUE_FS = 38;
      doc.setFont("times", "bold");
      doc.setFontSize(VENUE_FS);
      doc.setTextColor(...T.ink);
      const venueLines = doc.splitTextToSize(show.venue_name, venueMaxW);

      const firstBaselineY = MT + 36;
      doc.text(venueLines, ML, firstBaselineY);
      const lastVenueBaseline = firstBaselineY + (venueLines.length - 1) * VENUE_FS;

      const rightX = ML + CW;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(...T.muted);
      doc.text(dateStr, rightX, lastVenueBaseline, { align: "right" });

      if (cityStr) {
        doc.setFontSize(10);
        doc.setTextColor(...T.mutedSoft);
        doc.text(cityStr, rightX, lastVenueBaseline + 14, { align: "right" });
      }

      const y = lastVenueBaseline + (cityStr ? 14 : 0) + 22;

      // ════════════════════════════════════════════════════════════════════
      // SET LIST — unboxed, numbered list with auto-sized rows
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

      const rowCount = entries.length;

      const fit = (columns: number, floor: number) => {
        const rowsPerCol = Math.ceil(rowCount / columns);
        const heightAt = (fs: number) =>
          rowCount === 0 ? 0 : rowsPerCol * fs * LINE_GAP;
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
      const colGap = 28;
      const colW = (CW - (columns - 1) * colGap) / columns;

      let visibleIdx = 0;

      for (let c = 0; c < columns; c++) {
        const colX = ML + c * (colW + colGap);
        const numColX = colX;
        const titleColX = numColX + fontSize * 2.2;
        let rowY = y + rowH * 0.7;

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

          rowY += rowH;
        }
      }

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
      const result = await shareOrDownloadPdf(doc, filename, `${show.venue_name} — Set List`);
      toast.success(result === "shared" ? "Set list ready to share" : "Set list PDF downloaded");
    } catch (err: unknown) {
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
