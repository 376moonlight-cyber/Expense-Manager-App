import { describe, expect, it } from "vitest";
import {
  absoluteReceiptPath,
  isAllowedReceiptMimeType,
  matchesMimeMagic,
} from "@/lib/receipts";

describe("receipt helpers", () => {
  it("allows only jpeg, png, and pdf mime types", () => {
    expect(isAllowedReceiptMimeType("image/jpeg")).toBe(true);
    expect(isAllowedReceiptMimeType("image/png")).toBe(true);
    expect(isAllowedReceiptMimeType("application/pdf")).toBe(true);
    expect(isAllowedReceiptMimeType("image/gif")).toBe(false);
    expect(isAllowedReceiptMimeType("text/plain")).toBe(false);
  });

  it("validates magic bytes for each allowed type", () => {
    expect(matchesMimeMagic("image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(
      true,
    );
    expect(
      matchesMimeMagic(
        "image/png",
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toBe(true);
    expect(matchesMimeMagic("application/pdf", Buffer.from("%PDF-1.4"))).toBe(true);
    expect(matchesMimeMagic("image/jpeg", Buffer.from("%PDF-1.4"))).toBe(false);
  });

  it("rejects storage paths outside uploads/", () => {
    expect(() => absoluteReceiptPath("uploads/ok.jpg")).not.toThrow();
    expect(() => absoluteReceiptPath("../secret.txt")).toThrow(
      /Invalid receipt storage path/,
    );
    expect(() => absoluteReceiptPath("public/x.jpg")).toThrow(
      /Invalid receipt storage path/,
    );
  });
});
