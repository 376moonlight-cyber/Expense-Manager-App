"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { AuthFormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { APP_NAME, APP_TAGLINE, resolveDeveloperName } from "@/lib/branding";

const DEVELOPER_NAME = resolveDeveloperName();

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
      <div className="text-center sm:text-left">
        <div className="flex items-center justify-center gap-3 sm:justify-start">
          <img
            src="/logo-mark.svg"
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 shrink-0"
          />
          <div className="text-left">
            <p className="font-heading text-sm font-semibold tracking-wide text-primary">
              {APP_NAME}
            </p>
            <p className="text-xs text-muted-foreground">
              {APP_TAGLINE}
            </p>
          </div>
        </div>
        <h1 className="mt-5 font-heading text-2xl font-semibold tracking-tight text-foreground">
          {isSignup ? "Create an account" : "Sign in"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isSignup
            ? "Track your own expenses and budgets."
            : "Welcome back. Use your email and password."}
        </p>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>{isSignup ? "Sign up" : "Sign in"}</CardTitle>
          <CardDescription>
            {isSignup
              ? "Create your personal finance workspace."
              : "Access your expense tracker."}
          </CardDescription>
        </CardHeader>
        <CardBody className="pt-0">
          <form action={formAction} className="flex flex-col gap-4">
            {isSignup ? (
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-foreground">Name</span>
                <Input
                  name="name"
                  type="text"
                  required
                  autoComplete="name"
                />
              </label>
            ) : null}

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-foreground">Email</span>
              <Input
                name="email"
                type="email"
                required
                autoComplete="email"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-foreground">Password</span>
              <Input
                name="password"
                type="password"
                required
                minLength={isSignup ? 8 : 1}
                autoComplete={isSignup ? "new-password" : "current-password"}
              />
            </label>

            {state.error ? (
              <div className="rounded-xl border border-expense/30 bg-expense-muted px-3 py-2 text-sm text-expense">
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

            <Button type="submit" size="lg" disabled={pending} className="w-full">
              {pending
                ? isSignup
                  ? "Creating account…"
                  : "Signing in…"
                : isSignup
                  ? "Sign up"
                  : "Sign in"}
            </Button>
          </form>
        </CardBody>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        {isSignup ? (
          <>
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Sign in
            </Link>
          </>
        ) : (
          <>
            Need an account?{" "}
            <Link
              href="/signup"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Sign up
            </Link>
          </>
        )}
      </p>

      <p className="text-center text-xs text-muted-foreground">
        Developed by {DEVELOPER_NAME}
        <span aria-hidden className="mx-1.5 text-border">
          ·
        </span>
        <Link
          href="/about"
          className="font-medium underline-offset-2 hover:text-primary hover:underline"
        >
          About
        </Link>
      </p>
    </div>
  );
}