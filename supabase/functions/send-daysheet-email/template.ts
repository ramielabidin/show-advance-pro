// HTML + plain-text renderer for the band day-sheet email.
//
// Visual target: `src/components/guest/DaysheetGuestView.tsx` — same section
// order, same empty-section skipping, same pastel-green accent on the band's
// schedule row. Light theme only (dark-mode email is too fragile across
// Gmail/Outlook to justify the complexity).
//
// Pure string rendering — no DOM, no React, no date-fns — so this module is
// importable from both the Deno edge-function runtime and the Vitest/Node
// test runner without a transform layer.

import {
  hasData,
  val,
  type ShowLike,
  type SectionKey,
} from "./sections.ts";

// ---------------------------------------------------------------------------
// Theme (flattened from src/index.css light-mode tokens)
// ---------------------------------------------------------------------------

const T = {
  pageBg: "#f8f6f0",
  cardBg: "#fbfaf5",
  fg: "#211d17",
  muted: "#8a7e6b",
  border: "#e8e0d3",
  bandFg: "#346538",
  bandBg: "#edf3ec",
  link: "#1f6c9f",
  sans: `"DM Sans", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif`,
  mono: `"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`,
};

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface RenderShow extends ShowLike {
  artist_name?: string | null;
  venue_name?: string | null;
  date?: string | null;
  set_length?: string | null;
  additional_info?: string | null;
  hotel_checkin?: string | null;
  hotel_checkout?: string | null;
}

export interface RenderOptions {
  personalMessage?: string | null;
  senderName?: string | null;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function nl2br(raw: string): string {
  return escapeHtml(raw).replace(/\r?\n/g, "<br />");
}

function stripCountry(addr: string): string {
  return addr.replace(/,?\s*United States$/i, "");
}

/** "Wednesday, April 22, 2026" — matches DaysheetGuestView via date-fns `EEEE, MMMM d, yyyy`. */
export function formatFullDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatCityState(city: string | null | undefined): string {
  if (!city) return "";
  return city.replace(/\*+$/, "").trim();
}

function formatGuestListText(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((entry: unknown) => {
          if (!entry || typeof entry !== "object") return "";
          const e = entry as Record<string, unknown>;
          const name = String(e.name ?? e.Name ?? "").trim();
          const plusRaw = e.plusOnes ?? e.plus_ones ?? e.plusOne ?? 0;
          const plus = typeof plusRaw === "number" ? plusRaw : parseInt(String(plusRaw), 10) || 0;
          if (!name) return "";
          return plus > 0 ? `${name} +${plus}` : name;
        })
        .filter(Boolean);
    }
  } catch {
    // not JSON — fall through
  }
  return raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function artistVenueLine(show: RenderShow): string {
  const artist = val(show.artist_name);
  const venue = val(show.venue_name);
  if (artist && venue) return `${artist} at ${venue}`;
  if (venue) return venue;
  if (artist) return artist;
  return "Day Sheet";
}

// ---------------------------------------------------------------------------
// HTML building blocks
// ---------------------------------------------------------------------------

function sectionCard(title: string, innerHtml: string): string {
  return `
  <tr><td style="padding:0 0 24px 0;">
    <div style="font-family:${T.sans};font-size:11px;line-height:1.4;letter-spacing:0.12em;text-transform:uppercase;color:${T.muted};font-weight:500;margin:0 0 10px 0;">${escapeHtml(title)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${T.border};border-radius:8px;background:${T.cardBg};">
      <tr><td style="padding:16px 18px;">
        ${innerHtml}
      </td></tr>
    </table>
  </td></tr>`;
}

function fieldRow(label: string, value: string | null | undefined, opts: { mono?: boolean } = {}): string {
  const v = val(value);
  if (!v) return "";
  const valueFont = opts.mono ? T.mono : T.sans;
  const valueSize = opts.mono ? "13px" : "14px";
  // Return just the <tr> — the enclosing <table> is supplied by fieldTable()
  // so every row in a card shares one column layout. Per-row tables make
  // Gmail re-compute label width per row, which makes "Load In" wrap and
  // short values like "8:30 AM" float away from their label.
  return `
    <tr>
      <td valign="top" style="font-family:${T.sans};font-size:14px;line-height:1.5;color:${T.muted};padding:4px 12px 4px 0;vertical-align:top;">${escapeHtml(label)}</td>
      <td valign="top" style="font-family:${valueFont};font-size:${valueSize};line-height:1.5;color:${T.fg};padding:4px 0;vertical-align:top;white-space:pre-wrap;word-break:break-word;">${nl2br(v)}</td>
    </tr>`;
}

