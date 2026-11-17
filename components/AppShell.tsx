"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import {
  IconBudgets,
  IconGoals,
  IconHome,
  IconIncome,
  IconInfo,
  IconLogout,
  IconRecurring,
  IconReports,
  IconSettings,
  IconWallets,
  type AppIcon,
} from "@/components/Icons";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { cn } from "@/lib/cn";

type NavItem = {
  href: string;
  label: string;
  icon: AppIcon;
  match: (pathname: string) => boolean;
};

const PRIMARY_TABS: NavItem[] = [
  { href: "/", label: "Home", icon: IconHome, match: (p) => p === "/" },
  {
    href: "/income",
    label: "Income",
    icon: IconIncome,
    match: (p) => p.startsWith("/income"),
  },
  {
    href: "/budgets",
    label: "Budgets",
    icon: IconBudgets,
    match: (p) => p.startsWith("/budgets"),
  },
  {
    href: "/reports",
    label: "Reports",
    icon: IconReports,
    match: (p) => p.startsWith("/reports"),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: IconSettings,
    match: (p) => p.startsWith("/settings"),
  },
];

const SECONDARY_LINKS: NavItem[] = [
  {
    href: "/wallets",
    label: "Wallets",
    icon: IconWallets,
    match: (p) => p.startsWith("/wallets"),
  },
  {
    href: "/goals",
    label: "Goals",
    icon: IconGoals,
    match: (p) => p.startsWith("/goals"),
  },
  {
    href: "/recurring",
    label: "Recurring",
    icon: IconRecurring,
    match: (p) => p.startsWith("/recurring"),
  },
  {
    href: "/about",
    label: "About",
    icon: IconInfo,
    match: (p) => p.startsWith("/about"),
  },
];

type AppShellProps = {
  children: ReactNode;
  title?: string;
  description?: string;
  month?: string;
  actions?: ReactNode;
  maxWidth?: "2xl" | "3xl" | "5xl";
};

const MAX_WIDTH = {
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "5xl": "max-w-5xl",
} as const;

function hrefFor(item: NavItem, month?: string): string {
  if (item.href === "/budgets" && month && /^\d{4}-\d{2}$/.test(month)) {
    return `/budgets?month=${encodeURIComponent(month)}`;
  }
  return item.href;
}

function linkClass(active: boolean, compact = false) {
  if (compact) {
    return cn(
      "inline-flex min-h-11 w-full flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[11px] font-medium transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      active
        ? "bg-primary-muted text-primary"
        : "text-muted-foreground hover:bg-muted hover:text-foreground",
    );
  }
  return cn(
    "inline-flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    active
      ? "bg-primary-muted text-primary"
      : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );
}

export function AppShell({
  children,
  title,
  description,
  month,
  actions,
  maxWidth = "3xl",
}: AppShellProps) {
  const pathname = usePathname() ?? "/";

  return (
    <div className="min-h-full bg-surface text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-surface/90 backdrop-blur md:hidden">
        <div className="mx-auto flex min-h-14 max-w-5xl items-center justify-between gap-3 px-4 py-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <img
              src="/logo-mark.svg"
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 shrink-0"
            />
            <div className="min-w-0">
              <p className="font-heading text-xs font-semibold tracking-wide text-primary">
                PaisaPal
              </p>
              <p className="truncate text-base font-semibold tracking-tight">
                {title ?? "Home"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {actions}
            <ThemeToggle />
            <Link
              href="/logout"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Log out"
            >
              <IconLogout className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl">
        <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-border bg-card px-3 py-6 md:flex lg:w-60">
          <div className="flex items-center gap-2.5 px-3 pb-6">
            <img
              src="/logo-mark.svg"
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 shrink-0"
            />
            <div className="min-w-0">
              <p className="font-heading text-xs font-semibold tracking-wide text-primary">
                PaisaPal
              </p>
              <p className="mt-0.5 font-heading text-lg font-semibold tracking-tight">
                Finance
              </p>
            </div>
          </div>

          <nav aria-label="Primary" className="flex flex-1 flex-col gap-1">
            {PRIMARY_TABS.map((tab) => {
              const Icon = tab.icon;
              const active = tab.match(pathname);
              return (
                <Link
                  key={tab.href}
                  href={hrefFor(tab, month)}
                  aria-current={active ? "page" : undefined}
                  className={linkClass(active)}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {tab.label}
                </Link>
              );
            })}

            <p className="mb-1 mt-5 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              More
            </p>
            {SECONDARY_LINKS.map((link) => {
              const Icon = link.icon;
              const active = link.match(pathname);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={linkClass(active)}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 space-y-1 border-t border-border pt-4">
            <div className="px-1">
              <ThemeToggle />
            </div>
            <Link href="/logout" className={linkClass(false)}>
              <IconLogout className="h-4 w-4 shrink-0" />
              Log out
            </Link>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="sticky top-0 z-30 hidden border-b border-border/80 bg-surface/90 backdrop-blur md:block">
            <div
              className={cn(
                "mx-auto flex w-full items-start justify-between gap-4 px-6 py-5",
                MAX_WIDTH[maxWidth],
              )}
            >
              <div className="min-w-0">
                {title ? (
                  <>
                    <h1 className="font-heading truncate text-2xl font-semibold tracking-tight">
                      {title}
                    </h1>
                    {description ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {description}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <h1 className="sr-only">PaisaPal</h1>
                )}
              </div>
              {actions ? (
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {actions}
                </div>
              ) : null}
            </div>
          </div>

          <main
            className={cn(
              "mx-auto w-full flex-1 px-4 py-6 pb-[calc(5.75rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-8 md:pb-10 animate-page-enter",
              MAX_WIDTH[maxWidth],
            )}
          >
            {children}
            <footer className="mt-10 border-t border-border pt-4 text-center text-xs text-muted-foreground md:text-left">
              <Link
                href="/about"
                className="font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-primary hover:underline"
              >
                About
              </Link>
            </footer>
          </main>
        </div>
      </div>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5 gap-0.5 px-1 pt-1">
          {PRIMARY_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = tab.match(pathname);
            return (
              <li key={tab.href}>
                <Link
                  href={hrefFor(tab, month)}
                  aria-current={active ? "page" : undefined}
                  className={linkClass(active, true)}
                >
                  <Icon className="h-5 w-5" />
                  <span>{tab.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

export function SurfaceCard({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<"section">) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-card card-lift",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}
