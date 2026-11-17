import {
  IconCar,
  IconHeartPulse,
  IconMore,
  IconReceipt,
  IconShoppingBag,
  IconTag,
  IconUtensils,
  type AppIcon,
} from "@/components/Icons";

export type CategoryStyle = {
  icon: AppIcon;
  /** Tailwind text color for the icon */
  colorClass: string;
  /** Soft circular background behind the icon */
  bgClass: string;
};

const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  Food: {
    icon: IconUtensils,
    colorClass: "text-orange-600 dark:text-orange-400",
    bgClass: "bg-orange-100 dark:bg-orange-500/20",
  },
  Transport: {
    icon: IconCar,
    colorClass: "text-sky-600 dark:text-sky-400",
    bgClass: "bg-sky-100 dark:bg-sky-500/20",
  },
  Bills: {
    icon: IconReceipt,
    colorClass: "text-violet-600 dark:text-violet-400",
    bgClass: "bg-violet-100 dark:bg-violet-500/20",
  },
  Shopping: {
    icon: IconShoppingBag,
    colorClass: "text-pink-600 dark:text-pink-400",
    bgClass: "bg-pink-100 dark:bg-pink-500/20",
  },
  Health: {
    icon: IconHeartPulse,
    colorClass: "text-emerald-600 dark:text-emerald-400",
    bgClass: "bg-emerald-100 dark:bg-emerald-500/20",
  },
  Other: {
    icon: IconMore,
    colorClass: "text-slate-600 dark:text-slate-300",
    bgClass: "bg-slate-100 dark:bg-slate-500/20",
  },
};

const DEFAULT_STYLE: CategoryStyle = {
  icon: IconTag,
  colorClass: "text-teal-700 dark:text-teal-400",
  bgClass: "bg-teal-100 dark:bg-teal-500/20",
};

export function getCategoryStyle(name: string): CategoryStyle {
  return CATEGORY_STYLES[name] ?? DEFAULT_STYLE;
}