function fieldTable(rowsHtml: string): string {
  if (!rowsHtml.trim()) return "";
  // table-layout:fixed + <colgroup> locks the label column width across all
  // rows in the card — otherwise Gmail's auto-layout algorithm collapses
  // the label when the value is a long multi-line block.
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;border-collapse:collapse;">
    <colgroup><col style="width:128px;" /><col /></colgroup>
    ${rowsHtml}
  </table>`;
}

function freeTextRow(value: string | null | undefined): string {
  const v = val(value);
  if (!v) return "";
  return `<div style="font-family:${T.sans};font-size:14px;line-height:1.55;color:${T.fg};white-space:pre-wrap;word-break:break-word;">${nl2br(v)}</div>`;
}

function renderSchedule(show: RenderShow): string {
  const entries = [...(show.schedule_entries ?? [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );
  if (entries.length === 0) return "";

  const rows = entries
    .map((entry, i) => {
      const isBand = !!entry.is_band;
      const setInline = isBand && val(show.set_length) ? ` (${escapeHtml(val(show.set_length)!)})` : "";
      const label = escapeHtml(entry.label ?? "");
      const time = escapeHtml(entry.time ?? "");
      const isLast = i === entries.length - 1;
      const bandStyle = isBand
        ? `color:${T.bandFg};font-weight:600;background:${T.bandBg};`
        : `color:${T.fg};font-weight:400;`;
      return `
      <tr>
        <td style="font-family:${T.mono};font-size:13px;line-height:1.5;color:${T.muted};padding:10px 12px 10px 0;vertical-align:top;white-space:nowrap;border-bottom:${isLast ? "0" : `1px solid ${T.border}`};width:80px;${isBand ? `background:${T.bandBg};` : ""}">${time}</td>
        <td style="font-family:${T.sans};font-size:15px;line-height:1.5;padding:10px 0;vertical-align:top;border-bottom:${isLast ? "0" : `1px solid ${T.border}`};${bandStyle}">${label}${setInline}</td>
      </tr>`;
    })
    .join("");

  return sectionCard(
    "Schedule",
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`,
  );
}

function renderContact(show: RenderShow): string {
  const inner = fieldTable(
    fieldRow("Name", show.dos_contact_name) +
      fieldRow("Phone", show.dos_contact_phone, { mono: true }),
  );
  return sectionCard("Day of Show Contact", inner);
}

function renderDeparture(show: RenderShow): string {
  const inner = fieldTable(
    fieldRow("Time", show.departure_time, { mono: true }) +
      fieldRow("Notes", show.departure_notes),
  );
  return sectionCard("Departure", inner);
}

function renderArrival(show: RenderShow): string {
  const inner = fieldTable(
    (hasData(show, "loadIn") ? fieldRow("Load In", show.load_in_details) : "") +
      (hasData(show, "parking") ? fieldRow("Parking", show.parking_notes) : ""),
  );
  return sectionCard("Arrival", inner);
}

function renderAtVenue(show: RenderShow): string {
  const rows: string[] = [];
  if (hasData(show, "greenRoom")) rows.push(fieldRow("Green Room", show.green_room_info));
  if (hasData(show, "wifi")) {
    const network = val(show.wifi_network);
    const password = val(show.wifi_password);
    const wifiValue = [network, password].filter(Boolean).join("\n");
    rows.push(fieldRow("WiFi", wifiValue, { mono: true }));
  }
  return sectionCard("At The Venue", fieldTable(rows.join("")));
}

function renderHotel(show: RenderShow): string {
  const inner = fieldTable(
    fieldRow("Name", show.hotel_name) +
      fieldRow("Address", show.hotel_address) +
      fieldRow("Confirmation #", show.hotel_confirmation, { mono: true }) +
      fieldRow("Check In", show.hotel_checkin, { mono: true }) +
      fieldRow("Check Out", show.hotel_checkout, { mono: true }),
  );
  return sectionCard("Accommodations", inner);
}

