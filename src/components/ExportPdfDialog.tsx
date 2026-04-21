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
// Typography and layout mirror `DaysheetGuestView` so this artifact reads as
// part of the same product family. jsPDF's built-in faces are a best-effort
// stand-in for the web fonts:
//   • times (bold)   ← DM Serif Display (display venue name)
//   • helvetica      ← DM Sans           (eyebrow, body, labels)
//   • courier        ← JetBrains Mono    (schedule times, phones, wifi pw)
//
// Colors mirror the app's light-mode palette:
//   --background       → canvas
//   --card             → card
//   --foreground       → ink
//   --muted-foreground → muted
//   --border           → border
//   pastel-green-fg    → accent

const T = {
  canvas:      [245, 243, 239] as [number, number, number],
  card:        [252, 250, 246] as [number, number, number],
  ink:         [26,  23,  20]  as [number, number, number],
  muted:       [139, 126, 118] as [number, number, number],
  mutedSoft:   [176, 166, 158] as [number, number, number],
  border:      [220, 213, 207] as [number, number, number],
  borderSoft:  [232, 226, 219] as [number, number, number],
  accent:      [52,  101, 56]  as [number, number, number],
  accentLight: [237, 243, 236] as [number, number, number],
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
      // HEADER — eyebrow + display venue + address + date
      // Mirrors the header block in `DaysheetGuestView.tsx`.
      // ════════════════════════════════════════════════════════════════════
      let y = MT + 4;

      // "RUN OF SHOW" eyebrow  (text-[11px] uppercase tracking-widest muted)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...T.muted);
      doc.setCharSpace(1.8);
      doc.text("RUN OF SHOW", ML, y);
      doc.setCharSpace(0);

      // Tour pill, top-right — pastel green chip
      const tourName = (show as any).tours?.name;
      if (tourName) {
        const tourLabel = String(tourName).toUpperCase();
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setCharSpace(1.2);
        const tourW = doc.getTextWidth(tourLabel);
        const pillPad = 9;
        const pillH = 14;
        const pillW = tourW + pillPad * 2 + 2;
        const pillX = PW - MR - pillW;
        const pillY = y - 10;

        doc.setFillColor(...T.accentLight);
        doc.roundedRect(pillX, pillY, pillW, pillH, pillH / 2, pillH / 2, "F");
        doc.setTextColor(...T.accent);
        doc.text(tourLabel, pillX + pillPad, y);
        doc.setCharSpace(0);
      }

      y += 26;

      // Venue name — big serif display (approximates DM Serif Display)
      doc.setFont("times", "bold");
      doc.setFontSize(42);
      doc.setTextColor(...T.ink);
      const venueLines = doc.splitTextToSize(show.venue_name, CW);
      doc.text(venueLines, ML, y);
      y += venueLines.length * 42 - 6;

      // Address (or city fallback) with a small pin glyph
      const rawAddr = val(show.venue_address)?.replace(/,?\s*United States$/i, "") ?? null;
      const cityStr = formatCityState(show.city);
      const locLine = rawAddr ?? cityStr ?? null;
      if (locLine) {
        y += 8;
        const pinX = ML + 2;
        const pinY = y - 5;
        // Minimal MapPin stand-in: a small outlined ring with a dot center
        doc.setDrawColor(...T.muted);
        doc.setLineWidth(0.8);
        doc.circle(pinX, pinY, 3.2, "S");
        doc.setFillColor(...T.muted);
        doc.circle(pinX, pinY, 0.9, "F");

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(...T.muted);
        const locLines = doc.splitTextToSize(locLine, CW - 14);
        doc.text(locLines, ML + 10, y);
        y += locLines.length * 12;
      }

      // Date — body text in foreground ink (matches guest page)
      const dateStr = format(parseISO(show.date), "EEEE, MMMM d, yyyy");
      y += 8;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(...T.ink);
      doc.text(dateStr, ML, y);

      y += 32;

      // ════════════════════════════════════════════════════════════════════
      // SCHEDULE — bordered card with mono times + subtle dividers
      //
      // Mirrors the `Schedule` card in `DaysheetGuestView.tsx`:
      //   - Card with rounded border
      //   - Two columns: [mono time | event label]
      //   - Hairline divider between rows
      //   - Band's set row: slight accent + mic indicator + set length inline
      //
      // Auto-shrinks from ~21pt down to a readable floor so a reasonable
      // number of schedule entries always fits on one page.
      // ════════════════════════════════════════════════════════════════════

      const entries = (show.schedule_entries ?? [])
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order);

      // Bottom area reserves: contact/wifi strip + footer brand.
      const BOTTOM_STRIP_H = 88;
      const FOOTER_H = 16;
      const availableH = PH - MB - FOOTER_H - BOTTOM_STRIP_H - y;

      const setLenVal = val(show.set_length);
      const bandIdx = entries.findIndex((e) => e.is_band);

      // Row auto-sizing. Each row is `fontSize * 1.6` tall (generous for
      // divider breathing room).
      const FONT_MAX = 21;
      const FONT_MIN = 12;
      const STEP = 0.5;
      const LINE_GAP = 1.6;
      const CARD_PAD_Y = 14;
      const CARD_PAD_X = 18;

      const rowCount = entries.length;
      const cardHeightAt = (fs: number) =>
        rowCount === 0
          ? 0
          : CARD_PAD_Y * 2 + rowCount * fs * LINE_GAP;

      let fontSize = FONT_MAX;
      while (fontSize > FONT_MIN && cardHeightAt(fontSize) > availableH) {
        fontSize -= STEP;
      }

      if (rowCount > 0) {
        const rowH = fontSize * LINE_GAP;
        const cardH = cardHeightAt(fontSize);
        const cardW = CW;
        const cardX = ML;

        // Vertically center the card in the available area so short
        // schedules don't feel abandoned at the top.
        const centerOffset = Math.max(0, (availableH - cardH) / 2);
        const cardY = y + centerOffset;

        // Card surface — subtle card fill + hairline border, rounded-lg (~8pt)
        doc.setFillColor(...T.card);
        doc.setDrawColor(...T.border);
        doc.setLineWidth(0.6);
        doc.roundedRect(cardX, cardY, cardW, cardH, 8, 8, "FD");

        // Time column width scales with type size (mono is wider)
        const timeColX = cardX + CARD_PAD_X;
        const labelColX = timeColX + fontSize * 4.6;

        // First row baseline (optical alignment: baseline sits ~70% down the row)
        let rowY = cardY + CARD_PAD_Y + rowH * 0.7;

        for (let i = 0; i < rowCount; i++) {
          const entry = entries[i];
          const isBand = i === bandIdx;

          // Time — mono, muted (matches `font-mono text-muted-foreground`)
          doc.setFont("courier", "normal");
          doc.setFontSize(fontSize * 0.85);
          doc.setTextColor(...T.muted);
          doc.text(entry.time, timeColX, rowY);

          // Event label — ink; band row gets accent color + bold + mic glyph
          doc.setFont("helvetica", isBand ? "bold" : "normal");
          doc.setFontSize(fontSize);
          doc.setTextColor(...(isBand ? T.accent : T.ink));

          let labelX = labelColX;
          if (isBand) {
            // Tiny "mic" glyph: small filled circle + short stem, echoing
            // the Mic icon in the guest view without needing font glyphs.
            const micCx = labelX + 2;
            const micCy = rowY - fontSize * 0.32;
            const micR = fontSize * 0.16;
            doc.setFillColor(...T.accent);
            doc.circle(micCx, micCy, micR, "F");
            doc.setDrawColor(...T.accent);
            doc.setLineWidth(0.9);
            doc.line(micCx, micCy + micR, micCx, micCy + micR + micR * 1.2);
            labelX += fontSize * 0.7;
          }

          const suffix = isBand && setLenVal ? ` (${setLenVal})` : "";
          doc.text(`${entry.label}${suffix}`, labelX, rowY);

          // Divider below each row except the last
          if (i < rowCount - 1) {
            const divY = cardY + CARD_PAD_Y + (i + 1) * rowH;
            doc.setDrawColor(...T.borderSoft);
            doc.setLineWidth(0.4);
            doc.line(cardX + CARD_PAD_X, divY, cardX + cardW - CARD_PAD_X, divY);
          }

          rowY += rowH;
        }
      }

      // ════════════════════════════════════════════════════════════════════
      // BOTTOM STRIP — Day of show contact + WiFi
      // Styled like `FieldGroup`: small dot accent + uppercase label,
      // labelled rows underneath.
      // ════════════════════════════════════════════════════════════════════
      const stripY = PH - MB - FOOTER_H - BOTTOM_STRIP_H + 14;
      const colGap = 24;
      const colW = (CW - colGap) / 2;

      const drawSectionHeader = (x: number, labelY: number, label: string) => {
        // Small rounded dot accent (matches FieldGroup's `w-0.5 h-3.5`)
        doc.setFillColor(...T.ink);
        doc.roundedRect(x, labelY - 7, 1.5, 9, 0.75, 0.75, "F");

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

      const contactName = val(show.dos_contact_name);
      const contactPhone = val(show.dos_contact_phone);
      const wifiNet = val(show.wifi_network);
      const wifiPw = val(show.wifi_password);

      const hasContact = contactName || contactPhone;
      const hasWifi = wifiNet || wifiPw;

      // Hairline above the strip (section break)
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
      // FOOTER — small brand mark, bottom right
      // ════════════════════════════════════════════════════════════════════
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...T.mutedSoft);
      doc.setCharSpace(1);
      const brandStr = "ADVANCE";
      const brandW = doc.getTextWidth(brandStr);
      doc.text(brandStr, PW - MR - brandW, PH - MB + 6);
      doc.setCharSpace(0);

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
