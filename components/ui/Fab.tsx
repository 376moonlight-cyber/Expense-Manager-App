"use client";

import { IconPlus } from "@/components/Icons";
import { cn } from "@/lib/cn";

type FabProps = {
  href?: string;
  onClick?: () => void;
  label?: string;
  className?: string;
};

/** Mobile floating action button — hidden from `md` up. */
export function Fab({
  href = "#add-form",
  onClick,
  label = "Add",
  className,
}: FabProps) {
  const classes = cn(
    "fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 z-40 inline-flex min-h-14 min-w-14 h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 md:hidden",
    className,
  );

  if (onClick) {
    return (
      <button type="button" aria-label={label} onClick={onClick} className={classes}>
        <IconPlus className="h-6 w-6" strokeWidth={2.25} />
      </button>
    );
  }

  return (
    <a href={href} aria-label={label} className={classes}>
      <IconPlus className="h-6 w-6" strokeWidth={2.25} />
    </a>
  );
}
