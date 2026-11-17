import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeVariant =
  | "neutral"
  | "primary"
  | "accent"
  | "income"
  | "expense";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
  leftIcon?: ReactNode;
};

const variantClasses: Record<BadgeVariant, string> = {
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-primary-muted text-primary",
  accent: "bg-accent-muted text-accent-foreground",
  income: "bg-income-muted text-income",
  expense: "bg-expense-muted text-expense",
};

export function Badge({
  className,
  variant = "neutral",
  leftIcon,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {leftIcon}
      {children}
    </span>
  );
}
