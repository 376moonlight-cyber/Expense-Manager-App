import { cn } from "@/lib/cn";
import { getCategoryStyle } from "@/lib/category-style";

export type CategoryIconProps = {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeMap = {
  sm: { wrap: "h-7 w-7", icon: "h-3.5 w-3.5" },
  md: { wrap: "h-9 w-9", icon: "h-4 w-4" },
  lg: { wrap: "h-11 w-11", icon: "h-5 w-5" },
} as const;

/** Colored round icon for a category name (Food, Transport, …). */
export function CategoryIcon({
  name,
  size = "md",
  className,
}: CategoryIconProps) {
  const style = getCategoryStyle(name);
  const Icon = style.icon;
  const dims = sizeMap[size];

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full",
        dims.wrap,
        style.bgClass,
        style.colorClass,
        className,
      )}
      title={name}
      aria-hidden
    >
      <Icon className={dims.icon} strokeWidth={2} />
    </span>
  );
}
