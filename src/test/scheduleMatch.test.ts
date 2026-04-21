import { describe, it, expect } from "vitest";
import { isLoadInLabel, isDoorsLabel } from "@/lib/scheduleMatch";

describe("isLoadInLabel", () => {
  it("matches canonical load-in variants", () => {
    expect(isLoadInLabel("Load In")).toBe(true);
    expect(isLoadInLabel("Load-In")).toBe(true);
    expect(isLoadInLabel("load-in")).toBe(true);
    expect(isLoadInLabel("LOAD IN")).toBe(true);
    expect(isLoadInLabel("Loadin")).toBe(true);
    expect(isLoadInLabel("LOADIN")).toBe(true);
    expect(isLoadInLabel("Load  In")).toBe(true); // double space
    expect(isLoadInLabel("Load-in:")).toBe(true); // trailing punctuation
  });

  it("matches qualified load-in labels", () => {
    expect(isLoadInLabel("Band Load In")).toBe(true);
    expect(isLoadInLabel("Opener Load-In")).toBe(true);
    expect(isLoadInLabel("Merch Load In")).toBe(true);
    expect(isLoadInLabel("Load In (Band)")).toBe(true);
  });

  it("does not match lookalike words", () => {
    expect(isLoadInLabel("Loading dock notes")).toBe(false);
    expect(isLoadInLabel("Load Out")).toBe(false);
    expect(isLoadInLabel("Unload")).toBe(false);
    expect(isLoadInLabel("Upload in venue")).toBe(false);
    expect(isLoadInLabel("Download")).toBe(false);
  });

  it("does not match unrelated entries", () => {
    expect(isLoadInLabel("Soundcheck")).toBe(false);
    expect(isLoadInLabel("Doors")).toBe(false);
    expect(isLoadInLabel("Set")).toBe(false);
    expect(isLoadInLabel("")).toBe(false);
  });
});

describe("isDoorsLabel", () => {
  it("matches canonical doors variants", () => {
    expect(isDoorsLabel("Doors")).toBe(true);
    expect(isDoorsLabel("Door")).toBe(true);
    expect(isDoorsLabel("doors")).toBe(true);
    expect(isDoorsLabel("DOORS")).toBe(true);
    expect(isDoorsLabel("Doors Open")).toBe(true);
    expect(isDoorsLabel("Doors (GA)")).toBe(true);
    expect(isDoorsLabel("VIP Doors")).toBe(true);
  });

  it("does not match composite words", () => {
    expect(isDoorsLabel("Doorman")).toBe(false);
    expect(isDoorsLabel("Backdoor")).toBe(false);
    expect(isDoorsLabel("Frontdoor")).toBe(false);
    expect(isDoorsLabel("Doormat")).toBe(false);
    expect(isDoorsLabel("Indoor")).toBe(false);
  });

  it("does not match unrelated entries", () => {
    expect(isDoorsLabel("Soundcheck")).toBe(false);
    expect(isDoorsLabel("Load In")).toBe(false);
    expect(isDoorsLabel("Set")).toBe(false);
    expect(isDoorsLabel("")).toBe(false);
  });
});
