import { describe, it, expect } from "vitest";
import { normalizePhone, formatCityState } from "@/lib/utils";

describe("normalizePhone", () => {
  it("formats a 10-digit string", () => {
    expect(normalizePhone("5551234567")).toBe("(555) 123-4567");
  });

  it("strips dashes before formatting", () => {
    expect(normalizePhone("555-123-4567")).toBe("(555) 123-4567");
  });

  it("strips parentheses and spaces before formatting", () => {
    expect(normalizePhone("(555) 123-4567")).toBe("(555) 123-4567");
  });

  it("formats an 11-digit number starting with 1", () => {
    expect(normalizePhone("15551234567")).toBe("+1 (555) 123-4567");
  });

  it("formats an 11-digit number with country code separator", () => {
    expect(normalizePhone("1-555-123-4567")).toBe("+1 (555) 123-4567");
  });

  it("returns non-standard lengths as-is", () => {
    expect(normalizePhone("12345")).toBe("12345");
  });

  it("returns international numbers as-is", () => {
    expect(normalizePhone("+44 20 1234 5678")).toBe("+44 20 1234 5678");
  });

  it("returns empty string unchanged", () => {
    expect(normalizePhone("")).toBe("");
  });

  it("returns whitespace-only string unchanged", () => {
    expect(normalizePhone("   ")).toBe("   ");
  });
});

describe("formatCityState", () => {
  it("inserts comma between city and state", () => {
    expect(formatCityState("Nashville TN")).toBe("Nashville, TN");
  });

  it("leaves already-formatted city/state unchanged", () => {
    expect(formatCityState("Nashville, TN")).toBe("Nashville, TN");
  });

  it("strips trailing asterisks", () => {
    expect(formatCityState("Albany NY**")).toBe("Albany, NY");
  });

  it("strips single trailing asterisk", () => {
    expect(formatCityState("Albany NY*")).toBe("Albany, NY");
  });

  it("handles multi-word city names", () => {
    expect(formatCityState("New York NY")).toBe("New York, NY");
  });

  it("returns empty string for null", () => {
    expect(formatCityState(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(formatCityState(undefined)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(formatCityState("")).toBe("");
  });

  it("normalizes a full US state name to 2-letter code", () => {
    expect(formatCityState("Los Angeles, California")).toBe("Los Angeles, CA");
  });

  it("normalizes full state names case-insensitively", () => {
    expect(formatCityState("Austin, texas")).toBe("Austin, TX");
  });

  it("normalizes multi-word state names", () => {
    expect(formatCityState("Brooklyn, New York")).toBe("Brooklyn, NY");
    expect(formatCityState("Charleston, South Carolina")).toBe("Charleston, SC");
  });

  it("normalizes District of Columbia", () => {
    expect(formatCityState("Washington, District of Columbia")).toBe("Washington, DC");
  });

  it("leaves non-US states untouched", () => {
    expect(formatCityState("Toronto, Ontario")).toBe("Toronto, Ontario");
    expect(formatCityState("London, England")).toBe("London, England");
  });

  it("handles missing space after comma", () => {
    expect(formatCityState("Albany,NY")).toBe("Albany, NY");
  });

  it("returns city-only input unchanged", () => {
    expect(formatCityState("Nashville")).toBe("Nashville");
  });
});
