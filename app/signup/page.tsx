import { AuthForm } from "@/components/AuthForm";
import { signup } from "@/app/actions/auth";

export default function SignupPage() {
  return (
    <main className="min-h-full bg-zinc-100">
      <AuthForm mode="signup" action={signup} />
    </main>
  );
}
