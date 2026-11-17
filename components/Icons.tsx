import type { ReactElement, ReactNode, SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

function base(props: IconProps, paths: ReactNode) {
  const { className = "h-4 w-4", size, strokeWidth = 1.75, ...rest } = props;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      width={size}
      height={size}
      aria-hidden
      {...rest}
    >
      {paths}
    </svg>
  );
}

export type AppIcon = (props: IconProps) => ReactElement;

export function IconHome(props: IconProps) {
  return base(
    props,
    <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z" />,
  );
}

export function IconIncome(props: IconProps) {
  return base(
    props,
    <>
      <path d="M12 3v12" />
      <path d="m8 11 4 4 4-4" />
      <path d="M5 19h14" />
    </>,
  );
}

export function IconBudgets(props: IconProps) {
  return base(
    props,
    <>
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="M8 15V9" />
      <path d="M12 15V7" />
      <path d="M16 15v-3" />
    </>,
  );
}

export function IconReports(props: IconProps) {
  return base(
    props,
    <>
      <path d="M4 19h16" />
      <path d="M7 16V8" />
      <path d="M12 16V5" />
      <path d="M17 16v-6" />
    </>,
  );
}

export function IconSettings(props: IconProps) {
  return base(
    props,
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>,
  );
}

export function IconWallets(props: IconProps) {
  return base(
    props,
    <>
      <path d="M3.75 7.5h16.5v10.5A1.5 1.5 0 0 1 18.75 19.5H5.25A1.5 1.5 0 0 1 3.75 18V7.5Z" />
      <path d="M3.75 7.5V6A1.5 1.5 0 0 1 5.25 4.5h9" />
      <circle cx="16.5" cy="13" r="1" fill="currentColor" stroke="none" />
    </>,
  );
}

export function IconGoals(props: IconProps) {
  return base(
    props,
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </>,
  );
}

export function IconRecurring(props: IconProps) {
  return base(
    props,
    <>
      <path d="M4 12a8 8 0 0 1 13.5-5.8L20 8" />
      <path d="M20 4v4h-4" />
      <path d="M20 12a8 8 0 0 1-13.5 5.8L4 16" />
      <path d="M4 20v-4h4" />
    </>,
  );
}

export function IconLogout(props: IconProps) {
  return base(
    props,
    <>
      <path d="M15 12H4" />
      <path d="m7 9-3 3 3 3" />
      <path d="M12 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5" />
    </>,
  );
}

export function IconChevronLeft(props: IconProps) {
  return base(props, <path d="m15 18-6-6 6-6" />);
}

export function IconChevronRight(props: IconProps) {
  return base(props, <path d="m9 18 6-6-6-6" />);
}

export function IconAlertTriangle(props: IconProps) {
  return base(
    props,
    <>
      <path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </>,
  );
}

export function IconPlus(props: IconProps) {
  return base(
    props,
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>,
  );
}

export function IconX(props: IconProps) {
  return base(
    props,
    <>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </>,
  );
}

export function IconMoon(props: IconProps) {
  return base(props, <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5Z" />);
}

export function IconSun(props: IconProps) {
  return base(
    props,
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>,
  );
}

export function IconDownload(props: IconProps) {
  return base(
    props,
    <>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 19h14" />
    </>,
  );
}

export function IconReceipt(props: IconProps) {
  return base(
    props,
    <>
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M8 7h8M8 11h8M8 15h5" />
    </>,
  );
}

export function IconCar(props: IconProps) {
  return base(
    props,
    <>
      <path d="M5 17h14v-5l-2-5H7L5 12v5Z" />
      <path d="M5 17H3v2h2M19 17h2v2h-2" />
      <circle cx="7.5" cy="17" r="1.5" />
      <circle cx="16.5" cy="17" r="1.5" />
    </>,
  );
}

export function IconUtensils(props: IconProps) {
  return base(
    props,
    <>
      <path d="M3 2v7c0 1.1.9 2 2 2h0a2 2 0 0 0 2-2V2" />
      <path d="M7 2v20" />
      <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
    </>,
  );
}

export function IconShoppingBag(props: IconProps) {
  return base(
    props,
    <>
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </>,
  );
}

export function IconHeartPulse(props: IconProps) {
  return base(
    props,
    <>
      <path d="M19.5 12.5 17 15l-3-3 4-4 4 4-2.5.5Z" />
      <path d="M3.5 12.5 6 15l3-3-4-4-4 4 2.5.5Z" />
      <path d="M2 12h4l2 4 4-8 2 4h8" />
    </>,
  );
}

export function IconMore(props: IconProps) {
  return base(
    props,
    <>
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
    </>,
  );
}

export function IconTag(props: IconProps) {
  return base(
    props,
    <>
      <path d="M12 2H2v10l9.3 9.3a1 1 0 0 0 1.4 0l8.6-8.6a1 1 0 0 0 0-1.4Z" />
      <circle cx="7" cy="7" r="1.5" fill="currentColor" stroke="none" />
    </>,
  );
}

export function IconArrowUpRight(props: IconProps) {
  return base(
    props,
    <>
      <path d="M7 17 17 7" />
      <path d="M7 7h10v10" />
    </>,
  );
}

export function IconArrowDownRight(props: IconProps) {
  return base(
    props,
    <>
      <path d="m7 7 10 10" />
      <path d="M17 7v10H7" />
    </>,
  );
}

export function IconBanknote(props: IconProps) {
  return base(
    props,
    <>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2" />
      <path d="M6 12h.01M18 12h.01" />
    </>,
  );
}

export function IconCalendar(props: IconProps) {
  return base(
    props,
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>,
  );
}

export function IconFileText(props: IconProps) {
  return base(
    props,
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6M8 13h8M8 17h8M8 9h2" />
    </>,
  );
}

export function IconPencil(props: IconProps) {
  return base(
    props,
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </>,
  );
}

export function IconTrash(props: IconProps) {
  return base(
    props,
    <>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6M14 11v6" />
    </>,
  );
}

export function IconTags(props: IconProps) {
  return base(
    props,
    <>
      <path d="M9 5H2v7l7.3 7.3a1 1 0 0 0 1.4 0L17 14" />
      <path d="M13 3h7v7l-8.3 8.3a1 1 0 0 1-1.4 0L7 15" />
      <circle cx="16.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </>,
  );
}

export function IconInfo(props: IconProps) {
  return base(
    props,
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v6" />
      <path d="M12 7h.01" />
    </>,
  );
}

export function IconCurrency(props: IconProps) {
  return base(
    props,
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6v12" />
      <path d="M15.5 9.5c-.5-1-1.7-1.7-3.5-1.7s-3 .8-3 2.2c0 2.8 6 1.4 6 4.2 0 1.4-1.3 2.3-3 2.3s-3-.8-3.5-1.8" />
    </>,
  );
}

export function IconShield(props: IconProps) {
  return base(
    props,
    <>
      <path d="M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6l-8-3Z" />
    </>,
  );
}

export function IconChevronDown(props: IconProps) {
  return base(props, <path d="m6 9 6 6 6-6" />);
}
