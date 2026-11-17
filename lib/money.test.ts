import { describe, expect, it } from "vitest";
import {
  currentMonth,
  formatMinorUnits,
  formatMoney,
  fromMinorUnits,
  toMinorUnits,
} from "./money";

describe("toMinorUnits", () => {
  it("converts decimals to integer cents", () => {
    expect(toMinorUnits(12.5)).toBe(1250);
    expect(toMinorUnits(0.01)).toBe(1);
    expect(toMinorUnits(100)).toBe(10000);
  });

  it("rounds with Math.round (IEEE float edge cases included)", () => {
    expect(toMinorUnits(1.006)).toBe(101);
    expect(toMinorUnits(1.004)).toBe(100);
  });
});

describe("fromMinorUnits", () => {
  it("converts cents back to decimals", () => {
    expect(fromMinorUnits(1250)).toBe(12.5);
    expect(fromMinorUnits(1)).toBe(0.01);
  });
});

describe("formatMinorUnits", () => {
  it("formats with two decimal places", () => {
    expect(formatMinorUnits(1250)).toBe("12.50");
    expect(formatMinorUnits(100)).toBe("1.00");
  });
});

describe("formatMoney", () => {
  it("formats as currency", () => {
    expect(formatMoney(1250, "USD", "en-US")).toBe("$12.50");
    expect(formatMoney(1250, "PKR", "en-US")).toContain("12.50");
  });
});

describe("currentMonth", () => {
  it("returns YYYY-MM for a fixed date", () => {
    expect(currentMonth(new Date(2026, 10, 16))).toBe("2026-11");
  });
});
