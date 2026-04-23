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
  type ShowContactLike,
  type SectionKey,
} from "./sections.ts";

// Keep in sync with `src/lib/contactRoles.ts` (Deno can't import from src/).
const ROLE_LABELS_EDGE: Record<string, string> = {
  day_of_show: "Day of Show",
  promoter: "Promoter",
  production: "Production",
  hospitality: "Hospitality",
  custom: "Contact",
};

function roleLabelEdge(c: Pick<ShowContactLike, "role" | "role_label">): string {
  if (c.role === "custom") {
    const label = c.role_label?.trim();
    return label || "Contact";
  }
  return ROLE_LABELS_EDGE[c.role] ?? "Contact";
}

// ---------------------------------------------------------------------------
// Theme (flattened from src/index.css light-mode tokens)
// ---------------------------------------------------------------------------

const T = {
  pageBg: "#f8f6f0",
  cardBg: "#fbfaf5",
  fg: "#211d17",
  muted: "#8a7e6b",
  border: "#e8e0d3",
  rule: "#211d17",
  rowRule: "#ede5d4",
  bandFg: "#346538",
  bandBg: "#edf3ec",
  hotelDashed: "#b8ab92",
  hotelDashedInner: "#e0d6bf",
  footerRule: "#e8e0d3",
  logoBg: "#221f1c",
  logoFg: "#f9f7f4",
  link: "#1f6c9f",
  sans: `'DM Sans', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif`,
  serif: `'DM Serif Display', 'Bodoni 72', Didot, 'Playfair Display', Georgia, 'Times New Roman', serif`,
  mono: `'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`,
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

interface GuestEntry {
  name: string;
  plus: number;
}

function parseGuestListEntries(raw: string | null | undefined): GuestEntry[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((entry: unknown): GuestEntry | null => {
          if (!entry || typeof entry !== "object") return null;
          const e = entry as Record<string, unknown>;
          const name = String(e.name ?? e.Name ?? "").trim();
          const plusRaw = e.plusOnes ?? e.plus_ones ?? e.plusOne ?? 0;
          const plus = typeof plusRaw === "number" ? plusRaw : parseInt(String(plusRaw), 10) || 0;
          if (!name) return null;
          return { name, plus };
        })
        .filter((entry): entry is GuestEntry => entry !== null);
    }
  } catch {
    // not JSON — fall through
  }
  return raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((name) => ({ name, plus: 0 }));
}

