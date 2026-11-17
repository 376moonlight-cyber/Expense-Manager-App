import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { ReportsClient } from "./reports-client";

export const metadata: Metadata = {
  title: "Reports | PaisaPal",
  description: "Spending reports by category and month",
};

export default function ReportsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ReportsClient />
    </Suspense>
  );
}
