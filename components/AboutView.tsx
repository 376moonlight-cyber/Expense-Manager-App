import Link from "next/link";
import {
  IconBudgets,
  IconChevronDown,
  IconCurrency,
  IconIncome,
  IconReceipt,
  IconRecurring,
  IconReports,
  IconShield,
  IconArrowDownRight,
  type AppIcon,
} from "@/components/Icons";
import { CopyrightYear } from "@/components/CopyrightYear";
import { Card, CardBody, CardDescription, CardTitle } from "@/components/ui/Card";
import { APP_NAME, APP_TAGLINE } from "@/lib/branding";
import { cn } from "@/lib/cn";

type AboutViewProps = {
  version: string;
  supportEmail: string;
  developerName: string;
  /** Extra top spacing when embedded in AppShell (title already shown). */
  compactHero?: boolean;
};

type Feature = {
  title: string;
  description: string;
  icon: AppIcon;
};

const FEATURES: Feature[] = [
  {
    title: "Expenses",
    description: "Log spending by date, category, and wallet.",
    icon: IconArrowDownRight,
  },
  {
    title: "Income",
    description: "Record paychecks and other money coming in.",
    icon: IconIncome,
  },
  {
    title: "Budgets",
    description: "Set monthly category limits and track progress.",
    icon: IconBudgets,
  },
  {
    title: "Recurring items",
    description: "Automate regular expenses and income.",
    icon: IconRecurring,
  },
  {
    title: "Reports",
    description: "See where money went with monthly breakdowns.",
    icon: IconReports,
  },
  {
    title: "Receipts",
    description: "Attach images or PDFs to expense entries.",
    icon: IconReceipt,
  },
  {
    title: "Multiple currencies",
    description: "Track amounts and convert with your rates.",
    icon: IconCurrency,
  },
];

const STEPS = [
  {
    title: "Add categories",
    body: "Create the spending and income categories that match how you think about money.",
  },
  {
    title: "Add expenses and income",
    body: "Enter transactions as they happen, or catch up by month whenever you are ready.",
  },
  {
    title: "Set budgets",
    body: "Give important categories a monthly limit so you can see when you are close.",
  },
  {
    title: "Check reports",
    body: "Open Reports to review totals and category breakdowns for any month.",
  },
] as const;

const FAQ = [
  {
    q: "Do I need an account?",
    a: "Yes. Sign up with an email and password so your expenses, budgets, and receipts stay tied to your account.",
  },
  {
    q: "Where is my data stored?",
    a: "App data lives in the PostgreSQL database configured for this deployment (for example Neon on Vercel). Receipt files are stored in a private Vercel Blob store and are only served through authenticated API routes.",
  },
  {
    q: "Can other users see my receipts?",
    a: "No. Receipts require you to be signed in, and each file is only served for expenses that belong to your account.",
  },
  {
    q: "How do I change my password?",
    a: "Open Settings while signed in and use the Change password section. Passwords are stored as hashes, not plain text.",
  },
  {
    q: "How do I export my data?",
    a: "In Settings you can download a full ZIP backup (with receipts), restore it, or export expenses/income as CSV for spreadsheets.",
  },
] as const;

export function AboutView({
  version,
  supportEmail,
  developerName,
  compactHero = false,
}: AboutViewProps) {
  return (
    <div className="flex flex-col gap-8 sm:gap-10">
      <section
        className={cn(
          "rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6",
          compactHero ? "" : "text-center sm:text-left",
        )}
      >
        <div
          className={cn(
            "flex flex-col items-center gap-4 sm:flex-row sm:items-start",
            compactHero && "sm:items-center",
          )}
        >
          <img
            src="/logo-mark.png"
            alt=""
            width={56}
            height={56}
            className="h-14 w-14 shrink-0"
          />
          <div className="min-w-0">
            <p className="font-heading text-sm font-semibold tracking-wide text-primary">
              {APP_NAME}
            </p>
            <h2 className="mt-1 font-heading text-2xl font-semibold tracking-tight text-foreground">
              About {APP_NAME}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{APP_TAGLINE}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Developed by{" "}
              <span className="font-medium text-foreground">{developerName}</span>
            </p>
            <p className="mt-3 inline-flex items-center rounded-lg bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              Version {version}
            </p>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-heading text-lg font-semibold tracking-tight">
            What this app does
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {APP_NAME} is a personal finance tracker for everyday money: log
            expenses and income, set budgets, attach receipts, manage recurring
            items, and review monthly reports—optionally across multiple
            currencies.
          </p>
        </div>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <li key={feature.title}>
                <Card className="h-full shadow-card card-lift">
                  <CardBody className="flex items-start gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-muted text-primary">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <CardTitle>{feature.title}</CardTitle>
                      <CardDescription className="mt-1">
                        {feature.description}
                      </CardDescription>
                    </div>
                  </CardBody>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-heading text-lg font-semibold tracking-tight">
            How to use it
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Four simple steps to get a clear picture of your month.
          </p>
        </div>
        <ol className="flex flex-col gap-3">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="flex gap-3 rounded-2xl border border-border bg-card p-4 shadow-card sm:gap-4 sm:p-5"
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
                aria-hidden
              >
                {index + 1}
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="font-heading text-sm font-semibold tracking-tight">
                  {step.title}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-muted text-primary">
            <IconShield className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="font-heading text-lg font-semibold tracking-tight">
              Your data and privacy
            </h2>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p>
                Your account data is stored in the database for this app instance
                (on this device when you run it locally, or on the server where
                the app is hosted). It is not sold or shared with third-party
                analytics services by the app itself.
              </p>
              <p>
                Receipt uploads are private to your account: only a signed-in
                session for your user can download them, and files live in a
                private Vercel Blob store (not publicly listed or hotlinked).
              </p>
              <p>
                Passwords are hashed with bcrypt before they are stored. The app
                never keeps your password in plain text.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-heading text-lg font-semibold tracking-tight">
            Help and feedback
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Questions or ideas? Email{" "}
            <a
              href={`mailto:${supportEmail}`}
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              {supportEmail}
            </a>
            .
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          {FAQ.map((item, index) => (
            <details
              key={item.q}
              className={cn(
                "group border-border",
                index > 0 && "border-t",
              )}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/60 sm:px-5 [&::-webkit-details-marker]:hidden">
                <span>{item.q}</span>
                <IconChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground sm:px-5">
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </section>

      <footer className="border-t border-border pt-6 text-center text-xs text-muted-foreground">
        <p>
          © <CopyrightYear /> {APP_NAME}
        </p>
        <p className="mt-1">Developed by {developerName}</p>
        <p className="mt-2">
          <Link
            href="/"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Back to app
          </Link>
        </p>
      </footer>
    </div>
  );
}
