import { describe, expect, it } from "vitest";
import {
  escapeCsv,
  parseExpenseImportCsv,
  splitCsvLine,
  splitCsvRows,
} from "./csv";

describe("escapeCsv", () => {
  it("quotes values with commas", () => {
    expect(escapeCsv("a,b")).toBe('"a,b"');
  });

  it("escapes embedded quotes", () => {
    expect(escapeCsv('say "hi"')).toBe('"say ""hi"""');
  });
});

describe("splitCsvLine", () => {
  it("splits plain fields", () => {
    expect(splitCsvLine("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("keeps commas inside quotes", () => {
    expect(splitCsvLine('"Lunch, takeout",Food,12.5')).toEqual([
      "Lunch, takeout",
      "Food",
      "12.5",
    ]);
  });
});

describe("parseExpenseImportCsv", () => {
  it("parses valid rows", () => {
    const csv = [
      "date,description,category,amount",
      "2026-11-01,Coffee,Food,3.50",
      "2026-11-02,Bus,Transport,1.25",
    ].join("\n");

    const result = parseExpenseImportCsv(csv);
    expect(result.headerError).toBeUndefined();
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]?.status).toBe("ok");
    expect(result.rows[0]?.amount).toBe(3.5);
    expect(result.rows[1]?.category).toBe("Transport");
  });

  it("reports bad amounts with row numbers", () => {
    const csv = [
      "date,description,category,amount",
      "2026-11-01,Coffee,Food,-3",
    ].join("\n");

    const result = parseExpenseImportCsv(csv);
    expect(result.rows[0]?.status).toBe("error");
    expect(result.rows[0]?.rowNumber).toBe(2);
    expect(result.rows[0]?.error).toMatch(/positive/i);
  });

  it("rejects missing headers", () => {
    const result = parseExpenseImportCsv("date,description,amount\n2026-01-01,x,1");
    expect(result.headerError).toMatch(/category/i);
    expect(result.rows).toHaveLength(0);
  });

  it("ignores blank lines", () => {
    expect(splitCsvRows("a\n\nb\n")).toEqual(["a", "b"]);
  });
});
