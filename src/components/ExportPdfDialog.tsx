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

function stripCountry(s: string | null): string | null {
  return s?.replace(/,?\s*United States$/i, "") ?? null;
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

// ─── Types ──────────────────────────────────────────────────────────────────

interface Props {
  show: Show & { schedule_entries?: ScheduleEntry[] };
  trigger?: React.ReactNode;
}

// ─── Design tokens (mirroring the app's light-mode palette) ─────────────────
//
// Colors map to the app's CSS variables when theme is `light`:
//
//   --background:         #F5F3EF  (warm off-white canvas)
//   --foreground:         #1A1714  (near-black, never pure #000)
//   --muted-foreground:   #8B7E76  (warm gray for labels / meta)
//   --border:             #E2DAD4  (warm hairline)
//   --accent-green:       #3D7A5C  (Advanced badge green)
//
// Typography: jsPDF only ships Helvetica / Times / Courier. We use Times
// for the "Advance" wordmark + venue name (mirrors the app's font-display
// serif) and Helvetica for everything else. No Courier — it reads dated.
// Times figures align well enough at small sizes for the schedule column.

const T = {
  canvas:      [245, 243, 239] as [number, number, number],
  ink:         [26,  23,  20]  as [number, number, number],
  muted:       [139, 126, 118] as [number, number, number],
  border:      [220, 213, 207] as [number, number, number],
  accent:      [61,  122, 92]  as [number, number, number],
  accentLight: [237, 243, 240] as [number, number, number],
  // Subtle band that backgrounds the header KPI strip and schedule card.
  // Pulled towards canvas so it reads as a quiet zone, not a callout.
  panel:       [240, 237, 232] as [number, number, number],
  panelGreen:  [243, 240, 234] as [number, number, number],
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

      const ML = 52;
      const MR = 52;
      const MT = 48;
      const MB = 48;
      const CW = PW - ML - MR;       // 508
      const COL_GAP = 24;
      const COL_W = (CW - COL_GAP) / 2;

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

      // ── Section header: small accent bar + uppercase label ──────────────
      const sectionHeader = (title: string, x = ML, preGap = 18) => {
        if (x === ML) checkPage(preGap + 24);
        y += preGap;
        doc.setFillColor(...T.accent);
        doc.rect(x, y - 8, 2, 10, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(...T.muted);
        doc.setCharSpace(1.5);
        doc.text(title.toUpperCase(), x + 8, y);
        doc.setCharSpace(0);
        y += 12;
      };

      // ── Tiny label (no bar) — for in-grid section headings ──────────────
      // Returns the y position AFTER the label so callers can stack values.
      const drawTinyLabel = (title: string, x: number, atY: number): number => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(...T.muted);
        doc.setCharSpace(1.2);
        doc.text(title.toUpperCase(), x, atY);
        doc.setCharSpace(0);
        return atY + 11;
      };

      const has = (key: SectionKey) => hasData(show, key);

      // ════════════════════════════════════════════════════════════════════
      // HEADER — wordmark + tour pill, then venue + meta
      // ════════════════════════════════════════════════════════════════════

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
        const pillPad = 8;
        const pillW = tourW + pillPad * 2 + 6; // a bit extra for charSpace
        const pillX = PW - MR - pillW;
        const pillY = y - 9;

        doc.setFillColor(...T.accentLight);
        doc.roundedRect(pillX, pillY, pillW, 12, 6, 6, "F");

        doc.setCharSpace(1.0);
        doc.setTextColor(...T.accent);
        doc.text(tourLabel, pillX + pillPad, y);
        doc.setCharSpace(0);
      }

      y += 22;

      // Venue name
      doc.setFont("times", "bold");
      doc.setFontSize(28);
      doc.setTextColor(...T.ink);
      const venueLines = doc.splitTextToSize(show.venue_name, CW);
      doc.text(venueLines, ML, y);
      y += venueLines.length * 30;

      // City · Date
      const dateStr = format(parseISO(show.date), "EEEE, MMMM d, yyyy");
      const cityStr = formatCityState(show.city);
      const metaStr = cityStr ? `${cityStr}  ·  ${dateStr}` : dateStr;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...T.muted);
      doc.text(metaStr, ML, y);
      y += 18;

      // ════════════════════════════════════════════════════════════════════
      // KPI STRIP — Contact / Set Length / Curfew
      // The three things people reach for first. Tinted panel, three columns.
      // ════════════════════════════════════════════════════════════════════
      {
        const contactName = val(show.dos_contact_name);
        const contactPhone = val(show.dos_contact_phone);
        const setLen = val(show.set_length);
        const curfew = val(show.curfew);

        const items: { label: string; lines: string[] }[] = [];
        if (contactName || contactPhone) {
          const lines: string[] = [];
          if (contactName) lines.push(contactName);
          if (contactPhone) lines.push(contactPhone);
          items.push({ label: "Day of Show Contact", lines });
        }
        if (setLen) items.push({ label: "Set Length", lines: [setLen] });
        if (curfew) items.push({ label: "Curfew", lines: [curfew] });

        if (items.length > 0) {
          const stripPadX = 14;
          const stripPadY = 12;
          const lineH = 12;
          const headerH = 11;
          const maxLines = Math.max(...items.map(i => i.lines.length));
          const stripH = stripPadY * 2 + headerH + maxLines * lineH;

          checkPage(stripH + 10);
          doc.setFillColor(...T.panelGreen);
          doc.roundedRect(ML, y, CW, stripH, 4, 4, "F");

          const colW = CW / items.length;
          items.forEach((item, idx) => {
            const cx = ML + idx * colW + stripPadX;
            let cy = y + stripPadY + 8;
            cy = drawTinyLabel(item.label, cx, cy);
            cy += 2;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(11);
            doc.setTextColor(...T.ink);
            item.lines.forEach((ln, i) => {
              // First line bold for name; subsequent lines regular
              doc.setFont("helvetica", i === 0 && item.lines.length > 1 ? "bold" : "normal");
              doc.text(ln, cx, cy + i * lineH);
            });
          });

          y += stripH + 18;
        }
      }

      // ════════════════════════════════════════════════════════════════════
      // SCHEDULE — featured block. White card on warm canvas.
      // ════════════════════════════════════════════════════════════════════
      if (has("schedule")) {
        const entries = (show.schedule_entries ?? [])
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order);

        if (entries.length > 0) {
          // Header (no panel padding; lives above the card)
          sectionHeader("Schedule");

          const cardPadX = 16;
          const cardPadY = 12;
          const rowH = 16;
          const cardH = cardPadY * 2 + entries.length * rowH;

          checkPage(cardH + 6);
          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(...T.border);
          doc.setLineWidth(0.5);
          doc.roundedRect(ML, y - 4, CW, cardH, 4, 4, "FD");

          const timeColX = ML + cardPadX;
          const labelColX = ML + cardPadX + 70;
          let ry = y - 4 + cardPadY + 8;

          for (const entry of entries) {
            // Time — bold, ink
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9.5);
            doc.setTextColor(...T.ink);
            doc.text(entry.time, timeColX, ry);

            // Label — normal, ink. If it matches the band/headliner pattern,
            // tint accent. Heuristic: assume the latest (last) entry that
            // isn't a generic event name is the headliner.
            const isHeadliner =
              entry === entries[entries.length - 1] &&
              !/^(load|sound|door|opener|support|curfew|merch)/i.test(entry.label);

            doc.setFont("helvetica", isHeadliner ? "bold" : "normal");
            doc.setFontSize(10);
            doc.setTextColor(...(isHeadliner ? T.accent : T.ink));
            doc.text(entry.label, labelColX, ry);
            ry += rowH;
          }

          y = y - 4 + cardH + 4;
        }
      }

      // ════════════════════════════════════════════════════════════════════
      // TWO-COLUMN GRID for the rest
      // We pre-compute each block's content + height, then place them into
      // left/right columns greedy-style (shorter column wins next block).
      // Full-width blocks flush both columns first.
      // ════════════════════════════════════════════════════════════════════

      type Block = {
        full?: boolean;
        height: number;
        render: (x: number, w: number, atY: number) => number; // returns y after
      };

      const blocks: Block[] = [];

      // Helper — measures wrapped text height for a given width
      const measureLines = (text: string, w: number, fontSize = 10): number => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(fontSize);
        return doc.splitTextToSize(text, w).length;
      };

      // Helper — generic "tiny label + body text" block builder
      const makeTextBlock = (
        label: string,
        body: string,
        opts?: { full?: boolean; fontSize?: number }
      ): Block => {
        const fs = opts?.fontSize ?? 10;
        const w = opts?.full ? CW : COL_W;
        const lineCount = measureLines(body, w, fs);
        const lineH = fs + 3;
        const height = 11 + 4 + lineCount * lineH + 14; // label + gap + body + gutter
        return {
          full: opts?.full,
          height,
          render: (x, _w, atY) => {
            let cy = drawTinyLabel(label, x, atY + 8);
            cy += 4;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(fs);
            doc.setTextColor(...T.ink);
            const lines = doc.splitTextToSize(body, _w);
            doc.text(lines, x, cy);
            return atY + height;
          },
        };
      };

      // ── Venue address (+ capacity inline as muted) ──────────────────────
      if (val(show.venue_address)) {
        const cap = val(show.venue_capacity);
        const age = val(show.age_restriction);
        const meta = [cap && `Capacity ${cap}`, age && age].filter(Boolean).join(" · ");
        const addr = stripCountry(val(show.venue_address))!;

        blocks.push({
          height: 11 + 4 + measureLines(addr, COL_W) * 13 + (meta ? 14 : 0) + 14,
          render: (x, w, atY) => {
            let cy = drawTinyLabel("Venue", x, atY + 8);
            cy += 4;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(...T.ink);
            const lines = doc.splitTextToSize(addr, w);
            doc.text(lines, x, cy);
            cy += lines.length * 13;
            if (meta) {
              doc.setFontSize(9);
              doc.setTextColor(...T.muted);
              doc.text(meta, x, cy);
              cy += 12;
            }
            return atY + 11 + 4 + lines.length * 13 + (meta ? 14 : 0) + 14;
          },
        });
      }

      // ── WiFi (network + password stacked) ───────────────────────────────
      {
        const net = val(show.wifi_network);
        const pw = val(show.wifi_password);
        if (net || pw) {
          blocks.push({
            height: 11 + 4 + (net ? 13 : 0) + (pw ? 13 : 0) + 14,
            render: (x, _w, atY) => {
              let cy = drawTinyLabel("WiFi", x, atY + 8);
              cy += 4;
              doc.setFont("helvetica", "normal");
              doc.setFontSize(10);
              if (net) {
                doc.setTextColor(...T.ink);
                doc.text(net, x, cy);
                cy += 13;
              }
              if (pw) {
                doc.setTextColor(...T.muted);
                doc.text(pw, x, cy);
                cy += 13;
              }
              return atY + 11 + 4 + (net ? 13 : 0) + (pw ? 13 : 0) + 14;
            },
          });
        }
      }

      // ── Load In ──────────────────────────────────────────────────────────
      if (val(show.load_in_details)) {
        blocks.push(makeTextBlock("Load In", val(show.load_in_details)!));
      }

      // ── Parking ──────────────────────────────────────────────────────────
      if (val(show.parking_notes)) {
        blocks.push(makeTextBlock("Parking", val(show.parking_notes)!));
      }

      // ── Green Room (full width — usually long) ──────────────────────────
      if (val(show.green_room_info)) {
        blocks.push(makeTextBlock("Green Room", val(show.green_room_info)!, { full: true }));
      }

      // ── Departure (label includes time inline) ──────────────────────────
      if (has("departure")) {
        const dTime = val(show.departure_time);
        const dNotes = val(show.departure_notes);
        if (dTime || dNotes) {
          const label = dTime ? `Departure · ${dTime}` : "Departure";
          if (dNotes) {
            blocks.push(makeTextBlock(label, dNotes, { full: true }));
          } else {
            // Time-only departure → render in the column grid
            blocks.push({
              height: 11 + 4 + 13 + 14,
              render: (x, _w, atY) => {
                let cy = drawTinyLabel("Departure", x, atY + 8);
                cy += 4;
                doc.setFont("helvetica", "bold");
                doc.setFontSize(10);
                doc.setTextColor(...T.ink);
                doc.text(dTime!, x, cy);
                return atY + 11 + 4 + 13 + 14;
              },
            });
          }
        }
      }

      // ── Accommodations (full width — multi-field) ───────────────────────
      if (has("hotel")) {
        const hName = val(show.hotel_name);
        const hAddr = stripCountry(val(show.hotel_address));
        const conf = val(show.hotel_confirmation);
        const ci = val(show.hotel_checkin);
        const co = val(show.hotel_checkout);

        if (hName || hAddr || conf || ci || co) {
          const inlineParts = [
            conf && { label: "Conf", value: conf },
            ci && { label: "In", value: ci },
            co && { label: "Out", value: co },
          ].filter(Boolean) as { label: string; value: string }[];

          const nameLines = hName ? measureLines(hName, CW) : 0;
          const addrLines = hAddr ? measureLines(hAddr, CW, 9) : 0;
          const inlineH = inlineParts.length > 0 ? 14 : 0;
          const height = 11 + 4 + nameLines * 13 + addrLines * 12 + inlineH + 14;

          blocks.push({
            full: true,
            height,
            render: (x, w, atY) => {
              let cy = drawTinyLabel("Accommodations", x, atY + 8);
              cy += 4;
              if (hName) {
                doc.setFont("helvetica", "bold");
                doc.setFontSize(10);
                doc.setTextColor(...T.ink);
                const lines = doc.splitTextToSize(hName, w);
                doc.text(lines, x, cy);
                cy += lines.length * 13;
              }
              if (hAddr) {
                doc.setFont("helvetica", "normal");
                doc.setFontSize(9);
                doc.setTextColor(...T.muted);
                const lines = doc.splitTextToSize(hAddr, w);
                doc.text(lines, x, cy);
                cy += lines.length * 12;
              }
              if (inlineParts.length > 0) {
                cy += 4;
                let ix = x;
                inlineParts.forEach((part, i) => {
                  doc.setFont("helvetica", "normal");
                  doc.setFontSize(9);
                  doc.setTextColor(...T.muted);
                  doc.text(part.label, ix, cy);
                  const labelW = doc.getTextWidth(part.label) + 4;
                  doc.setTextColor(...T.ink);
                  doc.text(part.value, ix + labelW, cy);
                  const valueW = doc.getTextWidth(part.value);
                  ix += labelW + valueW + (i < inlineParts.length - 1 ? 18 : 0);
                });
              }
              return atY + height;
            },
          });
        }
      }

      // ── Guest List (full width — can be long) ───────────────────────────
      if (has("guestList") && val(show.guest_list_details)) {
        const formatted = formatGuestList(val(show.guest_list_details)!);
        blocks.push(makeTextBlock("Guest List", formatted, { full: true }));
      }

      // ── Place blocks: full-width flushes columns; otherwise greedy ──────
      let leftY = y;
      let rightY = y;
      const RIGHT_X = ML + COL_W + COL_GAP;

      const flushColumns = () => {
        const maxY = Math.max(leftY, rightY);
        leftY = maxY;
        rightY = maxY;
      };

      for (const block of blocks) {
        if (block.full) {
          flushColumns();
          // Page-break if needed
          if (leftY + block.height > PH - MB) {
            doc.addPage();
            paintCanvas();
            leftY = MT;
            rightY = MT;
          }
          const newY = block.render(ML, CW, leftY);
          leftY = newY;
          rightY = newY;
        } else {
          // Pick the shorter column
          const useLeft = leftY <= rightY;
          const targetY = useLeft ? leftY : rightY;
          const targetX = useLeft ? ML : RIGHT_X;

          if (targetY + block.height > PH - MB) {
            // Page break
            doc.addPage();
            paintCanvas();
            leftY = MT;
            rightY = MT;
            const newY = block.render(ML, COL_W, leftY);
            leftY = newY;
          } else {
            const newY = block.render(targetX, COL_W, targetY);
            if (useLeft) leftY = newY;
            else rightY = newY;
          }
        }
      }

      y = Math.max(leftY, rightY);

      // ════════════════════════════════════════════════════════════════════
      // FOOTER — hairline + page number left, brand right
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
      PDF
    </Button>
  );
}
