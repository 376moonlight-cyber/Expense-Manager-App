import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  error?: boolean;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ className, error, children, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          "min-h-11 h-11 w-full appearance-none rounded-xl border bg-card px-3 pr-9 text-base sm:text-sm text-foreground shadow-sm",
          "outline-none transition-colors",
          "focus:border-primary focus:ring-2 focus:ring-primary/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error
            ? "border-expense focus:border-expense focus:ring-expense/20"
            : "border-border",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    );
  },
);
