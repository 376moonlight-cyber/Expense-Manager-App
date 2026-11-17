import Link from "next/link";
import type { BudgetRow } from "@/lib/budgets";
import { formatMoney } from "@/lib/money";

type BudgetWarningBannerProps = {
  budgets: BudgetRow[];
  month: string;
  currency?: string;
};

export function BudgetWarningBanner({
  budgets,
  month,
  currency = "PKR",
}: BudgetWarningBannerProps) {
  const warnings = budgets.filter(
    (b) =>
      b.monthlyLimit != null &&
      b.monthlyLimit > 0 &&
      b.spent / b.monthlyLimit >= 0.8,
  );

  if (warnings.length === 0) return null;

  const over = warnings.filter(
    (b) => b.monthlyLimit != null && b.spent >= b.monthlyLimit,
  );
  const near = warnings.filter(
    (b) => b.monthlyLimit != null && b.spent < b.monthlyLimit,
  );

  return (
    <div
      className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
      role="status"
    >
      <p className="font-medium">Budget alert for {month}</p>
      <ul className="mt-1 list-inside list-disc text-amber-900/90">
        {over.map((b) => (
          <li key={b.categoryId}>
            {b.categoryName}: {formatMoney(b.spent, currency)} /{" "}
            {formatMoney(b.monthlyLimit!, currency)} (over budget)
          </li>
        ))}
        {near.map((b) => (
          <li key={b.categoryId}>
            {b.categoryName}: {formatMoney(b.spent, currency)} /{" "}
            {formatMoney(b.monthlyLimit!, currency)} (over 80%)
          </li>
        ))}
      </ul>
      <Link
        href={`/budgets?month=${encodeURIComponent(month)}`}
        className="mt-2 inline-block font-medium text-amber-800 underline underline-offset-2 hover:text-amber-950"
      >
        Review budgets
      </Link>
    </div>
  );
}
