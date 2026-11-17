import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type ProgressBarProps = HTMLAttributes<HTMLDivElement> & {
  /** 0–100 (values outside are clamped) */
  value: number;
  tone?: "primary" | "income" | "expense" | "accent";
  size?: "sm" | "md";
};

const toneClasses = {
  primary: "bg-primary",
  income: "bg-income",
  expense: "bg-expense",
  accent: "bg-accent",
} as const;

export function ProgressBar({
  value,
  tone = "primary",
  size = "md",
  className,
  ...props
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        "w-full overflow-hidden rounded-full bg-muted",
        size === "sm" ? "h-1.5" : "h-2.5",
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          "progress-fill h-full rounded-full",
          toneClasses[tone],
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
