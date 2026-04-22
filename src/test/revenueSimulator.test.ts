import { describe, it, expect } from "vitest";
import {
  parseDollar,
  parseBackendPct,
  parseBackendBasis,
  parseBackendType,
  parseTieredDeal,
  NBOR_EXPENSE_RATIO,
} from "@/components/RevenueSimulator";

describe("parseDollar", () => {
  it("parses a plain number", () => {
    expect(parseDollar("500")).toBe(500);
  });

  it("strips dollar sign", () => {
    expect(parseDollar("$500")).toBe(500);
  });

  it("strips commas", () => {
    expect(parseDollar("$1,500")).toBe(1500);
  });

  it("takes the first value from a slash-separated range", () => {
    expect(parseDollar("$20/$25")).toBe(20);
    expect(parseDollar("$20/$25/$30")).toBe(20);
  });

  it("returns null for null input", () => {
    expect(parseDollar(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(parseDollar(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseDollar("")).toBeNull();
  });

  it("returns null for non-numeric string", () => {
    expect(parseDollar("see contract")).toBeNull();
  });

  it("handles decimal values", () => {
    expect(parseDollar("$12.50")).toBe(12.5);
  });
});

describe("parseBackendPct", () => {
  it("extracts percentage from a simple string", () => {
    expect(parseBackendPct("85%")).toBe(85);
  });

  it("extracts percentage from a deal string", () => {
    expect(parseBackendPct("70% of GBOR")).toBe(70);
  });

  it("extracts percentage from a vs-deal string", () => {
    expect(parseBackendPct("$500 vs 80% of gross")).toBe(80);
  });

  it("handles decimal percentages", () => {
    expect(parseBackendPct("66.7%")).toBe(66.7);
  });

  it("returns null when no percentage is present", () => {
    expect(parseBackendPct("see contract")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(parseBackendPct(null)).toBeNull();
  });

  it("returns null for 0%", () => {
    expect(parseBackendPct("0%")).toBeNull();
  });

  it("returns null for over 100%", () => {
    expect(parseBackendPct("101%")).toBeNull();
  });
});

describe("parseBackendBasis", () => {
  it("detects GBOR", () => {
    expect(parseBackendBasis("80% of GBOR")).toBe("GBOR");
  });

  it("detects NBOR", () => {
    expect(parseBackendBasis("80% of NBOR")).toBe("NBOR");
  });

  it("defaults to gross when neither keyword is present", () => {
    expect(parseBackendBasis("80% of gross")).toBe("gross");
    expect(parseBackendBasis("$500 vs 80%")).toBe("gross");
  });

  it("returns gross for null input", () => {
    expect(parseBackendBasis(null)).toBe("gross");
  });

  it("is case-insensitive", () => {
    expect(parseBackendBasis("80% of nbor")).toBe("NBOR");
    expect(parseBackendBasis("80% of gbor")).toBe("GBOR");
  });
});

describe("parseBackendType", () => {
  it("detects a plus deal", () => {
    expect(parseBackendType("80% of GBOR (plus)")).toBe("plus");
  });

  it("is case-insensitive for plus", () => {
    expect(parseBackendType("80% of GBOR (Plus)")).toBe("plus");
  });

  it("defaults to vs when (plus) is absent", () => {
    expect(parseBackendType("80% of GBOR")).toBe("vs");
  });

  it("defaults to vs for null input", () => {
    expect(parseBackendType(null)).toBe("vs");
  });

  it("defaults to vs for undefined input", () => {
    expect(parseBackendType(undefined)).toBe("vs");
  });
});

describe("parseTieredDeal", () => {
  it("parses a two-tier deal", () => {
    const result = parseTieredDeal("70% of GBOR, then 85% above 500 tickets");
    expect(result).toEqual({ tier2Pct: 85, tier2Threshold: 500 });
  });

  it("is case-insensitive", () => {
    const result = parseTieredDeal("70% of GBOR, THEN 85% ABOVE 500 TICKETS");
    expect(result).toEqual({ tier2Pct: 85, tier2Threshold: 500 });
  });

  it("handles singular 'ticket'", () => {
    const result = parseTieredDeal("70% of GBOR, then 85% above 1 ticket");
    expect(result).toEqual({ tier2Pct: 85, tier2Threshold: 1 });
  });

  it("returns null for a flat deal", () => {
    expect(parseTieredDeal("80% of GBOR")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(parseTieredDeal(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(parseTieredDeal(undefined)).toBeNull();
  });
});

describe("NBOR_EXPENSE_RATIO", () => {
  it("is between 0 and 1 (a valid ratio)", () => {
    expect(NBOR_EXPENSE_RATIO).toBeGreaterThan(0);
    expect(NBOR_EXPENSE_RATIO).toBeLessThan(1);
  });
});
