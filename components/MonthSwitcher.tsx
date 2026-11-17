"use client";

import { IconChevronLeft, IconChevronRight } from "@/components/Icons";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export type MonthSwitcherProps = {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  className?: string;
};

/** Compact previous / next month control for page headers. */
export function MonthSwitcher({
  label,
  onPrev,
  onNext,
  className,
}: MonthSwitcherProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-1 rounded-2xl border border-border bg-card px-1.5 py-1.5 shadow-card sm:justify-start",
        className,
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Previous month"
        onClick={onPrev}
        className="min-h-11 min-w-11"
      >
        <IconChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-36 text-center text-sm font-semibold tabular-nums text-foreground sm:min-w-40">
        {label}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Next month"
        onClick={onNext}
        className="min-h-11 min-w-11"
      >
        <IconChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
