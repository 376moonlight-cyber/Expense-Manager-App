/** Convert a decimal amount (e.g. 12.5) to integer minor units (1250). */
export function toMinorUnits(decimal: number): number {
  return Math.round(decimal * 100);
}

/** Convert integer minor units (e.g. 1250) back to a decimal (12.5). */
export function fromMinorUnits(minor: number): number {
  return minor / 100;
}

/** Plain decimal string from minor units (e.g. 1250 → "12.50"). */
export function formatMinorUnits(amountMinor: number): string {
  return fromMinorUnits(amountMinor).toFixed(2);
}

/** Format minor units for display with Intl.NumberFormat. */
export function formatMoney(
  minor: number,
  currency = "PKR",
  locale?: string,
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    // Keep two decimals even for currencies Intl treats as zero-fraction (e.g. PKR).
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(fromMinorUnits(minor));
}

/** Current calendar month as YYYY-MM. */
export function currentMonth(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}
