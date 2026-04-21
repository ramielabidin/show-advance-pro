import { describe, it, expect } from "vitest";
import { to12Hour, to24Hour } from "@/lib/timeFormat";

describe("to24Hour", () => {
  it("parses H:MM AM/PM", () => {
    expect(to24Hour("7:00 PM")).toBe("19:00");
    expect(to24Hour("12:30 AM")).toBe("00:30");
    expect(to24Hour("12:00 PM")).toBe("12:00");
    expect(to24Hour("7:00pm")).toBe("19:00");
    expect(to24Hour("7:00 P.M.")).toBe("19:00");
  });

  it("parses H AM/PM without colon", () => {
    expect(to24Hour("7 PM")).toBe("19:00");
    expect(to24Hour("7pm")).toBe("19:00");
    expect(to24Hour("11p")).toBe("23:00");
  });

  it("parses 24-hour with seconds (PG time)", () => {
    expect(to24Hour("19:00:00")).toBe("19:00");
    expect(to24Hour("07:30:00")).toBe("07:30");
  });

  it("parses 24-hour without AM/PM", () => {
    expect(to24Hour("19:00")).toBe("19:00");
    expect(to24Hour("7:30")).toBe("07:30");
  });

  it("parses compact digits", () => {
    expect(to24Hour("1900")).toBe("19:00");
    expect(to24Hour("930")).toBe("09:30");
    expect(to24Hour("7")).toBe("07:00");
  });

  it("returns null for TBD / N/A / blank", () => {
    expect(to24Hour("TBD")).toBeNull();
    expect(to24Hour("n/a")).toBeNull();
    expect(to24Hour("")).toBeNull();
    expect(to24Hour(null)).toBeNull();
    expect(to24Hour(undefined)).toBeNull();
  });

  it("returns null for garbage", () => {
    expect(to24Hour("around 7ish")).toBeNull();
    expect(to24Hour("25:00")).toBeNull();
    expect(to24Hour("7:75")).toBeNull();
  });
});

describe("to12Hour", () => {
  it("renders afternoon hours as PM", () => {
    expect(to12Hour("19:00")).toBe("7:00 PM");
    expect(to12Hour("13:30")).toBe("1:30 PM");
    expect(to12Hour("23:00")).toBe("11:00 PM");
  });

  it("renders morning hours as AM", () => {
    expect(to12Hour("07:30")).toBe("7:30 AM");
    expect(to12Hour("6")).toBe("6:00 AM");
  });

  it("handles noon and midnight edges", () => {
    expect(to12Hour("12:00")).toBe("12:00 PM");
    expect(to12Hour("12:30 AM")).toBe("12:30 AM");
    expect(to12Hour("00:00")).toBe("12:00 AM");
    expect(to12Hour("00:30")).toBe("12:30 AM");
  });

  it("round-trips common input formats", () => {
    expect(to12Hour("7:00 PM")).toBe("7:00 PM");
    expect(to12Hour("7pm")).toBe("7:00 PM");
    expect(to12Hour("1900")).toBe("7:00 PM");
    expect(to12Hour("19:00:00")).toBe("7:00 PM");
  });

  it("returns null for unparseable input", () => {
    expect(to12Hour("TBD")).toBeNull();
    expect(to12Hour("")).toBeNull();
    expect(to12Hour(null)).toBeNull();
    expect(to12Hour("around 7ish")).toBeNull();
  });
});
