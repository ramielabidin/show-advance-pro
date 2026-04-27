import { describe, expect, it } from "vitest";
import {
  buildSubject,
  escapeHtml,
  formatFullDate,
  renderDaysheetEmail,
  type RenderShow,
} from "../../supabase/functions/send-daysheet-email/template.ts";

function baseShow(overrides: Partial<RenderShow> = {}): RenderShow {
  return {
    artist_name: "The Test Band",
    venue_name: "9:30 Club",
    venue_address: "815 V St NW, Washington, DC 20001, United States",
    city: "Washington, DC",
    date: "2026-04-22",
    set_length: "60 min",
    schedule_entries: [
      { id: "1", time: "3:00 PM", label: "Load In", is_band: false, sort_order: 1 },
      { id: "2", time: "5:00 PM", label: "Sound Check", is_band: false, sort_order: 2 },
      { id: "3", time: "9:30 PM", label: "Band", is_band: true, sort_order: 3 },
    ],
    show_contacts: [
      {
        id: "c1",
        name: "Alex Promoter",
        phone: "(202) 555-0199",
        email: null,
        role: "day_of_show",
        role_label: null,
        notes: null,
        sort_order: 0,
      },
    ],
    departure_time: null,
    departure_notes: null,
    parking_notes: "Street parking on V St; load-in alley entrance",
    load_in_details: "Door on the east side of the building",
    green_room_info: "Upstairs, second door on the right",
    wifi_network: "NineThirty",
    wifi_password: "rocknroll",
    hotel_name: "Kimpton Mason & Rook",
    hotel_address: "1430 Rhode Island Ave NW",
    hotel_confirmation: "ABC123456",
    hotel_checkin: "3:00 PM",
    hotel_checkout: "11:00 AM",
    guest_list_details: JSON.stringify([
      { name: "Jamie", plusOnes: 1 },
      { name: "Sam", plusOnes: 0 },
    ]),
    additional_info: null,
    ...overrides,
  };
}