function formatGuestListText(raw: string | null | undefined): string[] {
  return parseGuestListEntries(raw).map((entry) =>
    entry.plus > 0 ? `${entry.name} +${entry.plus}` : entry.name,
  );
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

function section(title: string, innerHtml: string): string {
  return `
  <tr><td style="padding:0 0 36px 0;">
    <div style="font-family:${T.sans};font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${T.muted};font-weight:500;padding-bottom:10px;border-bottom:1px solid ${T.rule};">${escapeHtml(title)}</div>
    ${innerHtml}
  </td></tr>`;
}

interface FieldSpec {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  href?: string;
}

function renderFieldRow(spec: FieldSpec, isFirst: boolean, isLast: boolean): string {
  const v = val(spec.value);
  if (!v) return "";
  const valueFont = spec.mono ? T.mono : T.sans;
  const valueSize = spec.mono ? "13px" : "14px";
  const body = nl2br(v);
  const content = spec.href
    ? `<a href="${escapeHtml(spec.href)}" style="color:${T.fg};text-decoration:underline;text-underline-offset:3px;">${body}</a>`
    : body;
  const padTop = isFirst ? "12px" : "10px";
  const padBottom = isLast ? "0" : "10px";
  return `
    <tr>
      <td valign="top" style="font-family:${T.sans};font-size:12px;line-height:1.5;color:${T.muted};padding:${padTop} 16px ${padBottom} 0;vertical-align:top;">${escapeHtml(spec.label)}</td>
      <td valign="top" style="font-family:${valueFont};font-size:${valueSize};line-height:1.6;color:${T.fg};padding:${padTop} 0 ${padBottom} 0;vertical-align:top;white-space:pre-wrap;word-break:break-word;">${content}</td>
    </tr>`;
}

function fieldTable(specs: FieldSpec[]): string {
  const live = specs.filter((s) => !!val(s.value));
  if (live.length === 0) return "";
  const rows = live
    .map((s, i) => renderFieldRow(s, i === 0, i === live.length - 1))
    .join("");
  // table-layout:fixed + <colgroup> locks the label column width across all
  // rows so Gmail's auto-layout doesn't collapse labels next to long values.
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;border-collapse:collapse;">
    <colgroup><col style="width:100px;" /><col /></colgroup>
    ${rows}
  </table>`;
}

function findScheduleMatch(show: RenderShow, pattern: RegExp): string | null {
  const entries = show.schedule_entries ?? [];
  const hit = entries.find((e) => pattern.test((e.label ?? "").trim().toLowerCase()));
  return hit && val(hit.time) ? val(hit.time) : null;
}

function findBandTime(show: RenderShow): string | null {
  const entries = show.schedule_entries ?? [];
  const hit = entries.find((e) => e.is_band === true);
  return hit && val(hit.time) ? val(hit.time) : null;
}

function renderKeyMoments(show: RenderShow): string {
  const loadIn = findScheduleMatch(show, /^load[\s-]?in\b/);
  const doors = findScheduleMatch(show, /^doors?\b/);
  const setTime = findBandTime(show);

  interface Moment {
    label: string;
    value: string;
    accent: boolean;
  }
  const moments: Moment[] = [];
  if (loadIn) moments.push({ label: "Load in", value: loadIn, accent: false });
  if (doors) moments.push({ label: "Doors", value: doors, accent: false });
  if (setTime) moments.push({ label: "Set", value: setTime, accent: true });
  if (moments.length === 0) return "";

  const colWidth = `${Math.floor(100 / moments.length)}%`;
  const tds = moments
    .map((m) => {
      const labelColor = m.accent ? T.bandFg : T.muted;
      const valueColor = m.accent ? T.bandFg : T.fg;
      const weight = m.accent ? "500" : "400";
      return `
        <td style="padding:14px 0;vertical-align:top;width:${colWidth};">
          <div style="font-family:${T.mono};font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:${labelColor};">${escapeHtml(m.label)}</div>
          <div style="font-family:${T.mono};font-size:16px;color:${valueColor};font-weight:${weight};margin-top:4px;">${escapeHtml(m.value)}</div>
        </td>`;
    })
    .join("");

  return `
  <tr><td style="padding:0 0 20px 0;border-top:1px solid ${T.rule};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tbody><tr>${tds}</tr></tbody>
    </table>
  </td></tr>`;
}

function renderFooter(): string {
  return `
  <tr><td style="padding:24px 0 0 0;border-top:1px solid ${T.footerRule};">
    <a href="https://advancetouring.com" style="text-decoration:none;color:inherit;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;"><tbody><tr>
        <td style="vertical-align:middle;padding-right:10px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;"><tbody><tr>
            <td width="20" height="20" align="center" valign="middle" style="background:${T.logoBg};border-radius:4px;font-family:Georgia, 'Times New Roman', serif;color:${T.logoFg};font-size:14px;line-height:20px;">A</td>
          </tr></tbody></table>
        </td>
        <td style="vertical-align:middle;">
          <div style="font-family:${T.serif};font-size:14px;color:${T.fg};letter-spacing:-0.02em;">Advance</div>
        </td>
      </tr></tbody></table>
    </a>
    <a href="https://advancetouring.com" style="display:inline-block;margin-top:12px;text-decoration:none;">
      <div style="font-family:${T.sans};font-size:11px;line-height:1.5;color:${T.muted};">Sent via Advance · Tour management for musicians</div>
    </a>
  </td></tr>`;
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
      const border = isLast ? "0" : `1px solid ${T.rowRule}`;
      const timeColor = isBand ? T.bandFg : T.muted;
      const timeWeight = isBand ? "500" : "400";
      const labelStyle = isBand
        ? `color:${T.bandFg};font-weight:600;`
        : `color:${T.fg};font-weight:400;`;
      return `
      <tr>
        <td style="font-family:${T.mono};font-size:13px;line-height:1.5;color:${timeColor};font-weight:${timeWeight};padding:10px 16px 10px 0;vertical-align:top;white-space:nowrap;border-bottom:${border};width:80px;">${time}</td>
        <td style="font-family:${T.sans};font-size:14px;line-height:1.5;padding:10px 0;vertical-align:top;border-bottom:${border};${labelStyle}">${label}${setInline}</td>
      </tr>`;
    })
    .join("");

  return section(
    "Schedule",
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`,
  );
}

