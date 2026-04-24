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
// jsPDF's built-in faces stand in for the product's web fonts:
//   • times         ← DM Serif Display (venue title, footer wordmark)
//   • helvetica     ← DM Sans           (eyebrow, body, labels)
//   • courier       ← JetBrains Mono    (schedule times, phones, wifi pw)
//
// RGB values are derived directly from the HSL tokens in
// `.claude/skills/advance-design/colors_and_type.css`:
//   --background      40 30% 97%  → canvas
//   --card            40 25% 99%  → card
//   --foreground      30 10% 12%  → ink
//   --muted-foreground 30 8% 50%  → muted
//   --text-tertiary   30  6% 62%  → mutedSoft
//   --border          35 18% 90%  → border
//   --pastel-green-bg #edf3ec     → accentSoft  (band row fill)
//   --pastel-green-fg #346538     → accent      (band row text)

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
      // HEADER — venue name + date + address
      // ════════════════════════════════════════════════════════════════════
      let y = MT + 36;

      // Venue name — serif display (Times approximates DM Serif Display)
      doc.setFont("times", "bold");
      doc.setFontSize(38);
      doc.setTextColor(...T.ink);
      const venueLines = doc.splitTextToSize(show.venue_name, CW);
      doc.text(venueLines, ML, y);
      y += venueLines.length * 38 - 4;

      // Date — muted metadata, one line below
      const dateStr = format(parseISO(show.date), "EEEE, MMMM d, yyyy");
      y += 10;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(...T.muted);
      doc.text(dateStr, ML, y);
      y += 16;

      // Address with a Lucide-style teardrop pin glyph
      const rawAddr = val(show.venue_address)?.replace(/,?\s*United States$/i, "") ?? null;
      const cityStr = formatCityState(show.city);
      const locLine = rawAddr ?? cityStr ?? null;
      if (locLine) {
        y += 4;
        // Teardrop: thin-stroked circle + two converging lines to a point below
        const pinCX = ML + 3;
        const pinCY = y - 4.5;
        const pinR = 2.8;
        const pinTipY = pinCY + pinR + 4.2;
        doc.setDrawColor(...T.muted);
        doc.setLineWidth(0.75);
        doc.circle(pinCX, pinCY, pinR, "S");
        const tailStartY = pinCY + pinR * 0.76;
        doc.line(pinCX - pinR * 0.65, tailStartY, pinCX, pinTipY);
        doc.line(pinCX + pinR * 0.65, tailStartY, pinCX, pinTipY);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(...T.muted);
        const locLines = doc.splitTextToSize(locLine, CW - 14);
        doc.text(locLines, ML + 11, y);
        y += locLines.length * 12;
      }

      y += 28;

      // ════════════════════════════════════════════════════════════════════
      // SCHEDULE — section label + bordered card
      //
      // The SCHEDULE label above the card follows the FieldGroup pattern:
      // a slim vertical bar accent + uppercase tracking label.
      //
      // Inside the card:
      //   - Two columns: [mono time | event label]
      //   - Hairline dividers between rows
      //   - Band row: pastel-green row fill + accent-green label + bold
      //
      // Auto-shrinks from 21pt down to 12pt to keep everything on one page.
      // ════════════════════════════════════════════════════════════════════

      const entries = (show.schedule_entries ?? [])
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order);

      // Reserve space for the SCHEDULE section label above the card
      const SCHEDULE_LABEL_RESERVE = 26;
      const BOTTOM_STRIP_H = 88;
      const FOOTER_H = 16;
      const availableH = PH - MB - FOOTER_H - BOTTOM_STRIP_H - y - SCHEDULE_LABEL_RESERVE;

      const setLenVal = val(show.set_length);
      const bandIdx = entries.findIndex((e) => e.is_band);

      // Row auto-sizing: each row is fontSize * 1.6 tall
      const FONT_MAX = 21;
      const FONT_MIN = 12;
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

      if (rowCount > 0) {
        const rowH = fontSize * LINE_GAP;
        const cardH = cardHeightAt(fontSize);
        const cardW = CW;
        const cardX = ML;

        // Gently center; capped so a sparse schedule doesn't float too far down
        const centerOffset = Math.min(Math.max(0, (availableH - cardH) / 2), 40);
        const cardY = y + SCHEDULE_LABEL_RESERVE + centerOffset;

        // SCHEDULE section label (FieldGroup: slim bar + uppercase tracking label)
        // Bar color: foreground/25 blended on canvas → (196, 194, 191)
        const schedLabelY = cardY - 12;
        doc.setFillColor(196, 194, 191);
        doc.roundedRect(ML, schedLabelY - 8, 2, 10, 1, 1, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...T.muted);
        doc.setCharSpace(1.8);
        doc.text("SCHEDULE", ML + 8, schedLabelY);
        doc.setCharSpace(0);

        // Card: draw fill first, then content, then stroke on top so the
        // border is never obscured by band-row fill rects drawn inside.
        doc.setFillColor(...T.card);
        doc.roundedRect(cardX, cardY, cardW, cardH, 10, 10, "F");

        // Time column width scales with type size (mono glyphs are wider)
        const timeColX = cardX + CARD_PAD_X;
        const labelColX = timeColX + fontSize * 4.6;

        // Baseline sits ~70% down the first row (optical alignment)
        let rowY = cardY + CARD_PAD_Y + rowH * 0.7;

        for (let i = 0; i < rowCount; i++) {
          const entry = entries[i];
          const isBand = i === bandIdx;

          // Band row: pastel-green-bg fill spanning the full row width.
          // CARD_PAD_Y (14pt) > corner radius (10pt) so the fill rect
          // never overlaps the card's rounded corners on first/last rows.
          if (isBand) {
            const rowTop = cardY + CARD_PAD_Y + i * rowH;
            doc.setFillColor(...T.accentSoft);
            doc.rect(cardX + 1, rowTop, cardW - 2, rowH, "F");
          }

          // Time — mono, muted
          doc.setFont("courier", "normal");
          doc.setFontSize(fontSize * 0.85);
          doc.setTextColor(...T.muted);
          doc.text(entry.time, timeColX, rowY);

          // Label — ink normally; band row gets accent green + bold weight
          doc.setFont("helvetica", isBand ? "bold" : "normal");
          doc.setFontSize(fontSize);
          doc.setTextColor(...(isBand ? T.accent : T.ink));

          const suffix = isBand && setLenVal ? ` (${setLenVal})` : "";
          doc.text(`${entry.label}${suffix}`, labelColX, rowY);

          // Hairline divider between rows
          if (i < rowCount - 1) {
            const divY = cardY + CARD_PAD_Y + (i + 1) * rowH;
            doc.setDrawColor(...T.borderSoft);
            doc.setLineWidth(0.4);
            doc.line(cardX + CARD_PAD_X, divY, cardX + cardW - CARD_PAD_X, divY);
          }

          rowY += rowH;
        }

        // Card border drawn last so it sits on top of band-row fill rects
        doc.setDrawColor(...T.border);
        doc.setLineWidth(0.6);
        doc.roundedRect(cardX, cardY, cardW, cardH, 10, 10, "S");
      }

      // ════════════════════════════════════════════════════════════════════
      // BOTTOM STRIP — Day of show contact + WiFi
      // ════════════════════════════════════════════════════════════════════
      const stripY = PH - MB - FOOTER_H - BOTTOM_STRIP_H + 14;
      const colGap = 24;
      const colW = (CW - colGap) / 2;

      const drawSectionHeader = (x: number, labelY: number, label: string) => {
        // Slim vertical bar accent — 2pt × 10pt, matching FieldGroup's w-0.5 h-3.5
        doc.setFillColor(...T.ink);
        doc.roundedRect(x, labelY - 8, 2, 10, 1, 1, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(...T.muted);
        doc.setCharSpace(1.6);
        doc.text(label, x + 8, labelY);
        doc.setCharSpace(0);
      };

      const drawKeyValueRow = (
        x: number,
        rowY: number,
        label: string,
        value: string,
        mono = false,
      ) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...T.muted);
        doc.text(label, x, rowY);

        doc.setFont(mono ? "courier" : "helvetica", "normal");
        doc.setFontSize(mono ? 10 : 11);
        doc.setTextColor(...T.ink);
        doc.text(value, x + 58, rowY);
      };

      const contactsList = [...(show.show_contacts ?? [])].sort((a, b) => a.sort_order - b.sort_order);
      const dos = contactsList.find((c) => c.role === "day_of_show") ?? contactsList[0];
      const contactName = val(dos?.name);
      const contactPhone = val(dos?.phone);
      const wifiNet = val(show.wifi_network);
      const wifiPw = val(show.wifi_password);

      const hasContact = contactName || contactPhone;
      const hasWifi = wifiNet || wifiPw;

      // Hairline section break above strip
      if (hasContact || hasWifi) {
        doc.setDrawColor(...T.border);
        doc.setLineWidth(0.5);
        doc.line(ML, stripY - 16, ML + CW, stripY - 16);
      }

      const labelY = stripY + 4;
      const row1Y = stripY + 30;
      const row2Y = stripY + 50;

      if (hasContact) {
        drawSectionHeader(ML, labelY, "DAY OF SHOW CONTACT");
        if (contactName) drawKeyValueRow(ML, row1Y, "Name", contactName);
        if (contactPhone) drawKeyValueRow(ML, row2Y, "Phone", contactPhone, true);
      }

      if (hasWifi) {
        const wifiX = ML + colW + colGap;
        drawSectionHeader(wifiX, labelY, "WIFI");
        if (wifiNet) drawKeyValueRow(wifiX, row1Y, "Network", wifiNet, true);
        if (wifiPw) drawKeyValueRow(wifiX, row2Y, "Password", wifiPw, true);
      }

      // ════════════════════════════════════════════════════════════════════
      // FOOTER — serif wordmark, bottom right
      // ════════════════════════════════════════════════════════════════════
      doc.setFont("times", "italic");
      doc.setFontSize(9);
      doc.setTextColor(...T.mutedSoft);
      const brandStr = "Advance";
      const brandW = doc.getTextWidth(brandStr);
      doc.text(brandStr, PW - MR - brandW, PH - MB + 6);

      // ────────────────────────────────────────────────────────────────────
      // Save
      // ────────────────────────────────────────────────────────────────────
      const venueSafe = show.venue_name.replace(/[^a-zA-Z0-9]/g, "");
      const filename = `${show.date}-${venueSafe}-RunOfShow.pdf`;
      doc.save(filename);
      toast.success("PDF downloaded");
    } catch (err: unknown) {
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
