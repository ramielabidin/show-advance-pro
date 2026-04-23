// HTML + plain-text renderer for the team-invite email.
//
// Visual target: `supabase/functions/send-team-invite-email/preview.html`,
// itself adapted from design handoff variant C · Dispatch.
// Light theme only.
//
// Pure string rendering — no DOM, no React — so this module is importable
// from both the Deno edge-function runtime and the Vitest/Node test runner
// without a transform layer. Same pattern as send-daysheet-email/template.ts.

// ---------------------------------------------------------------------------
// Theme — kept in sync with preview.html.
// ---------------------------------------------------------------------------

const T = {
  pageBg: "#f9f7f4",
  fg: "#1f1d1a",
  body: "#2a2824",
  muted: "#8b8375",
  border: "#e5dfd2",
  rule: "#1f1d1a",
  ctaBg: "#1f1d1a",
  ctaFg: "#f9f7f4",
  logoBg: "#221F1C",
  logoFg: "#F9F7F4",
  sans: `'DM Sans', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif`,
  serif: `'DM Serif Display', Georgia, 'Times New Roman', serif`,
  mono: `'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`,
};

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface InviteParams {
  inviterName: string;
  inviterEmail: string;
  teamName: string;
  roleLabel: string;
  acceptUrl: string;
  inviteCode?: string | null;
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

export function firstName(full: string): string {
  const first = full.trim().split(/\s+/)[0];
  return first || "someone";
}

// ---------------------------------------------------------------------------
// HTML building blocks
// ---------------------------------------------------------------------------

function renderWordmark(): string {
  return `
    <tr><td class="pad" style="padding:0 0 36px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td valign="middle" style="padding-right:10px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td width="24" height="24" align="center" valign="middle" class="serif" style="background:${T.logoBg};color:${T.logoFg};font-family:${T.serif};font-size:15px;border-radius:5px;width:24px;height:24px;line-height:24px;">A</td>
          </tr></table>
        </td>
        <td valign="middle" class="serif" style="font-family:${T.serif};font-size:18px;letter-spacing:-0.02em;color:${T.fg};">Advance</td>
      </tr></table>
    </td></tr>`;
}

function renderSlug(inviterFirstName: string): string {
  return `
    <tr><td class="pad" style="padding:0 0 10px 0;">
      <div class="mono" style="font-family:${T.mono};font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${T.muted};">
        &mdash; &mdash; &mdash; Dispatch from ${escapeHtml(inviterFirstName)} &mdash; &mdash; &mdash;
      </div>
    </td></tr>`;
}

function renderHero(): string {
  return `
    <tr><td class="pad" style="padding:0 0 4px 0;">
      <h1 class="serif hero" style="margin:0;font-family:${T.serif};font-size:54px;line-height:1;letter-spacing:-0.035em;color:${T.fg};font-weight:400;">
        You&rsquo;ve been<br>added to<br>the crew.
      </h1>
    </td></tr>
    <tr><td class="pad" style="padding:28px 0 0 0;">
      <div style="width:28px;height:2px;background:${T.rule};line-height:2px;font-size:0;">&nbsp;</div>
    </td></tr>`;
}

function renderBody(inviterName: string): string {
  const nameHtml = `<strong style="font-weight:600;">${escapeHtml(inviterName)}</strong>`;
  return `
    <tr><td class="pad" style="padding:22px 0 0 0;">
      <p class="sans" style="margin:0 0 14px 0;font-family:${T.sans};font-size:16px;line-height:1.6;color:${T.body};">
        ${nameHtml} added you to their team on Advance &mdash; the quiet little tool tour managers use to send day sheets and keep shows straight.
      </p>
      <p class="sans" style="margin:0;font-family:${T.sans};font-size:16px;line-height:1.6;color:${T.body};">
        Set up your account and you&rsquo;ll show up on the team.
      </p>
    </td></tr>`;
}

interface DataRow {
  label: string;
  valueHtml: string;
}

function renderDataRow(row: DataRow, isFirst: boolean): string {
  const topBorder = isFirst ? "" : `border-top:1px solid ${T.border};`;
  return `
    <tr>
      <td width="38%" valign="top" style="padding:14px 10px 14px 0;${topBorder}">
        <div class="mono" style="font-family:${T.mono};font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:${T.muted};">${escapeHtml(row.label)}</div>
      </td>
      <td valign="top" style="padding:14px 0 14px 0;${topBorder}">
        <div class="sans" style="font-family:${T.sans};font-size:14px;color:${T.fg};">${row.valueHtml}</div>
      </td>
    </tr>`;
}

function renderDataTable(p: InviteParams): string {
  const invitedByHtml = `${escapeHtml(p.inviterName)} &middot; <span class="mono" style="font-family:${T.mono};font-size:13px;color:${T.body};">${escapeHtml(p.inviterEmail)}</span>`;
  const rows: DataRow[] = [
    { label: "Team", valueHtml: escapeHtml(p.teamName) },
    { label: "Invited by", valueHtml: invitedByHtml },
    { label: "Your role", valueHtml: escapeHtml(p.roleLabel) },
  ];
  const rowsHtml = rows.map((r, i) => renderDataRow(r, i === 0)).join("");
  return `
    <tr><td class="pad" style="padding:30px 0 0 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${T.rule};border-bottom:1px solid ${T.rule};">
        ${rowsHtml}
      </table>
    </td></tr>`;
}

function renderCta(acceptUrl: string): string {
  const safeUrl = escapeHtml(acceptUrl);
  return `
    <tr><td class="pad" align="left" style="padding:32px 0 0 0;">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${safeUrl}" style="height:50px;v-text-anchor:middle;width:230px;" arcsize="34%" strokecolor="${T.ctaBg}" fillcolor="${T.ctaBg}">
        <w:anchorlock/><center style="color:${T.ctaFg};font-family:sans-serif;font-size:15px;font-weight:500;">Sign in or create account &rarr;</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-- -->
      <a href="${safeUrl}" class="sans" style="display:inline-block;background:${T.ctaBg};color:${T.ctaFg};font-family:${T.sans};font-size:15px;font-weight:500;line-height:1;text-decoration:none;padding:17px 28px;border-radius:26px;">Sign in or create account&nbsp;&rarr;</a>
      <!--<![endif]-->
    </td></tr>`;
}

function renderSignOff(inviteCode: string | null | undefined): string {
  const code = (inviteCode ?? "").trim();
  const tagline = code
    ? `&mdash; Advance &middot; advancetouring.com/invite/${escapeHtml(code)}`
    : `&mdash; Advance &middot; advancetouring.com`;
  return `
    <tr><td class="pad" style="padding:40px 0 0 0;">
      <div class="mono" style="font-family:${T.mono};font-size:11px;color:${T.muted};line-height:1.6;">
        ${tagline}<br>
        &mdash; Not expecting this? Ignore; nothing happens.
      </div>
    </td></tr>`;
}

// ---------------------------------------------------------------------------
// Plain-text companion
// ---------------------------------------------------------------------------

function renderPlainText(p: InviteParams): string {
  const lines: string[] = [];
  lines.push(`${p.inviterName} added you to ${p.teamName} on Advance.`);
  lines.push("");
  lines.push(
    "Advance is the quiet little tool tour managers use to send day sheets and keep shows straight. Set up your account and you'll show up on the team.",
  );
  lines.push("");
  lines.push(`Sign in or create account: ${p.acceptUrl}`);
  lines.push("");
  lines.push(`— TEAM:       ${p.teamName}`);
  lines.push(`— INVITED BY: ${p.inviterName} · ${p.inviterEmail}`);
  lines.push(`— YOUR ROLE:  ${p.roleLabel}`);
  lines.push("");
  const code = (p.inviteCode ?? "").trim();
  lines.push(code ? `— Advance · advancetouring.com/invite/${code}` : `— Advance · advancetouring.com`);
  lines.push("— Not expecting this? Ignore; nothing happens.");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Top-level render
// ---------------------------------------------------------------------------

export function buildSubject(p: InviteParams): string {
  return `${p.inviterName} added you to ${p.teamName} on Advance`;
}

export function renderInviteEmail(p: InviteParams): RenderedEmail {
  const subject = buildSubject(p);
  const preheader = `${p.inviterName} added you to ${p.teamName} on Advance.`;
  const inviterFirstName = firstName(p.inviterName);

  const blocks = [
    renderWordmark(),
    renderSlug(inviterFirstName),
    renderHero(),
    renderBody(p.inviterName),
    renderDataTable(p),
    renderCta(p.acceptUrl),
    renderSignOff(p.inviteCode),
  ].join("");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(subject)}</title>
<style>
  @import url("https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Serif+Display&family=JetBrains+Mono:wght@400;500;600&display=swap");
  body { margin:0; padding:0; background:${T.pageBg}; }
  .sans  { font-family:${T.sans}; }
  .serif { font-family:${T.serif}; }
  .mono  { font-family:${T.mono}; }
  @media (max-width:620px){
    .shell { width:100% !important; }
    .pad   { padding-left:26px !important; padding-right:26px !important; }
    .hero  { font-size:42px !important; }
  }
</style>
</head>
<body class="sans" style="margin:0;padding:0;background:${T.pageBg};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    ${escapeHtml(preheader)}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${T.pageBg};">
    <tr><td align="center" style="padding:48px 16px 64px 16px;">

      <table role="presentation" class="shell" width="520" cellpadding="0" cellspacing="0" border="0" style="width:520px;max-width:520px;">
        ${blocks}
      </table>

    </td></tr>
  </table>
</body>
</html>`;

  return {
    subject,
    html,
    text: renderPlainText(p),
  };
}
