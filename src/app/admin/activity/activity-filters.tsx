"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ACTIVITY_TYPES, describeActivity } from "@/lib/activity/types";
import { Option } from "../option";

const QUERY_DEBOUNCE_MS = 300;

const RANGE_OPTIONS = [
  { value: "", label: "All time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "custom", label: "Custom Date Range" },
] as const;

type Account = { id: string; fullName: string; role: "admin" | "staff" };

/**
 * `accounts` is omitted on the staff "My Activity" page — that log is
 * already scoped to one person server-side, so there's nothing for an
 * account picker to filter between.
 */
export function ActivityFilters({ accounts }: { accounts?: Account[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const range = searchParams.get("range") ?? "";
  const userId = searchParams.get("userId") ?? "";
  const activityType = searchParams.get("activityType") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  function setParam(key: string, value: string) {
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

  const selectClass =
    "rounded-md border border-ground/20 bg-ground/5 px-3 py-2 text-sm text-ground outline-none focus:border-accent-2 focus:ring-2 focus:ring-accent-2/30 [color-scheme:dark]";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={range}
        onChange={(event) => setParam("range", event.target.value)}
        aria-label="Filter by date"
        className={selectClass}
      >
        {RANGE_OPTIONS.map((option) => (
          <Option key={option.value} value={option.value}>
            {option.label}
          </Option>
        ))}
      </select>

      {range === "custom" ? (
        <>
          <input
            type="date"
            value={from}
            onChange={(event) => setParam("from", event.target.value)}
            aria-label="From date"
            className={selectClass}
          />
          <input
            type="date"
            value={to}
            onChange={(event) => setParam("to", event.target.value)}
            aria-label="To date"
            className={selectClass}
          />
        </>
      ) : null}

      {accounts ? (
        <select
          value={userId}
          onChange={(event) => setParam("userId", event.target.value)}
          aria-label="Filter by account"
          className={selectClass}
        >
          <Option value="">All Accounts</Option>
          {accounts.map((person) => (
            <Option key={person.id} value={person.id}>
              {person.fullName} ({person.role === "admin" ? "Admin" : "Staff"})
            </Option>
          ))}
        </select>
      ) : null}

      <select
        value={activityType}
        onChange={(event) => setParam("activityType", event.target.value)}
        aria-label="Filter by activity type"
        className={selectClass}
      >
        <Option value="">All Activities</Option>
        {ACTIVITY_TYPES.map((type) => (
          <Option key={type} value={type}>
            {describeActivity(type)}
          </Option>
        ))}
      </select>

      <input
        value={q}
        onChange={(event) => setQ(event.target.value)}
        placeholder="Search Transaction ID, Student Name, ID..."
        aria-label="Search activity"
        className={`${selectClass} placeholder:text-ground/40`}
      />
    </div>
  );
}
