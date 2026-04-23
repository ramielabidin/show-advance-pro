import { describe, expect, it } from "vitest";
import {
  buildSubject,
  escapeHtml,
  firstName,
  renderInviteEmail,
  type InviteParams,
} from "../../supabase/functions/send-team-invite-email/template.ts";

function baseParams(overrides: Partial<InviteParams> = {}): InviteParams {
  return {
    inviterName: "Maya Okafor",
    inviterEmail: "maya@tourhands.co",
    teamName: "Ghost Light Touring",
    roleLabel: "Member — full access to shows, tours, and day sheets",
    acceptUrl: "https://app.advancetouring.com/invite/accept?token=xyz",
    inviteCode: "a7k2p9",
    ...overrides,
  };
}

describe("renderInviteEmail", () => {
  it("builds the subject from inviter and team name", () => {
    const { subject } = renderInviteEmail(baseParams());
    expect(subject).toBe("Maya Okafor added you to Ghost Light Touring on Advance");
    expect(buildSubject(baseParams())).toBe(subject);
  });

  it("renders the hero headline in three hard-broken lines", () => {
    const { html } = renderInviteEmail(baseParams());
    expect(html).toContain("You&rsquo;ve been<br>added to<br>the crew.");
  });

  it("renders the inviter's first name in the slug line", () => {
    const { html } = renderInviteEmail(baseParams());
    expect(html).toContain("Dispatch from Maya");
  });

  it("bolds the inviter name in the first body paragraph", () => {
    const { html } = renderInviteEmail(baseParams());
    expect(html).toContain(
      `<strong style="font-weight:600;">Maya Okafor</strong> added you to their team on Advance`,
    );
  });

  it("includes team, invited-by and role rows in order", () => {
    const { html } = renderInviteEmail(baseParams());
    const positions = ["Team", "Invited by", "Your role"].map((label) => ({
      label,
      idx: html.indexOf(`>${label}<`),
    }));
    positions.forEach((p) => expect(p.idx).toBeGreaterThan(-1));
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i].idx).toBeGreaterThan(positions[i - 1].idx);
    }
  });

  it("renders the inviter email in monospace", () => {
    const { html } = renderInviteEmail(baseParams());
    const emailIdx = html.indexOf("maya@tourhands.co");
    expect(emailIdx).toBeGreaterThan(-1);
    const spanStart = html.lastIndexOf("<span", emailIdx);
    const spanSlice = html.slice(spanStart, emailIdx);
    expect(spanSlice).toContain("JetBrains Mono");
  });

  it("points the CTA at the accept URL and carries it into the MSO fallback", () => {
    const { html } = renderInviteEmail(
      baseParams({ acceptUrl: "https://app.advancetouring.com/go?t=xyz" }),
    );
    // Regular anchor
    expect(html).toContain(
      `<a href="https://app.advancetouring.com/go?t=xyz"`,
    );
    // Outlook VML fallback carries the same href
    expect(html).toContain(
      `<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="https://app.advancetouring.com/go?t=xyz"`,
    );
  });

  it("shows the invite-code short-link in the sign-off when provided", () => {
    const { html } = renderInviteEmail(baseParams({ inviteCode: "a7k2p9" }));
    expect(html).toContain("advancetouring.com/invite/a7k2p9");
  });

  it("falls back to a generic sign-off when no invite code is provided", () => {
    const { html } = renderInviteEmail(baseParams({ inviteCode: null }));
    expect(html).toContain("advancetouring.com");
    // Scoped to the sign-off pattern so the CTA's /invite/accept href
    // doesn't false-positive the "no invite code" assertion.
    expect(html).not.toContain("&middot; advancetouring.com/invite/");
  });

  it("escapes HTML in user-supplied fields", () => {
    const { html, text } = renderInviteEmail(
      baseParams({
        inviterName: "<script>alert('x')</script>",
        teamName: "Ghost & Light",
        roleLabel: "Admin <b>bold</b>",
        inviterEmail: "a+b@c.co",
      }),
    );
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Ghost &amp; Light");
    expect(html).toContain("Admin &lt;b&gt;bold&lt;/b&gt;");
    // Plain text is not HTML-escaped by design.
    expect(text).toContain("<script>alert('x')</script>");
    expect(text).toContain("Ghost & Light");
  });

  it("includes a plain-text alternative with no HTML tags", () => {
    const { text } = renderInviteEmail(baseParams());
    expect(text).toContain("Maya Okafor added you to Ghost Light Touring on Advance.");
    expect(text).toContain("Sign in or create account:");
    expect(text).toContain("https://app.advancetouring.com/invite/accept?token=xyz");
    expect(text).not.toMatch(/<[a-z][^>]*>/i);
  });

  it("includes a hidden preheader at the top of the body", () => {
    const { html } = renderInviteEmail(baseParams());
    const bodyStart = html.indexOf("<body");
    const preheaderText = "Maya Okafor added you to Ghost Light Touring on Advance.";
    const preheaderIdx = html.indexOf(preheaderText);
    expect(preheaderIdx).toBeGreaterThan(bodyStart);
    const hiddenBlock = html.slice(bodyStart, preheaderIdx);
    expect(hiddenBlock).toContain("display:none");
    expect(hiddenBlock).toContain("opacity:0");
  });
});

describe("firstName", () => {
  it("returns the first whitespace-separated token", () => {
    expect(firstName("Maya Okafor")).toBe("Maya");
    expect(firstName("  Rami  El Abidin ")).toBe("Rami");
  });

  it("returns the full string when it's a single token", () => {
    expect(firstName("Cher")).toBe("Cher");
  });

  it("falls back to 'someone' for an empty or whitespace-only input", () => {
    expect(firstName("")).toBe("someone");
    expect(firstName("   ")).toBe("someone");
  });
});

describe("escapeHtml", () => {
  it("escapes the five named HTML entities", () => {
    expect(escapeHtml(`<a href="x">b&c'd</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;b&amp;c&#39;d&lt;/a&gt;",
    );
  });
});