function renderGuestList(show: RenderShow): string {
  const names = formatGuestListText(show.guest_list_details);
  if (names.length === 0) return "";
  const items = names
    .map(
      (name) =>
        `<li style="font-family:${T.sans};font-size:14px;line-height:1.6;color:${T.fg};margin:0;padding:2px 0;">${escapeHtml(name)}</li>`,
    )
    .join("");
  return sectionCard(
    "Guest List",
    `<ul style="margin:0;padding:0 0 0 18px;list-style:disc;">${items}</ul>`,
  );
}

function renderNotes(show: RenderShow): string {
  const notes = val(show.additional_info);
  if (!notes) return "";
  return sectionCard("Notes", freeTextRow(notes));
}

function renderPersonalMessage(message: string | null | undefined, senderName: string | null | undefined): string {
  const msg = val(message);
  if (!msg) return "";
  const fromLine = senderName
    ? `<div style="font-family:${T.sans};font-size:11px;line-height:1.4;letter-spacing:0.12em;text-transform:uppercase;color:${T.muted};font-weight:500;margin:0 0 8px 0;">From ${escapeHtml(senderName)}</div>`
    : "";
  return `
  <tr><td style="padding:0 0 24px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-left:3px solid ${T.border};background:${T.cardBg};border-radius:4px;">
      <tr><td style="padding:14px 18px;">
        ${fromLine}
        <div style="font-family:${T.sans};font-size:15px;line-height:1.55;color:${T.fg};white-space:pre-wrap;word-break:break-word;">${nl2br(msg)}</div>
      </td></tr>
    </table>
  </td></tr>`;
}

function renderHeader(show: RenderShow): string {
  const title = escapeHtml(artistVenueLine(show));
  const dateStr = formatFullDate(show.date);
  const addr = val(show.venue_address) ? stripCountry(show.venue_address!) : "";
  const city = formatCityState(show.city);
  const addrHtml = addr
    ? `<div style="margin-top:6px;"><a href="https://maps.google.com/?q=${encodeURIComponent(addr)}" style="font-family:${T.sans};font-size:13px;line-height:1.5;color:${T.muted};text-decoration:none;">${escapeHtml(addr)}</a></div>`
    : city
      ? `<div style="margin-top:6px;font-family:${T.sans};font-size:13px;line-height:1.5;color:${T.muted};">${escapeHtml(city)}</div>`
      : "";
  const dateHtml = dateStr
    ? `<div style="margin-top:8px;font-family:${T.sans};font-size:14px;line-height:1.4;color:${T.muted};">${escapeHtml(dateStr)}</div>`
    : "";

  return `
  <tr><td style="padding:0 0 28px 0;">
    <h1 style="font-family:${T.sans};font-size:28px;line-height:1.15;letter-spacing:-0.02em;font-weight:700;color:${T.fg};margin:0;word-break:break-word;">${title}</h1>
    ${dateHtml}
    ${addrHtml}
  </td></tr>`;
}

// ---------------------------------------------------------------------------
// Plain-text companion body
// ---------------------------------------------------------------------------

function plainSection(title: string, lines: string[]): string {
  const filled = lines.filter(Boolean);
  if (filled.length === 0) return "";
  return `${title.toUpperCase()}\n${filled.join("\n")}`;
}

function plainField(label: string, value: string | null | undefined): string {
  const v = val(value);
  if (!v) return "";
  return `${label}: ${v}`;
}

