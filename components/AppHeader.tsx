"use client";

import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";

export type AppHeaderProps = {
  title: string;
  description?: string;
  month?: string;
  actions?: ReactNode;
  className?: string;
};

/**
 * Legacy header wrapper. Prefer composing content inside `AppShell` directly.
 */
export function AppHeader({
  title,
  description,
  month,
  actions,
}: AppHeaderProps) {
  return (
    <AppShell
      title={title}
      description={description}
      month={month}
      actions={actions}
    >
      {null}
    </AppShell>
  );
}
