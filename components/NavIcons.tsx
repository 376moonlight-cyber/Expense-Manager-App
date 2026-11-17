type IconProps = {
  className?: string;
};

export function IconHome({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z" />
    </svg>
  );
}

export function IconIncome({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0 4-4m-4 4-4-4M5 19h14" />
    </svg>
  );
}

export function IconBudgets({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 19V5m0 14h16M8 15V9m4 6V7m4 8v-3" />
    </svg>
  );
}

export function IconReports({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 19h16M7 16V8m5 8V5m5 11v-6" />
    </svg>
  );
}

export function IconSettings({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.3 4.3a1.8 1.8 0 0 1 3.4 0l.2 1a1.8 1.8 0 0 0 1.3 1.3l1 .2a1.8 1.8 0 0 1 0 3.4l-1 .2a1.8 1.8 0 0 0-1.3 1.3l-.2 1a1.8 1.8 0 0 1-3.4 0l-.2-1a1.8 1.8 0 0 0-1.3-1.3l-1-.2a1.8 1.8 0 0 1 0-3.4l1-.2a1.8 1.8 0 0 0 1.3-1.3l.2-1Z"
      />
      <circle cx="12" cy="12" r="2.25" />
    </svg>
  );
}

export function IconWallets({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 7.5h16.5v10.5A1.5 1.5 0 0 1 18.75 19.5H5.25A1.5 1.5 0 0 1 3.75 18V7.5Zm0 0V6A1.5 1.5 0 0 1 5.25 4.5h9" />
      <circle cx="16.5" cy="13" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconGoals({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconRecurring({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 12a8 8 0 0 1 13.5-5.8L20 8M20 4v4h-4M20 12a8 8 0 0 1-13.5 5.8L4 16M4 20v-4h4" />
    </svg>
  );
}

export function IconLogout({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H4m0 0 3-3m-3 3 3 3m5-10h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5" />
    </svg>
  );
}
