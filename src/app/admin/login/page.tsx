import { EVENT } from "@/lib/config/event";
import { LoginForm } from "./login-form";

export const metadata = { title: "Admin sign in" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <p className="mb-1 text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          {EVENT.name}
        </p>
        <h1 className="mb-6 text-center text-xl font-semibold">
          Admin sign in
        </h1>
        <LoginForm />
      </div>
    </main>
  );
}
