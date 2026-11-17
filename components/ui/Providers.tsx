"use client";

import type { ReactNode } from "react";
import { ConfirmProvider } from "@/components/ui/ConfirmDialog";

/** Client providers that wrap authenticated app chrome. Toast is imperative via Toaster. */
export function AppProviders({ children }: { children: ReactNode }) {
  return <ConfirmProvider>{children}</ConfirmProvider>;
}
