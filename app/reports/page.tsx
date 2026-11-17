import type { Metadata } from "next";
import { Suspense } from "react";
import { ReportsClient } from "./reports-client";

export const metadata: Metadata = {
  title: "Reports | Expense Tracker",
  description: "Spending reports by category and month",
};

export default function ReportsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-full bg-zinc-100 px-4 py-8 text-sm text-zinc-500">
          Loading reports…
        </div>
      }
    >
      <ReportsClient />
    </Suspense>
  );
}
