"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { BudgetsPanel } from "@/components/BudgetsPanel";
import { currentMonth } from "@/lib/money";

function BudgetsPageInner() {
  const searchParams = useSearchParams();
  const monthParam = searchParams.get("month");
  // Defer calendar reads until mount — Cache Components forbids `new Date()` in prerender.
  const [month, setMonth] = useState(monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : "");

  useEffect(() => {
    if (!month) {
      setMonth(currentMonth());
    }
  }, [month]);

  return (
    <div className="min-h-full bg-zinc-100 text-zinc-900">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        <nav className="flex flex-wrap items-center gap-3 text-sm">
          <Link
            href="/"
            className="font-medium text-teal-700 underline-offset-2 hover:underline"
          >
            ← Expenses
          </Link>
          <span className="text-zinc-300">/</span>
          <span className="font-medium text-zinc-900">Budgets</span>
          <span className="text-zinc-300">/</span>
          <Link
            href="/recurring"
            className="font-medium text-teal-700 underline-offset-2 hover:underline"
          >
            Recurring
          </Link>
          <span className="text-zinc-300">/</span>
          <Link
            href="/reports"
            className="font-medium text-teal-700 underline-offset-2 hover:underline"
          >
            Reports
          </Link>
          <span className="text-zinc-300">/</span>
          <Link
            href="/settings"
            className="font-medium text-teal-700 underline-offset-2 hover:underline"
          >
            Settings
          </Link>
          <span className="text-zinc-300">/</span>
          <Link
            href="/logout"
            className="font-medium text-zinc-500 underline-offset-2 hover:underline"
          >
            Log out
          </Link>
        </nav>
        {month ? (
          <BudgetsPanel month={month} onMonthChange={setMonth} />
        ) : (
          <p className="text-sm text-zinc-500">Loading budgets…</p>
        )}
      </div>
    </div>
  );
}

export default function BudgetsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-full bg-zinc-100 px-4 py-8 text-sm text-zinc-500">
          Loading budgets…
        </div>
      }
    >
      <BudgetsPageInner />
    </Suspense>
  );
}
