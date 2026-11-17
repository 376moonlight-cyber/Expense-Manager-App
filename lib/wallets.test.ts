import { describe, expect, it } from "vitest";
import {
  computeWalletBalanceMinor,
  walletBodySchema,
  walletTransferSchema,
} from "./wallets";

describe("computeWalletBalanceMinor", () => {
  it("adds income and inbound transfers, subtracts expenses and outbound", () => {
    expect(
      computeWalletBalanceMinor({
        openingBalanceMinor: 10_000,
        incomeMinor: 5_000,
        expenseMinor: 2_000,
        transferredInMinor: 1_000,
        transferredOutMinor: 500,
      }),
    ).toBe(13_500);
  });
});

describe("walletBodySchema", () => {
  it("accepts a valid wallet", () => {
    const result = walletBodySchema.safeParse({
      name: "Cash",
      type: "Cash",
      openingBalance: 100,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid type", () => {
    const result = walletBodySchema.safeParse({
      name: "Cash",
      type: "Crypto",
      openingBalance: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe("walletTransferSchema", () => {
  it("requires positive amount", () => {
    const result = walletTransferSchema.safeParse({
      fromWalletId: "a",
      toWalletId: "b",
      amount: 0,
    });
    expect(result.success).toBe(false);
  });
});
