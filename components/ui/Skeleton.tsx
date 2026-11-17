import { cn } from "@/lib/cn";

export type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-muted/80 dark:bg-muted",
        className,
      )}
      aria-hidden
    />
  );
}

export function SummaryCardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <section
      className="grid gap-3 sm:grid-cols-3"
      aria-busy="true"
      aria-label="Loading summary"
    >
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="rounded-2xl border border-border bg-card px-5 py-5 shadow-card"
        >
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-3 h-8 w-32" />
        </div>
      ))}
    </section>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading list">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-3"
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Skeleton className="h-12 w-12 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-40 max-w-full" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div
      className="grid gap-4 sm:grid-cols-2"
      aria-busy="true"
      aria-label="Loading form"
    >
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full sm:col-span-2" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-36" />
    </div>
  );
}

export function ChartSkeleton({
  className = "min-h-40",
}: {
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-end gap-2 rounded-xl border border-dashed border-border bg-muted/30 p-4",
        className,
      )}
      aria-busy="true"
      aria-label="Loading chart"
    >
      <Skeleton className="h-16 w-full rounded-md" />
      <Skeleton className="h-28 w-full rounded-md" />
      <Skeleton className="h-20 w-full rounded-md" />
      <Skeleton className="h-32 w-full rounded-md" />
      <Skeleton className="h-24 w-full rounded-md" />
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-fade-slide-in">
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-48" />
      </div>
      <SummaryCardsSkeleton />
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <Skeleton className="mb-4 h-6 w-36" />
        <FormSkeleton />
      </div>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <Skeleton className="mb-4 h-6 w-28" />
        <ListSkeleton />
      </div>
    </div>
  );
}