function renderPlainText(show: RenderShow, opts: RenderOptions): string {
  const parts: string[] = [];

  const header: string[] = [];
  header.push(artistVenueLine(show));
  const dateStr = formatFullDate(show.date);
  if (dateStr) header.push(dateStr);
  const addr = val(show.venue_address) ? stripCountry(show.venue_address!) : "";
  if (addr) header.push(addr);
  parts.push(header.join("\n"));

  const personal = val(opts.personalMessage);
  if (personal) {
    const prefix = opts.senderName ? `From ${opts.senderName}:\n` : "";
    parts.push(`${prefix}${personal}`);
  }

  if (hasData(show, "schedule") && show.schedule_entries?.length) {
    const sorted = [...show.schedule_entries].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    );
    const lines = sorted.map((e) => {
      const setInline = e.is_band && val(show.set_length) ? ` (${val(show.set_length)})` : "";
      return `${e.time ?? ""}  ${e.label ?? ""}${setInline}`.trim();
    });
    parts.push(plainSection("Schedule", lines));
  }

  if (hasData(show, "contact")) {
    parts.push(
      plainSection("Day of Show Contact", [
        plainField("Name", show.dos_contact_name),
        plainField("Phone", show.dos_contact_phone),
      ]),
    );
  }

  if (hasData(show, "departure")) {
    parts.push(
      plainSection("Departure", [
        plainField("Time", show.departure_time),
        plainField("Notes", show.departure_notes),
      ]),
    );
  }

  if (hasData(show, "loadIn") || hasData(show, "parking")) {
    parts.push(
      plainSection("Arrival", [
        plainField("Load In", show.load_in_details),
        plainField("Parking", show.parking_notes),
      ]),
    );
  }

  if (hasData(show, "greenRoom") || hasData(show, "wifi")) {
    const lines = [plainField("Green Room", show.green_room_info)];
    if (val(show.wifi_network)) lines.push(`WiFi Network: ${val(show.wifi_network)}`);
    if (val(show.wifi_password)) lines.push(`WiFi Password: ${val(show.wifi_password)}`);
    parts.push(plainSection("At The Venue", lines));
  }

  if (hasData(show, "hotel")) {
    parts.push(
      plainSection("Accommodations", [
        plainField("Name", show.hotel_name),
        plainField("Address", show.hotel_address),
        plainField("Confirmation #", show.hotel_confirmation),
        plainField("Check In", show.hotel_checkin),
        plainField("Check Out", show.hotel_checkout),
      ]),
    );
  }

  const guestNames = formatGuestListText(show.guest_list_details);
  if (guestNames.length > 0) {
    parts.push(plainSection("Guest List", guestNames));
  }

  if (val(show.additional_info)) {
    parts.push(plainSection("Notes", [val(show.additional_info)!]));
  }

  return parts.filter(Boolean).join("\n\n");
}

// ---------------------------------------------------------------------------
// Top-level render
// ---------------------------------------------------------------------------

export function buildSubject(show: RenderShow): string {
  const dateStr = formatFullDate(show.date);
  const venue = val(show.venue_name) ?? "Show";
  const city = formatCityState(show.city);
  const cityPart = city ? ` (${city})` : "";
  const datePart = dateStr ? `${dateStr} - ` : "";
  return `${datePart}${venue}${cityPart} - Day Sheet`;
}

export function renderDaysheetEmail(show: RenderShow, opts: RenderOptions = {}): RenderedEmail {
  const blocks: string[] = [];
  blocks.push(renderHeader(show));
  blocks.push(renderPersonalMessage(opts.personalMessage, opts.senderName));

  // Order mirrors DaysheetGuestView: Schedule, Contact, Departure, Arrival,
  // At The Venue, Accommodations, Guest List, Notes.
  if (hasData(show, "schedule")) blocks.push(renderSchedule(show));
  if (hasData(show, "contact")) blocks.push(renderContact(show));
  if (hasData(show, "departure")) blocks.push(renderDeparture(show));
  if (hasData(show, "loadIn") || hasData(show, "parking")) blocks.push(renderArrival(show));
  if (hasData(show, "greenRoom") || hasData(show, "wifi")) blocks.push(renderAtVenue(show));
  if (hasData(show, "hotel")) blocks.push(renderHotel(show));
  if (formatGuestListText(show.guest_list_details).length > 0) blocks.push(renderGuestList(show));
  if (val(show.additional_info)) blocks.push(renderNotes(show));

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light" />
<title>${escapeHtml(buildSubject(show))}</title>
</head>
<body style="margin:0;padding:0;background:${T.pageBg};color:${T.fg};-webkit-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${T.pageBg};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
      ${blocks.join("")}
    </table>
  </td></tr>
</table>
</body>
</html>`;

  return {
    subject: buildSubject(show),
    html,
    text: renderPlainText(show, opts),
  };
}

// Exposed for the entry point to decide whether a section key should carry over
// for telemetry / debugging — not used by the renderer itself.
export const SECTION_ORDER: SectionKey[] = [
  "schedule",
  "contact",
  "departure",
  "loadIn",
  "parking",
  "greenRoom",
  "wifi",
  "hotel",
  "guestList",
];
