"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { browserClient } from "@/lib/supabase/browser";
import { logLogin } from "../session-actions";

const NOT_PROVISIONED_MESSAGE =
  "This account isn't set up yet. Ask an admin to add you before signing in.";

const inputClass =
  "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 " +
  "outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "not_provisioned" ? NOT_PROVISIONED_MESSAGE : null,
  );
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

    const { data: profile } = await browserClient()
      .from("profiles")
      .select("role")
      .eq("id", result.data.user.id)
      .maybeSingle();

    // No matching profiles row: this account isn't provisioned. Sign back
    // out immediately rather than pushing to /admin/dashboard and letting the
    // layout gate silently bounce it back here with no explanation — see
    // docs/superpowers/plans/2026-09-06-staff-cashier-and-remittance.md Task 1.
    if (!profile) {
      await browserClient().auth.signOut();
      setError(NOT_PROVISIONED_MESSAGE);
      setPending(false);
      return;
    }

    await logLogin();

    router.push(profile.role === "staff" ? "/admin/cashier" : "/admin/dashboard");
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
    >
      {error ? (
        <p
          role="alert"
          className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-slate-700">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-slate-700">Password</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className={inputClass}
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
