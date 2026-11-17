"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { MonthSwitcher } from "@/components/MonthSwitcher";
import { BudgetsPanel } from "@/components/BudgetsPanel";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { currentMonth } from "@/lib/money";

function shiftMonth(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const next = new Date(year, month - 1 + delta, 1);
  const y = next.getFullYear();
  const m = String(next.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function formatMonthLabel(monthKey: string): string {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) return "…";
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function BudgetsPageInner() {
  const searchParams = useSearchParams();
  const monthParam = searchParams.get("month");
  // Defer calendar reads until mount — Cache Components forbids `new Date()` in prerender.
  const [month, setMonth] = useState(
    monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : "",
  );

  useEffect(() => {
    if (!month) {
      // Defer setState so it is not synchronous in the effect body.
      void Promise.resolve().then(() => setMonth(currentMonth()));
    }
  }, [month]);

  return (
    <AppShell
      title="Budgets"
      description="Set monthly limits per category."
      month={month}
      maxWidth="2xl"
      actions={
        month ? (
          <MonthSwitcher
            label={formatMonthLabel(month)}
            onPrev={() => setMonth((prev) => shiftMonth(prev, -1))}
            onNext={() => setMonth((prev) => shiftMonth(prev, 1))}
          />
        ) : undefined
      }
    >
      {month ? (
        <BudgetsPanel month={month} showMonthPicker={false} />
      ) : (
        <PageSkeleton />
      )}
    </AppShell>
  );
}

export default function BudgetsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BudgetsPageInner />
    </Suspense>
  );
}