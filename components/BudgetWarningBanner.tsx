import Link from "next/link";
import { IconAlertTriangle } from "@/components/Icons";
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
      className="flex gap-3 rounded-2xl border border-amber-200/80 bg-accent-muted px-4 py-3 text-sm text-accent-foreground shadow-sm dark:border-amber-500/30"
      role="status"
    >
      <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200">
        <IconAlertTriangle className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-heading font-semibold text-amber-950 dark:text-amber-100">
          Budget alert for {month}
        </p>
        <ul className="mt-1 space-y-0.5 text-amber-900/90 dark:text-amber-100/80">
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
          className="mt-2 inline-block font-medium text-amber-800 underline underline-offset-2 hover:text-amber-950 dark:text-amber-200 dark:hover:text-amber-50"
        >
          Review budgets
        </Link>
      </div>
    </div>
  );
}
