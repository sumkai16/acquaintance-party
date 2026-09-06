"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const QUERY_DEBOUNCE_MS = 300;

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
] as const;

const PAYMENT_METHOD_OPTIONS = [
  { value: "", label: "All payments" },
  { value: "walk_in", label: "Walk-in only" },
  { value: "online", label: "Online only" },
] as const;

/**
 * Search plus a status dropdown, same pattern as Attendance's ScanFilters —
 * URL-param driven, the text field debounced and the dropdown instant. No
 * submit button, so this behaves exactly like Attendance's filters instead
 * of the page's old standalone hero search form.
 */
export function RegistrationFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const status = searchParams.get("status") ?? "";
  const paymentMethod = searchParams.get("paymentMethod") ?? "";
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  function setParam(key: "q" | "status" | "paymentMethod", value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  useEffect(() => {
    if (q === (searchParams.get("q") ?? "")) return;
    const timer = setTimeout(() => setParam("q", q), QUERY_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={q}
        onChange={(event) => setQ(event.target.value)}
        placeholder="Search by name or email"
        aria-label="Search by name or email"
        className="rounded-md border border-ground/20 bg-ground/5 px-3 py-2 text-sm text-ground outline-none placeholder:text-ground/40 focus:border-accent-2 focus:ring-2 focus:ring-accent-2/30"
      />

      <select
        value={status}
        onChange={(event) => setParam("status", event.target.value)}
        aria-label="Filter by status"
        className="rounded-md border border-ground/20 bg-ground/5 px-3 py-2 text-sm text-ground outline-none focus:border-accent-2 focus:ring-2 focus:ring-accent-2/30 [color-scheme:dark]"
      >
        {STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <select
        value={paymentMethod}
        onChange={(event) => setParam("paymentMethod", event.target.value)}
        aria-label="Filter by payment method"
        className="rounded-md border border-ground/20 bg-ground/5 px-3 py-2 text-sm text-ground outline-none focus:border-accent-2 focus:ring-2 focus:ring-accent-2/30 [color-scheme:dark]"
      >
        {PAYMENT_METHOD_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
