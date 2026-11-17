declare module "lucide-react" {
  import type { ForwardRefExoticComponent, RefAttributes, SVGProps } from "react";

  export type LucideProps = SVGProps<SVGSVGElement> & {
    size?: string | number;
    absoluteStrokeWidth?: boolean;
    strokeWidth?: string | number;
  };

  export type LucideIcon = ForwardRefExoticComponent<
    Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>
  >;

  export const AlertTriangle: LucideIcon;
  export const ArrowDownRight: LucideIcon;
  export const ArrowLeftRight: LucideIcon;
  export const ArrowUpRight: LucideIcon;
  export const Banknote: LucideIcon;
  export const BarChart3: LucideIcon;
  export const Calendar: LucideIcon;
  export const Car: LucideIcon;
  export const ChevronLeft: LucideIcon;
  export const ChevronRight: LucideIcon;
  export const Download: LucideIcon;
  export const FileText: LucideIcon;
  export const HeartPulse: LucideIcon;
  export const LogOut: LucideIcon;
  export const Moon: LucideIcon;
  export const MoreHorizontal: LucideIcon;
  export const Pencil: LucideIcon;
  export const PiggyBank: LucideIcon;
  export const Plus: LucideIcon;
  export const Receipt: LucideIcon;
  export const RefreshCw: LucideIcon;
  export const Settings: LucideIcon;
  export const ShoppingBag: LucideIcon;
  export const Sun: LucideIcon;
  export const Tag: LucideIcon;
  export const Tags: LucideIcon;
  export const Target: LucideIcon;
  export const Trash2: LucideIcon;
  export const UtensilsCrossed: LucideIcon;
  export const Wallet: LucideIcon;
  export const X: LucideIcon;
}