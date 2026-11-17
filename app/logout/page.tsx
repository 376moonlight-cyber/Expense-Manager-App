import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/LogoutButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { auth } from "@/auth";

async function LogoutContent() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main className="min-h-full bg-surface text-foreground">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-16 animate-page-enter">
        <div>
          <p className="font-heading text-sm font-semibold tracking-wide text-primary">
            PaisaPal
          </p>
          <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight">
            Log out
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Signed in as {session.user.email ?? "your account"}.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}

export default function LogoutPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-full bg-surface px-4 py-16">
          <div className="mx-auto w-full max-w-md space-y-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-28 w-full rounded-2xl" />
          </div>
        </main>
      }
    >
      <LogoutContent />
    </Suspense>
  );
}
