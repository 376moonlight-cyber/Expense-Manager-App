"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { AuthFormState } from "@/app/actions/auth";

type AuthFormProps = {
  mode: "login" | "signup";
  action: (
    prev: AuthFormState,
    formData: FormData,
  ) => Promise<AuthFormState>;
};

const initialState: AuthFormState = {};

export function AuthForm({ mode, action }: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const isSignup = mode === "signup";

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-10 sm:py-16">
      <div>
        <p className="text-sm font-medium tracking-wide text-teal-700">
          Expense Tracker
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
          {isSignup ? "Create an account" : "Sign in"}
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          {isSignup
            ? "Track your own expenses and budgets."
            : "Welcome back. Use your email and password."}
        </p>
      </div>

      <form
        action={formAction}
        className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
      >
        {isSignup ? (
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-zinc-700">Name</span>
            <input
              name="name"
              type="text"
              required
              autoComplete="name"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 outline-none ring-teal-600 focus:ring-2"
            />
          </label>
        ) : null}

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-zinc-700">Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 outline-none ring-teal-600 focus:ring-2"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-zinc-700">Password</span>
          <input
            name="password"
            type="password"
            required
            minLength={isSignup ? 8 : 1}
            autoComplete={isSignup ? "new-password" : "current-password"}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 outline-none ring-teal-600 focus:ring-2"
          />
        </label>

        {state.error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <p>{state.error}</p>
            {state.details?.length ? (
              <ul className="mt-1 list-disc pl-4">
                {state.details.map((detail) => (
                  <li key={`${detail.path}-${detail.message}`}>
                    {detail.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:opacity-60"
        >
          {pending
            ? isSignup
              ? "Creating account…"
              : "Signing in…"
            : isSignup
              ? "Sign up"
              : "Sign in"}
        </button>
      </form>

      <p className="text-center text-sm text-zinc-600">
        {isSignup ? (
          <>
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-teal-700 underline-offset-2 hover:underline"
            >
              Sign in
            </Link>
          </>
        ) : (
          <>
            Need an account?{" "}
            <Link
              href="/signup"
              className="font-medium text-teal-700 underline-offset-2 hover:underline"
            >
              Sign up
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
