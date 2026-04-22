import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import {
  normalizeBackendDeal,
  cleanFinancialField,
} from "@/components/BulkUploadDialog";

describe("cleanFinancialField", () => {
  it("returns a plain number string unchanged", () => {
    expect(cleanFinancialField("500")).toBe("500");
  });

  it("strips dollar sign", () => {
    expect(cleanFinancialField("$500")).toBe("500");
  });

  it("strips commas", () => {
    expect(cleanFinancialField("$1,500")).toBe("1500");
  });

  it("takes the first value from a slash-separated range", () => {
    expect(cleanFinancialField("$20/$25")).toBe("20");
  });

  it("handles decimals", () => {
    expect(cleanFinancialField("$12.50")).toBe("12.50");
  });

  it("returns null for empty string", () => {
    expect(cleanFinancialField("")).toBeNull();
  });

  it("returns null for whitespace-only string", () => {
    expect(cleanFinancialField("   ")).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(cleanFinancialField(undefined)).toBeNull();
  });

  it("returns null for a non-numeric string", () => {
    expect(cleanFinancialField("see contract")).toBeNull();
  });

  it("returns '0' for zero", () => {
    expect(cleanFinancialField("0")).toBe("0");
  });
});

describe("normalizeBackendDeal", () => {
  it("normalizes a basic GBOR percentage", () => {
    expect(normalizeBackendDeal("70% of GBOR")).toBe("70% of GBOR");
  });

  it("normalizes a basic NBOR percentage", () => {
    expect(normalizeBackendDeal("70% of NBOR")).toBe("70% of NBOR");
  });

  it("defaults to GBOR when neither keyword is present", () => {
    expect(normalizeBackendDeal("80% of gross")).toBe("80% of GBOR");
    expect(normalizeBackendDeal("80%")).toBe("80% of GBOR");
  });

  it("detects and appends (plus) tag", () => {
    expect(normalizeBackendDeal("80% of GBOR (plus)")).toBe("80% of GBOR (plus)");
  });

  it("detects plus without parentheses", () => {
    expect(normalizeBackendDeal("80% of GBOR plus")).toBe("80% of GBOR (plus)");
  });

  it("preserves a tiered second escalation", () => {
    expect(normalizeBackendDeal("70% of GBOR, then 85% above 500 tickets")).toBe(
      "70% of GBOR, then 85% above 500 tickets"
    );
  });

  it("adds GBOR basis to a tiered deal that lacks it", () => {
    expect(normalizeBackendDeal("70%, then 85% above 500 tickets")).toBe(
      "70% of GBOR, then 85% above 500 tickets"
    );
  });

  it("returns free-text strings without a percentage unchanged", () => {
    expect(normalizeBackendDeal("see contract")).toBe("see contract");
    expect(normalizeBackendDeal("TBD")).toBe("TBD");
  });

  it("normalizes integer percentages without decimal", () => {
    expect(normalizeBackendDeal("70.0% of GBOR")).toBe("70% of GBOR");
  });

  it("preserves non-integer percentages", () => {
    expect(normalizeBackendDeal("66.7% of GBOR")).toBe("66.7% of GBOR");
  });
});