function renderContact(show: RenderShow): string {
  const contacts = [...(show.show_contacts ?? [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );
  if (contacts.length === 0) return "";
  const dos = contacts.find((c) => c.role === "day_of_show");
  const others = contacts.filter((c) => c !== dos);

  let out = "";
  if (dos) {
    out += section(
      "Day of Show Contact",
      fieldTable([
        { label: "Name", value: dos.name },
        { label: "Phone", value: dos.phone, mono: true },
        { label: "Email", value: dos.email, mono: true },
      ]),
    );
  }
  if (others.length > 0) {
    const blocks = others
      .map((c) => {
        const table = fieldTable([
          { label: "Name", value: c.name },
          { label: "Phone", value: c.phone, mono: true },
          { label: "Email", value: c.email, mono: true },
          { label: "Notes", value: c.notes },
        ]);
        if (!table) return "";
        return `
          <div style="padding:12px 0;">
            <div style="font-family:${T.sans};font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:${T.muted};padding-bottom:6px;">${escapeHtml(roleLabelEdge(c))}</div>
            ${table}
          </div>`;
      })
      .filter(Boolean)
      .join("");
    if (blocks) {
      out += section(dos ? "Other Contacts" : "Contacts", blocks);
    }
  }
  return out;
}

function renderDeparture(show: RenderShow): string {
  return section(
    "Departure",
    fieldTable([
      { label: "Time", value: show.departure_time, mono: true },
      { label: "Notes", value: show.departure_notes },
    ]),
  );
}

function renderArrival(show: RenderShow): string {
  return section(
    "Arrival",
    fieldTable([
      { label: "Load In", value: hasData(show, "loadIn") ? show.load_in_details : null },
      { label: "Parking", value: hasData(show, "parking") ? show.parking_notes : null },
    ]),
  );
}

function renderAtVenue(show: RenderShow): string {
  const specs: FieldSpec[] = [];
  if (hasData(show, "greenRoom")) {
    specs.push({ label: "Green Room", value: show.green_room_info });
  }
  if (hasData(show, "wifi")) {
    const network = val(show.wifi_network);
    const password = val(show.wifi_password);
    const wifiValue = [network, password].filter(Boolean).join("\n");
    specs.push({ label: "WiFi", value: wifiValue, mono: true });
  }
  return section("At The Venue", fieldTable(specs));
}

function renderHotel(show: RenderShow): string {
  const name = val(show.hotel_name);
  const addr = val(show.hotel_address);
  const addrStripped = addr ? stripCountry(addr) : "";
  const mapUrl = addrStripped
    ? `https://maps.google.com/?q=${encodeURIComponent(addrStripped)}`
    : "";
  const confirmation = val(show.hotel_confirmation);
  const checkIn = val(show.hotel_checkin);
  const checkOut = val(show.hotel_checkout);

  const nameHtml = name
    ? `<div style="font-family:${T.serif};font-size:22px;letter-spacing:-0.02em;color:${T.fg};line-height:1.15;">${escapeHtml(name)}</div>`
    : "";
  const addrHtml = addrStripped
    ? `<div style="margin-top:${name ? "6px" : "0"};"><a href="${escapeHtml(mapUrl)}" style="font-family:${T.mono};font-size:12px;color:${T.muted};text-decoration:underline;text-underline-offset:3px;">${escapeHtml(addrStripped)}</a></div>`
    : "";
  const headerCell = nameHtml || addrHtml
    ? `<tr><td style="padding:16px 18px 12px 18px;">${nameHtml}${addrHtml}</td></tr>`
    : "";

  interface HotelCell {
    caption: string;
    value: string;
  }
  const cells: HotelCell[] = [];
  if (confirmation) cells.push({ caption: "Confirmation #", value: confirmation });
  if (checkIn) cells.push({ caption: "Check In", value: checkIn });
  if (checkOut) cells.push({ caption: "Check Out", value: checkOut });

  let gridRow = "";
  if (cells.length > 0) {
    const colWidth = `${Math.floor(100 / cells.length)}%`;
    const tds = cells
      .map((c, i) => {
        const isFirst = i === 0;
        const isLast = i === cells.length - 1;
        const padLeft = isFirst ? "0" : "10px";
        const padRight = isLast ? "0" : "10px";
        return `
          <td style="padding:12px ${padRight} 0 ${padLeft};width:${colWidth};vertical-align:top;">
            <div style="font-family:${T.mono};font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:${T.muted};">${escapeHtml(c.caption)}</div>
            <div style="font-family:${T.mono};font-size:13px;color:${T.fg};margin-top:4px;">${escapeHtml(c.value)}</div>
          </td>`;
      })
      .join("");
    gridRow = `
      <tr><td style="padding:0 18px 16px 18px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px dashed ${T.hotelDashedInner};">
          <tbody><tr>${tds}</tr></tbody>
        </table>
      </td></tr>`;
  }

  if (!headerCell && !gridRow) return "";

  const cardHtml = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border:1px dashed ${T.hotelDashed};">
      <tbody>${headerCell}${gridRow}</tbody>
    </table>`;

  return section("Accommodations", cardHtml);
}

function renderGuestList(show: RenderShow): string {
  const entries = parseGuestListEntries(show.guest_list_details);
  if (entries.length === 0) return "";
  const rows = entries
    .map((entry, i) => {
      const isLast = i === entries.length - 1;
      const border = isLast ? "0" : `1px solid ${T.rowRule}`;
      const plusText = entry.plus > 0 ? `+${entry.plus}` : "—";
      return `
        <tr>
          <td style="font-family:${T.sans};font-size:14px;line-height:1.5;color:${T.fg};padding:10px 0;border-bottom:${border};">${escapeHtml(entry.name)}</td>
          <td style="font-family:${T.mono};font-size:12px;color:${T.muted};padding:10px 0;text-align:right;border-bottom:${border};">${escapeHtml(plusText)}</td>
        </tr>`;
    })
    .join("");
  return section(
    "Guest List",
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`,
  );
}

function renderNotes(show: RenderShow): string {
  const notes = val(show.additional_info);
  if (!notes) return "";
  const body = `<div style="padding-top:12px;font-family:${T.sans};font-size:14px;line-height:1.6;color:${T.fg};white-space:pre-wrap;word-break:break-word;">${nl2br(notes)}</div>`;
  return section("Notes", body);
}

function renderPersonalMessage(
  message: string | null | undefined,
  senderName: string | null | undefined,
): string {
  const msg = val(message);
  if (!msg) return "";
  const sender = val(senderName);
  const signature = sender
    ? `<div style="margin-top:10px;font-family:${T.sans};font-size:12px;color:${T.muted};">— ${escapeHtml(sender)}</div>`
    : "";
  return `
  <tr><td style="padding:0 0 36px 0;">
    <div style="font-family:${T.sans};font-size:15px;line-height:1.55;color:${T.fg};white-space:pre-wrap;word-break:break-word;">${nl2br(msg)}</div>
    ${signature}
  </td></tr>`;
}

function renderHeader(show: RenderShow): string {
  const venue = val(show.venue_name);
  const artist = val(show.artist_name);
  const title = escapeHtml(venue ?? artist ?? "Day Sheet");
  const dateStr = formatFullDate(show.date);
  const city = formatCityState(show.city);
  const doors = findScheduleMatch(show, /^doors?\b/);
  const addr = val(show.venue_address) ? stripCountry(show.venue_address!) : "";

  const subParts = [
    dateStr,
    city,
    doors ? `Doors ${doors}` : "",
  ].filter(Boolean);
  const subHtml = subParts.length
    ? `<div style="font-family:${T.sans};font-size:14px;line-height:1.5;color:${T.muted};">${escapeHtml(subParts.join(" · "))}</div>`
    : "";

  const addrHtml = addr
    ? `<div style="margin-top:${subHtml ? "4px" : "0"};"><a href="https://maps.google.com/?q=${encodeURIComponent(addr)}" style="font-family:${T.mono};font-size:12px;color:${T.muted};text-decoration:underline;text-underline-offset:3px;">${escapeHtml(addr)}</a></div>`
    : "";

  const subRow = subHtml || addrHtml
    ? `<tr><td style="padding:0 0 32px 0;">${subHtml}${addrHtml}</td></tr>`
    : "";

  return `
  <tr><td style="padding:0 0 12px 0;">
    <h1 style="font-family:${T.serif};font-size:40px;line-height:1.0;letter-spacing:-0.035em;font-weight:400;color:${T.fg};margin:0;word-break:break-word;">${title}</h1>
  </td></tr>
  ${subRow}`;
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
    parts.push(personal);
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
    const contacts = [...(show.show_contacts ?? [])].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    );
    const dos = contacts.find((c) => c.role === "day_of_show");
    const others = contacts.filter((c) => c !== dos);
    if (dos) {
      parts.push(
        plainSection("Day of Show Contact", [
          plainField("Name", dos.name),
          plainField("Phone", dos.phone),
          plainField("Email", dos.email),
        ]),
      );
    }
    if (others.length > 0) {
      const lines: string[] = [];
      for (const c of others) {
        lines.push(roleLabelEdge(c).toUpperCase());
        lines.push(plainField("Name", c.name));
        lines.push(plainField("Phone", c.phone));
        lines.push(plainField("Email", c.email));
        if (val(c.notes)) lines.push(plainField("Notes", c.notes));
        lines.push("");
      }
      parts.push(plainSection(dos ? "Other Contacts" : "Contacts", lines));
    }
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
  blocks.push(renderKeyMoments(show));

  // Order mirrors DaysheetGuestView: Schedule, Contact, Departure, Arrival,
  // At The Venue, Accommodations, Guest List, Notes.
  if (hasData(show, "schedule")) blocks.push(renderSchedule(show));
  if (hasData(show, "contact")) blocks.push(renderContact(show));
  if (hasData(show, "departure")) blocks.push(renderDeparture(show));
  if (hasData(show, "loadIn") || hasData(show, "parking")) blocks.push(renderArrival(show));
  if (hasData(show, "greenRoom") || hasData(show, "wifi")) blocks.push(renderAtVenue(show));
  if (hasData(show, "hotel")) blocks.push(renderHotel(show));
  if (parseGuestListEntries(show.guest_list_details).length > 0) blocks.push(renderGuestList(show));
  if (val(show.additional_info)) blocks.push(renderNotes(show));
  blocks.push(renderFooter());

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light" />
<title>${escapeHtml(buildSubject(show))}</title>
<!-- DM Sans (body) + DM Serif Display (venue hero + hotel name) + JetBrains Mono
     (times / phones / confirmation #s). Apple Mail and iOS honor these; Gmail
     web strips the sheet and falls back to system sans, which still reads clean. -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&family=JetBrains+Mono:wght@400;500&display=swap"
  rel="stylesheet"
/>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&family=JetBrains+Mono:wght@400;500&display=swap');
</style>
</head>
<body style="margin:0;padding:0;background:${T.pageBg};color:${T.fg};-webkit-text-size-adjust:100%;font-family:${T.sans};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${T.pageBg};">
  <tr><td align="center" style="padding:32px 20px;">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
      <tbody>
        ${blocks.join("")}
      </tbody>
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
