import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { auth } from "@/auth";
import { AboutView } from "@/components/AboutView";
import { AppShell } from "@/components/AppShell";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { PageSkeleton } from "@/components/ui/Skeleton";
import packageJson from "@/package.json";

export const metadata: Metadata = {
  title: "About | PaisaPal",
  description:
    "Learn what PaisaPal does, how to use it, and how your data is handled.",
};

const SUPPORT_EMAIL_FALLBACK = "support@example.com";

function resolveSupportEmail(): string {
  const raw = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();
  if (raw && raw.length > 0) return raw;
  return SUPPORT_EMAIL_FALLBACK;
}

async function AboutContent() {
  let isLoggedIn = false;
  try {
    const session = await auth();
    isLoggedIn = Boolean(session?.user);
  } catch {
    isLoggedIn = false;
  }

  const version = packageJson.version;
  const supportEmail = resolveSupportEmail();

  if (isLoggedIn) {
    return (
      <AppShell
        title="About"
        description="What PaisaPal is and how your data is handled."
        maxWidth="3xl"
      >
        <AboutView
          version={version}
          supportEmail={supportEmail}
          compactHero
        />
      </AppShell>
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-primary-muted/40 via-background to-emerald-50/50 dark:from-primary/10 dark:via-background dark:to-emerald-950/20">
      <header className="border-b border-border/80 bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/about" className="flex min-w-0 items-center gap-2.5">
            <img
              src="/logo-mark.svg"
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 shrink-0"
            />
            <span className="font-heading text-sm font-semibold tracking-wide text-primary">
              PaisaPal
            </span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="inline-flex min-h-11 items-center rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10 animate-page-enter">
        <AboutView version={version} supportEmail={supportEmail} />
      </main>
    </div>
  );
}

export default function AboutPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AboutContent />
    </Suspense>
  );
}
