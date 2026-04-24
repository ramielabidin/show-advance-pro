// Dynamic OG image for /guest/:token previews. Runs at the edge and
// renders a brand-styled 1200×630 PNG from the show metadata passed in
// the query string. Called by api/guest-preview.ts (which injects the
// URL into og:image) and by crawlers fetching the image directly.
//
// NOTE: intentionally no JSX — we use React.createElement via the `h`
// alias so the file stays a plain .ts with no JSX config needed outside
// tsconfig.app.json.

import { createElement } from "react";
import { ImageResponse } from "@vercel/og";

export const config = { runtime: "edge" };

const BRAND_BG = "#171413";
const BRAND_FG = "#F2EFE8";
const BRAND_MUTED = "#8C857B";
const BRAND_RULE = "#2A2724";
const BRAND_ACCENT = "#F9F7F4";

const SANS_CSS = "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400&display=swap";
const SANS_MEDIUM_CSS = "https://fonts.googleapis.com/css2?family=DM+Sans:wght@500&display=swap";
const DISPLAY_CSS = "https://fonts.googleapis.com/css2?family=DM+Serif+Display&display=swap";

async function loadGoogleFont(cssUrl: string): Promise<ArrayBuffer> {
  const css = await fetch(cssUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    },
  }).then((r) => r.text());
  const match = css.match(/src:\s*url\(([^)]+)\)\s*format\('(?:woff2|truetype)'\)/);
  if (!match) throw new Error("Could not parse Google Fonts CSS");
  const fontUrl = match[1].replace(/['"]/g, "");
  return fetch(fontUrl).then((r) => r.arrayBuffer());
}

function formatLongDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso + "T12:00:00Z");
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const h = createElement as any;

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const linkType = url.searchParams.get("type") === "guestlist" ? "guestlist" : "daysheet";
  const artist = (url.searchParams.get("artist") || "").trim() || "Untitled show";
  const venue = (url.searchParams.get("venue") || "").trim();
  const city = (url.searchParams.get("city") || "").trim();
  const date = url.searchParams.get("date");

  const eyebrow = linkType === "guestlist" ? "Guest list" : "Day sheet";
  const dateLine = formatLongDate(date);

  const [sansRegular, sansMedium, displayRegular] = await Promise.all([
    loadGoogleFont(SANS_CSS),
    loadGoogleFont(SANS_MEDIUM_CSS),
    loadGoogleFont(DISPLAY_CSS),
  ]);

  const logoMark = h(
    "div",
    {
      style: {
        width: 56,
        height: 56,
        borderRadius: 12,
        background: "#221F1C",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: `1px solid ${BRAND_RULE}`,
      },
    },
    h(
      "svg",
      { width: 32, height: 32, viewBox: "0 0 512 512" },
      h("path", {
        d: "M256 108 L370 404 H322 L295 328 H217 L190 404 H142 Z M256 172 L232 300 H280 Z",
        fill: BRAND_ACCENT,
      }),
    ),
  );

  const topRow = h(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      },
    },
    h(
      "div",
      { style: { display: "flex", alignItems: "center", gap: 18 } },
      logoMark,
      h(
        "div",
        {
          style: {
            fontFamily: "DM Serif Display",
            fontSize: 32,
            letterSpacing: "-0.01em",
            color: BRAND_FG,
          },
        },
        "Advance",
      ),
    ),
    h(
      "div",
      {
        style: {
          fontSize: 16,
          fontWeight: 500,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: BRAND_MUTED,
        },
      },
      eyebrow,
    ),
  );

  const venueCityParts: unknown[] = [];
  if (venue) venueCityParts.push(h("span", { key: "v" }, venue));
  if (venue && city)
    venueCityParts.push(h("span", { key: "sep", style: { color: BRAND_MUTED } }, "·"));
  if (city) venueCityParts.push(h("span", { key: "c", style: { color: BRAND_MUTED } }, city));

  const body = h(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: 18 } },
    dateLine
      ? h(
          "div",
          {
            style: {
              fontSize: 22,
              color: BRAND_MUTED,
              letterSpacing: "-0.005em",
            },
          },
          dateLine,
        )
      : null,
    h(
      "div",
      {
        style: {
          fontFamily: "DM Serif Display",
          fontSize: artist.length > 28 ? 84 : 108,
          lineHeight: 1.02,
          letterSpacing: "-0.02em",
          color: BRAND_FG,
          maxWidth: 1040,
        },
      },
      artist,
    ),
    venueCityParts.length > 0
      ? h(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "row",
              alignItems: "baseline",
              gap: 14,
              fontSize: 32,
              color: BRAND_FG,
              letterSpacing: "-0.01em",
              maxWidth: 1040,
            },
          },
          ...venueCityParts,
        )
      : null,
  );

  const footer = h(
    "div",
    {
      style: {
        marginTop: 56,
        paddingTop: 24,
        borderTop: `1px solid ${BRAND_RULE}`,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: 18,
        color: BRAND_MUTED,
      },
    },
    h("div", null, "advancetouring.com"),
    h("div", null, "Tour management for independent musicians"),
  );

  const root = h(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: BRAND_BG,
        color: BRAND_FG,
        fontFamily: "DM Sans",
        padding: "72px 80px",
      },
    },
    topRow,
    h("div", { style: { display: "flex", flex: 1 } }),
    body,
    footer,
  );

  return new ImageResponse(root, {
    width: 1200,
    height: 630,
    fonts: [
      { name: "DM Sans", data: sansRegular, weight: 400, style: "normal" },
      { name: "DM Sans", data: sansMedium, weight: 500, style: "normal" },
      { name: "DM Serif Display", data: displayRegular, weight: 400, style: "normal" },
    ],
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
