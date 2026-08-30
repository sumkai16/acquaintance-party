import { LoginForm } from "./login-form";

export const metadata = { title: "Admin sign in" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-5">
      <h1 className="font-display text-3xl uppercase">Admin sign in</h1>
      <LoginForm />
    </main>
  );
}
