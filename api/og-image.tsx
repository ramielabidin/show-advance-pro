import { ImageResponse } from "@vercel/og";

export const config = { runtime: "edge" };

const BRAND_BG = "#171413";
const BRAND_FG = "#F2EFE8";
const BRAND_MUTED = "#8C857B";
const BRAND_RULE = "#2A2724";
const BRAND_ACCENT = "#F9F7F4";

const GOOGLE_FONTS = {
  sans: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap",
  display: "https://fonts.googleapis.com/css2?family=DM+Serif+Display&display=swap",
};

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

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const linkType = url.searchParams.get("type") === "guestlist" ? "guestlist" : "daysheet";
  const artist = (url.searchParams.get("artist") || "").trim();
  const venue = (url.searchParams.get("venue") || "").trim();
  const city = (url.searchParams.get("city") || "").trim();
  const date = url.searchParams.get("date");

  const eyebrow = linkType === "guestlist" ? "Guest list" : "Day sheet";
  const dateLine = formatLongDate(date);

  const [sansRegular, sansMedium, displayRegular] = await Promise.all([
    loadGoogleFont(GOOGLE_FONTS.sans),
    loadGoogleFont(
      "https://fonts.googleapis.com/css2?family=DM+Sans:wght@500&display=swap",
    ),
    loadGoogleFont(GOOGLE_FONTS.display),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: BRAND_BG,
          color: BRAND_FG,
          fontFamily: "DM Sans",
          padding: "72px 80px",
        }}
      >
        {/* Top row: logo + eyebrow */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 12,
                background: "#221F1C",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: `1px solid ${BRAND_RULE}`,
              }}
            >
              <svg width="32" height="32" viewBox="0 0 512 512">
                <path
                  d="M256 108 L370 404 H322 L295 328 H217 L190 404 H142 Z M256 172 L232 300 H280 Z"
                  fill={BRAND_ACCENT}
                />
              </svg>
            </div>
            <div
              style={{
                fontFamily: "DM Serif Display",
                fontSize: 32,
                letterSpacing: "-0.01em",
                color: BRAND_FG,
              }}
            >
              Advance
            </div>
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 500,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: BRAND_MUTED,
            }}
          >
            {eyebrow}
          </div>
        </div>

        {/* Spacer */}
        <div style={{ display: "flex", flex: 1 }} />

        {/* Body */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {dateLine && (
            <div
              style={{
                fontSize: 22,
                color: BRAND_MUTED,
                letterSpacing: "-0.005em",
              }}
            >
              {dateLine}
            </div>
          )}
          <div
            style={{
              fontFamily: "DM Serif Display",
              fontSize: artist.length > 28 ? 84 : 108,
              lineHeight: 1.02,
              letterSpacing: "-0.02em",
              color: BRAND_FG,
              maxWidth: 1040,
            }}
          >
            {artist || "Untitled show"}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "baseline",
              gap: 14,
              fontSize: 32,
              color: BRAND_FG,
              letterSpacing: "-0.01em",
              maxWidth: 1040,
            }}
          >
            {venue && <span>{venue}</span>}
            {venue && city && <span style={{ color: BRAND_MUTED }}>·</span>}
            {city && <span style={{ color: BRAND_MUTED }}>{city}</span>}
          </div>
        </div>

        {/* Footer rule + domain */}
        <div
          style={{
            marginTop: 56,
            paddingTop: 24,
            borderTop: `1px solid ${BRAND_RULE}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 18,
            color: BRAND_MUTED,
          }}
        >
          <div>advancetouring.com</div>
          <div>Tour management for independent musicians</div>
        </div>
      </div>
    ),
    {
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
    },
  );
}
