import { AuthForm } from "@/components/AuthForm";
import { signup } from "@/app/actions/auth";

export default function SignupPage() {
  return (
    <main className="min-h-full bg-gradient-to-br from-primary-muted/40 via-background to-emerald-50/50 dark:from-primary/10 dark:via-background dark:to-emerald-950/20">
      <AuthForm mode="signup" action={signup} />
    </main>
  );
}
