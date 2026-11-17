import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { APP_NAME } from "@/lib/branding";
import { ReportsClient } from "./reports-client";

export const metadata: Metadata = {
  title: `Reports | ${APP_NAME}`,
  description: "Spending reports by category and month",
};

export default function ReportsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ReportsClient />
    </Suspense>
  );
}
