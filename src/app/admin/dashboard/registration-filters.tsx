"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { YEAR_LEVELS } from "@/lib/registrations/schema";
import { allSections, sectionsFor } from "@/lib/registrations/sections";
import { Option } from "../option";

const QUERY_DEBOUNCE_MS = 300;

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "partial", label: "Partial (walk-in)" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
] as const;

const DELIVERY_OPTIONS = [
  { value: "", label: "All emails" },
  { value: "qr", label: "Waiting for QR" },
  { value: "receipt", label: "Waiting for receipt" },
  { value: "bounced", label: "Email bounced" },
  { value: "undelivered", label: "QR sent, not confirmed" },
] as const;

const PAYMENT_METHOD_OPTIONS = [
  { value: "", label: "All payments" },
  { value: "walk_in", label: "Walk-in only" },
  { value: "online", label: "Online only" },
] as const;

/**
 * Search plus status, year-level and payment dropdowns, same pattern as
 * Attendance's ScanFilters — URL-param driven, the text field debounced and
 * the dropdowns instant. No submit button, so this behaves exactly like
 * Attendance's filters instead of the page's old standalone hero search
 * form.
 */
export function RegistrationFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const status = searchParams.get("status") ?? "";
  const paymentMethod = searchParams.get("paymentMethod") ?? "";
  const year = searchParams.get("year") ?? "";
  const section = searchParams.get("section") ?? "";
  const delivery = searchParams.get("delivery") ?? "";
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  function setParam(
    key: "q" | "status" | "paymentMethod" | "year" | "section" | "delivery",
    value: string,
  ) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    // 4th year has no E–G, so a section carried over from a bigger year would
    // filter on something that year can never hold.
    if (key === "year" && !(value ? sectionsFor(value) : allSections()).includes(section)) {
      params.delete("section");
    }
    // Any filter change re-shapes the result set, so the page number that
    // came with the old one is meaningless — narrowing to 1st year while
    // sitting on page 4 would otherwise land on an empty table that looks
    // like "nobody matched".
    params.delete("page");
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
          <Option key={option.value} value={option.value}>
            {option.label}
          </Option>
        ))}
      </select>

      <select
        value={year}
        onChange={(event) => setParam("year", event.target.value)}
        aria-label="Filter by year level"
        className="rounded-md border border-ground/20 bg-ground/5 px-3 py-2 text-sm text-ground outline-none focus:border-accent-2 focus:ring-2 focus:ring-accent-2/30 [color-scheme:dark]"
      >
        <Option value="">All years</Option>
        {YEAR_LEVELS.map((level) => (
          <Option key={level} value={level}>
            {level}
          </Option>
        ))}
      </select>

      <select
        value={section}
        onChange={(event) => setParam("section", event.target.value)}
        aria-label="Filter by section"
        className="rounded-md border border-ground/20 bg-ground/5 px-3 py-2 text-sm text-ground outline-none focus:border-accent-2 focus:ring-2 focus:ring-accent-2/30 [color-scheme:dark]"
      >
        <Option value="">All sections</Option>
        {(year ? sectionsFor(year) : allSections()).map((name) => (
          <Option key={name} value={name}>
            Section {name}
          </Option>
        ))}
      </select>

      <select
        value={paymentMethod}
        onChange={(event) => setParam("paymentMethod", event.target.value)}
        aria-label="Filter by payment method"
        className="rounded-md border border-ground/20 bg-ground/5 px-3 py-2 text-sm text-ground outline-none focus:border-accent-2 focus:ring-2 focus:ring-accent-2/30 [color-scheme:dark]"
      >
        {PAYMENT_METHOD_OPTIONS.map((option) => (
          <Option key={option.value} value={option.value}>
            {option.label}
          </Option>
        ))}
      </select>

      <select
        value={delivery}
        onChange={(event) => setParam("delivery", event.target.value)}
        aria-label="Filter by email delivery"
        className="rounded-md border border-ground/20 bg-ground/5 px-3 py-2 text-sm text-ground outline-none focus:border-accent-2 focus:ring-2 focus:ring-accent-2/30 [color-scheme:dark]"
      >
        {DELIVERY_OPTIONS.map((option) => (
          <Option key={option.value} value={option.value}>
            {option.label}
          </Option>
        ))}
      </select>
    </div>
  );
}