describe("renderDaysheetEmail", () => {
  it("renders subject with date, venue and city", () => {
    const { subject } = renderDaysheetEmail(baseShow());
    expect(subject).toBe("Wednesday, April 22, 2026 - 9:30 Club (Washington, DC) - Day Sheet");
    expect(buildSubject(baseShow())).toBe(subject);
  });

  it("strips 'United States' from the venue address in the header", () => {
    const { html } = renderDaysheetEmail(baseShow());
    expect(html).not.toContain("United States");
    expect(html).toContain("815 V St NW, Washington, DC 20001");
  });

  it("omits city from the sub-line when the full address is shown", () => {
    const { html } = renderDaysheetEmail(baseShow());
    // The address row carries the city already; the sub-line shouldn't repeat it.
    expect(html).not.toMatch(/April 22, 2026 · Washington, DC/);
  });

  it("falls back to city in the sub-line when no venue address is set", () => {
    const { html } = renderDaysheetEmail(baseShow({ venue_address: null }));
    expect(html).toContain("April 22, 2026 · Washington, DC");
  });

  it("does not repeat the address when the city field has been overwritten with the full address", () => {
    const fullAddr = "815 V St NW, Washington, DC 20001";
    const { html } = renderDaysheetEmail(
      baseShow({ city: fullAddr, venue_address: `${fullAddr}, United States` }),
    );
    // The sub-line ("date · ...") should not list the address, only the date.
    expect(html).not.toMatch(new RegExp(`April 22, 2026 · ${fullAddr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  });

  it("applies the pastel-green accent to the band's schedule row", () => {
    const { html } = renderDaysheetEmail(baseShow());
    const bandIdx = html.indexOf("Band (60 min)");
    expect(bandIdx).toBeGreaterThan(-1);
    // The band row's TD should carry the pastel green foreground + weight.
    const rowStart = html.lastIndexOf("<td", bandIdx);
    const rowSlice = html.slice(rowStart, bandIdx);
    expect(rowSlice).toContain("#346538");
    expect(rowSlice).toContain("font-weight:600");
  });

  it("appends the set length inline to the band row only", () => {
    const { html } = renderDaysheetEmail(baseShow());
    expect(html).toContain("Band (60 min)");
    expect(html).not.toContain("Load In (60 min)");
  });

  it("renders section order matching DaysheetGuestView", () => {
    const { html } = renderDaysheetEmail(baseShow());
    const positions = [
      "Schedule",
      "Day of Show Contact",
      "Arrival",
      "At The Venue",
      "Accommodations",
      "Guest List",
    ].map((label) => ({ label, idx: html.indexOf(`>${label}<`) }));
    positions.forEach((p) => expect(p.idx).toBeGreaterThan(-1));
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i].idx).toBeGreaterThan(positions[i - 1].idx);
    }
  });

  it("omits sections whose hasData() returns false", () => {
    const minimal = baseShow({
      show_contacts: [],
      parking_notes: null,
      load_in_details: null,
      green_room_info: null,
      wifi_network: null,
      wifi_password: null,
      hotel_name: null,
      hotel_address: null,
      hotel_confirmation: null,
      hotel_checkin: null,
      hotel_checkout: null,
      guest_list_details: null,
    });
    const { html } = renderDaysheetEmail(minimal);
    expect(html).toContain(">Schedule<");
    expect(html).not.toContain(">Day of Show Contact<");
    expect(html).not.toContain(">Arrival<");
    expect(html).not.toContain(">At The Venue<");
    expect(html).not.toContain(">Accommodations<");
    expect(html).not.toContain(">Guest List<");
  });

  it("renders DOS and Other Contacts sections when multiple contacts exist", () => {
    const { html, text } = renderDaysheetEmail(
      baseShow({
        show_contacts: [
          {
            id: "c1",
            name: "Alex Promoter",
            phone: "(202) 555-0199",
            email: null,
            role: "day_of_show",
            role_label: null,
            notes: null,
            sort_order: 0,
          },
          {
            id: "c2",
            name: "Jamie Tech",
            phone: "(202) 555-0122",
            email: "jamie@venue.test",
            role: "production",
            role_label: null,
            notes: null,
            sort_order: 1,
          },
          {
            id: "c3",
            name: "Sam Runner",
            phone: null,
            email: null,
            role: "custom",
            role_label: "Runner",
            notes: "Arrives 4pm",
            sort_order: 2,
          },
        ],
      }),
    );
    expect(html).toContain(">Day of Show Contact<");
    expect(html).toContain(">Other Contacts<");
    expect(html).toContain("Alex Promoter");
    expect(html).toContain("Jamie Tech");
    expect(html).toContain("Sam Runner");
    expect(html).toContain("Runner");
    expect(text).toContain("DAY OF SHOW CONTACT");
    expect(text).toContain("OTHER CONTACTS");
    expect(text).toContain("Jamie Tech");
  });

  it("renders only Contacts section when no DOS role is present", () => {
    const { html } = renderDaysheetEmail(
      baseShow({
        show_contacts: [
          {
            id: "c1",
            name: "Jamie Tech",
            phone: "(202) 555-0122",
            email: null,
            role: "production",
            role_label: null,
            notes: null,
            sort_order: 0,
          },
        ],
      }),
    );
    expect(html).not.toContain(">Day of Show Contact<");
    expect(html).toContain(">Contacts<");
    expect(html).toContain("Jamie Tech");
  });

  it("treats TBD and N/A values as empty", () => {
    const { html } = renderDaysheetEmail(
      baseShow({ parking_notes: "TBD", load_in_details: "n/a" }),
    );
    expect(html).not.toContain(">Arrival<");
  });

  it("renders the personal note above the first section when provided", () => {
    const { html } = renderDaysheetEmail(baseShow(), {
      personalMessage: "Pumped for this one — see y'all there.",
    });
    const messageIdx = html.indexOf("Pumped for this one");
    const scheduleIdx = html.indexOf(">Schedule<");
    expect(messageIdx).toBeGreaterThan(-1);
    expect(messageIdx).toBeLessThan(scheduleIdx);
  });

  it("signs the personal note with the sender's name when provided", () => {
    const { html } = renderDaysheetEmail(baseShow(), {
      personalMessage: "Pumped for this one.",
      senderName: "Rami",
    });
    expect(html).toContain("— Rami");
  });

  it("omits the sender signature when no personal note is present", () => {
    const { html } = renderDaysheetEmail(baseShow(), {
      personalMessage: "   ",
      senderName: "Rami",
    });
    expect(html).not.toContain("— Rami");
  });

  it("omits the personal-message block entirely when the note is empty", () => {
    const { html } = renderDaysheetEmail(baseShow(), { personalMessage: "   " });
    expect(html).not.toContain("Pumped for this one");
  });

  it("renders phone and confirmation # in the monospace font", () => {
    const { html } = renderDaysheetEmail(baseShow());
    const phoneIdx = html.indexOf("(202) 555-0199");
    const confIdx = html.indexOf("ABC123456");
    expect(phoneIdx).toBeGreaterThan(-1);
    expect(confIdx).toBeGreaterThan(-1);
    // The TD wrapping each value declares font-family with "JetBrains Mono".
    const phoneTd = html.slice(html.lastIndexOf("<td", phoneIdx), phoneIdx);
    const confTd = html.slice(html.lastIndexOf("<td", confIdx), confIdx);
    expect(phoneTd).toContain("JetBrains Mono");
    expect(confTd).toContain("JetBrains Mono");
  });

  it("escapes HTML in user-supplied fields", () => {
    const { html, text } = renderDaysheetEmail(
      baseShow({
        green_room_info: "<script>alert('x')</script>",
        additional_info: "Bring gear & cables",
      }),
      { personalMessage: "<b>Hi</b>" },
    );
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Bring gear &amp; cables");
    expect(html).not.toContain("<b>Hi</b>");
    expect(html).toContain("&lt;b&gt;Hi&lt;/b&gt;");
    // Plain text is unescaped by design.
    expect(text).toContain("Bring gear & cables");
  });

  it("parses a JSON guest list into named line items and strips empties", () => {
    const { html, text } = renderDaysheetEmail(baseShow());
    // Name and plus-count render in adjacent table cells (name left, plus right).
    expect(html).toContain(">Jamie<");
    expect(html).toContain(">+1<");
    expect(html).toContain(">Sam<");
    // Guests with zero plus-ones render an em-dash in the plus column, not "+0".
    expect(html).toContain(">—<");
    expect(html).not.toContain("+0");
    // Plain-text body still collapses name + plus into a single line.
    expect(text).toContain("Jamie +1");
    expect(text).toContain("Sam");
  });

  it("falls back to newline-split guest list when value is not JSON", () => {
    const { html } = renderDaysheetEmail(
      baseShow({ guest_list_details: "Jamie\nSam\n\n" }),
    );
    expect(html).toContain("Jamie");
    expect(html).toContain("Sam");
  });

  it("includes a plain-text alternative that has no HTML tags", () => {
    const { text } = renderDaysheetEmail(baseShow());
    expect(text).toContain("SCHEDULE");
    expect(text).toContain("DAY OF SHOW CONTACT");
    expect(text).not.toMatch(/<[a-z][^>]*>/i);
  });
});

describe("formatFullDate", () => {
  it("formats an ISO date into the guest-view format", () => {
    expect(formatFullDate("2026-04-22")).toBe("Wednesday, April 22, 2026");
  });

  it("returns empty string for a nullish value", () => {
    expect(formatFullDate(null)).toBe("");
    expect(formatFullDate(undefined)).toBe("");
  });

  it("returns the raw string when the input is not an ISO date", () => {
    expect(formatFullDate("not-a-date")).toBe("not-a-date");
  });
});

describe("escapeHtml", () => {
  it("escapes the five named HTML entities", () => {
    expect(escapeHtml(`<a href="x">b&c'd</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;b&amp;c&#39;d&lt;/a&gt;",
    );
  });
});
