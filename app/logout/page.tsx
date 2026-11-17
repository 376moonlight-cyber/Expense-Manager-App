import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/LogoutButton";
import { auth } from "@/auth";

async function LogoutContent() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main className="min-h-full bg-zinc-100">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-16">
        <div>
          <p className="text-sm font-medium tracking-wide text-teal-700">
            Expense Tracker
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
            Log out
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Signed in as {session.user.email ?? "your account"}.
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
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
        <main className="min-h-full bg-zinc-100 px-4 py-16 text-sm text-zinc-500">
          Loading…
        </main>
      }
    >
      <LogoutContent />
    </Suspense>
  );
}
