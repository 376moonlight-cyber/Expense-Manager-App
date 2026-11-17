import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  /** Simple label-only mode used by older call sites */
  label?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  className?: string;
};

function DefaultIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-7 w-7"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 7.5h16.5M5.25 7.5v10.5A1.5 1.5 0 0 0 6.75 19.5h10.5a1.5 1.5 0 0 0 1.5-1.5V7.5M9 7.5V6a3 3 0 0 1 6 0v1.5"
      />
    </svg>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  label,
  actionLabel,
  onAction,
  actionHref,
  className,
}: EmptyStateProps) {
  const heading = title || label || "Nothing here yet";
  const body = description || (title && label ? label : undefined);

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/40 px-4 py-10 text-center",
        className,
      )}
    >
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-muted text-primary">
        {icon ?? <DefaultIcon />}
      </div>
      <p className="font-heading text-sm font-semibold text-foreground">
        {heading}
      </p>
      {body ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
      ) : null}
      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {actionLabel}
        </Link>
      ) : null}
      {actionLabel && onAction && !actionHref ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
