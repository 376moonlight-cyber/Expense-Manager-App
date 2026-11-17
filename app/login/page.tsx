import { AuthForm } from "@/components/AuthForm";
import { login } from "@/app/actions/auth";

export default function LoginPage() {
  return (
    <main className="min-h-full bg-zinc-100">
      <AuthForm mode="login" action={login} />
    </main>
  );
}
