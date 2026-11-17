import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ className, error, type = "text", ...props }, ref) {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          "min-h-11 h-11 w-full rounded-xl border bg-card px-3 text-base sm:text-sm text-foreground shadow-sm",
          "placeholder:text-muted-foreground/70",
          "outline-none transition-colors",
          "focus:border-primary focus:ring-2 focus:ring-primary/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error
            ? "border-expense focus:border-expense focus:ring-expense/20"
            : "border-border",
          className,
        )}
        {...props}
      />
    );
  },
);
