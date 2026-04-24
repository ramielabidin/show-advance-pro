// Server-rendered HTML for /guest/:token so iMessage / Slack / Discord etc.
// see a per-link preview instead of the generic site-wide OG tags.
//
// Real users get the same SPA they would have anyway — we just rewrite the
// meta tags inside index.html before returning it.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

const DEFAULT_TITLE = "Advance — Tour Management";
const DEFAULT_DESCRIPTION =
  "Tour management and show advancing for independent musicians";

interface GuestShowPreview {
  link_type: "daysheet" | "guestlist";
  artist_name: string | null;
  date: string | null;
  venue_name: string | null;
  city: string | null;
}

interface VercelLikeReq {
  url?: string;
  query?: Record<string, string | string[] | undefined>;
  headers: Record<string, string | string[] | undefined>;
}

interface VercelLikeRes {
  status: (code: number) => VercelLikeRes;
  setHeader: (name: string, value: string) => void;
  send: (body: string) => void;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}

function formatLongDate(iso: string | null): string | null {
  if (!iso) return null;
  // Show dates are date-only strings (YYYY-MM-DD); pin to UTC noon to avoid
  // off-by-one in JS Date parsing.
  const d = new Date(iso + "T12:00:00Z");
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

async function fetchPreview(token: string): Promise<GuestShowPreview | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_guest_show`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_token: token }),
    });
    if (!r.ok) return null;
    const data = (await r.json()) as GuestShowPreview | null;
    if (!data) return null;
    return {
      link_type: data.link_type,
      artist_name: data.artist_name ?? null,
      date: data.date ?? null,
      venue_name: data.venue_name ?? null,
      city: data.city ?? null,
    };
  } catch {
    return null;
  }
}

async function fetchIndexHtml(host: string): Promise<string | null> {
  // Vercel sets VERCEL_URL to the deployment host (no scheme). Locally
  // (`vercel dev`) we fall back to the request's host header.
  const proto = host.includes("localhost") ? "http" : "https";
  try {
    const r = await fetch(`${proto}://${host}/index.html`, {
      headers: { "User-Agent": "guest-preview-ssr" },
    });
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  }
}

function buildMeta(opts: {
  title: string;
  description: string;
  url: string;
  imageUrl: string | null;
}): string {
  const { title, description, url, imageUrl } = opts;
  const lines = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeAttr(description)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:url" content="${escapeAttr(url)}" />`,
    `<meta property="og:title" content="${escapeAttr(title)}" />`,
    `<meta property="og:description" content="${escapeAttr(description)}" />`,
    `<meta name="twitter:card" content="${imageUrl ? "summary_large_image" : "summary"}" />`,
    `<meta name="twitter:title" content="${escapeAttr(title)}" />`,
    `<meta name="twitter:description" content="${escapeAttr(description)}" />`,
  ];
  if (imageUrl) {
    lines.push(
      `<meta property="og:image" content="${escapeAttr(imageUrl)}" />`,
      `<meta property="og:image:width" content="1200" />`,
      `<meta property="og:image:height" content="630" />`,
      `<meta name="twitter:image" content="${escapeAttr(imageUrl)}" />`,
    );
  }
  return lines.join("\n    ");
}

// Replace the contiguous block of head metadata that index.html ships with
// (everything from <title> through the last twitter:* tag).
function injectMeta(html: string, metaBlock: string): string {
  // Strip the existing tags individually; safer than range-replace if the
  // template changes shape.
  let out = html;
  const stripPatterns = [
    /<title>[\s\S]*?<\/title>\s*/i,
    /<meta\s+name="description"[^>]*>\s*/gi,
    /<meta\s+property="og:[^"]+"[^>]*>\s*/gi,
    /<meta\s+name="twitter:[^"]+"[^>]*>\s*/gi,
  ];
  for (const re of stripPatterns) {
    out = out.replace(re, "");
  }
  // Insert the new block right after the viewport meta so it sits at the top
  // of <head>, where crawlers expect it.
  return out.replace(
    /(<meta\s+name="viewport"[^>]*>)/i,
    `$1\n    ${metaBlock}`,
  );
}

export default async function handler(
  req: VercelLikeReq,
  res: VercelLikeRes,
): Promise<void> {
  const tokenParam = req.query?.token;
  const token =
    typeof tokenParam === "string"
      ? tokenParam
      : Array.isArray(tokenParam)
        ? tokenParam[0]
        : "";

  const hostHeader = req.headers["host"];
  const host =
    process.env.VERCEL_URL ||
    (typeof hostHeader === "string" ? hostHeader : "") ||
    "app.advancetouring.com";

  // The browser-visible URL is /guest/:token (rewrite preserves it).
  const publicHost =
    typeof hostHeader === "string" && hostHeader
      ? hostHeader
      : "app.advancetouring.com";
  const publicUrl = `https://${publicHost}/guest/${token}`;

  const indexHtmlPromise = fetchIndexHtml(host);
  const previewPromise = token ? fetchPreview(token) : Promise.resolve(null);

  const [indexHtml, preview] = await Promise.all([
    indexHtmlPromise,
    previewPromise,
  ]);

  // If we couldn't read index.html, redirect to the SPA path so the user still
  // gets the app — they'll just see the default OG tags.
  if (!indexHtml) {
    res.status(302);
    res.setHeader("Location", `/guest/${token}`);
    res.setHeader("Cache-Control", "no-store");
    res.send("");
    return;
  }

  let title = DEFAULT_TITLE;
  let description = DEFAULT_DESCRIPTION;
  let imageUrl: string | null = null;

  if (preview) {
    const eyebrow = preview.link_type === "guestlist" ? "Guest list" : "Day sheet";
    const artist = preview.artist_name?.trim() || "Untitled show";
    const venue = preview.venue_name?.trim() || "";
    const city = preview.city?.trim() || "";
    const dateLine = formatLongDate(preview.date);

    title = venue
      ? `${eyebrow} — ${artist} at ${venue}`
      : `${eyebrow} — ${artist}`;

    const descBits: string[] = [];
    if (dateLine) descBits.push(dateLine);
    if (city) descBits.push(city);
    descBits.push("Powered by Advance");
    description = descBits.join(" · ");

    const ogParams = new URLSearchParams({
      type: preview.link_type,
      artist,
    });
    if (venue) ogParams.set("venue", venue);
    if (city) ogParams.set("city", city);
    if (preview.date) ogParams.set("date", preview.date);
    imageUrl = `https://${publicHost}/api/og-image?${ogParams.toString()}`;
  }

  const metaBlock = buildMeta({ title, description, url: publicUrl, imageUrl });
  const html = injectMeta(indexHtml, metaBlock);

  res.status(200);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  // Edge-cache previews briefly so repeated bot fetches and refreshes don't
  // re-hit Supabase. Revoking a link will be visible within a minute.
  res.setHeader(
    "Cache-Control",
    preview
      ? "public, max-age=0, s-maxage=60, stale-while-revalidate=300"
      : "public, max-age=0, s-maxage=10",
  );
  res.send(html);
}
