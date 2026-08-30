"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserClient } from "@/lib/supabase/browser";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const result = await browserClient().auth.signInWithPassword({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });

    if (result.error) {
      setError("That email and password do not match an admin account.");
      setPending(false);
      return;
    }

    router.push("/admin/review");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-4">
      {error ? (
        <p
          role="alert"
          className="rounded border border-accent/30 bg-accent/10 px-4 py-3 text-accent"
        >
          {error}
        </p>
      ) : null}
      <label className="flex flex-col gap-1.5">
        <span className="font-semibold">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="rounded border border-ink/25 bg-white px-3 py-2.5"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="font-semibold">Password</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="rounded border border-ink/25 bg-white px-3 py-2.5"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-accent px-6 py-3 font-semibold text-ground disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
