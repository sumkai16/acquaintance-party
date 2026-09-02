import Link from "next/link";
import { Badge } from "../badge";
import { allScans, approvedCount } from "@/lib/scans/queries";
import { findDoubleScans, sortScans, summarize, type SortColumn } from "@/lib/scans/report";

export const metadata = { title: "Attendance" };
// Attendance changes every few seconds during the event; never serve a cached
// count to someone deciding whether to open the doors wider.
export const dynamic = "force-dynamic";

const COLUMNS: { key: SortColumn; label: string }[] = [
  { key: "time", label: "Time" },
  { key: "name", label: "Name" },
  { key: "result", label: "Result" },
  { key: "door", label: "Door" },
];

const RESULT_TONE = { ok: "green", duplicate: "amber", invalid: "red" } as const;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string }>;
}) {
  const { sort, dir } = await searchParams;
  const [rawScans, sold] = await Promise.all([allScans(), approvedCount()]);
  const summary = summarize(rawScans, sold);
  const doubles = findDoubleScans(rawScans);

  const sortColumn = COLUMNS.some((c) => c.key === sort) ? (sort as SortColumn) : null;
  const direction = dir === "asc" ? "asc" : "desc";
  // No sort param: today's default, newest-first from the query itself.
  const scans = sortColumn ? sortScans(rawScans, sortColumn, direction) : rawScans;

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Attendance</h1>
          <p className="text-slate-500">Live counts from every door scanner.</p>
        </div>
        <a
          href="/admin/dashboard/export"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Download .xlsx
        </a>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Checked in" value={summary.checkedIn} />
        <Stat label="Tickets sold" value={sold} />
        <Stat label="Not yet arrived" value={summary.notYetArrived} />
        <Stat label="Invalid scans" value={summary.invalid} />
      </dl>

      {doubles.length > 0 ? (
        <section className="mt-8 rounded-lg border border-red-300 bg-red-50 p-4">
          <h2 className="font-bold text-red-800">
            {doubles.length} ticket{doubles.length === 1 ? "" : "s"} admitted at
            more than one door
          </h2>
          <p className="mt-1 text-sm text-red-800">
            This can happen when devices are offline and cannot see each
            other&apos;s scans. Check these students in person.
          </p>
          <ul className="mt-3 space-y-1 text-sm">
            {doubles.map((double) => (
              <li key={double.registrationId}>
                <strong>{double.fullName ?? "Unknown"}</strong> —{" "}
                {double.devices.join(", ")}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <h2 className="mt-8 text-lg font-semibold">Recent scans</h2>
      <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left">
              {COLUMNS.map((col) => {
                const nextDir =
                  sortColumn === col.key && direction === "asc" ? "desc" : "asc";
                const isActive = sortColumn === col.key;
                return (
                  <th key={col.key} className="py-2 pr-3 pl-3 first:pl-4">
                    <Link
                      href={`?sort=${col.key}&dir=${nextDir}`}
                      className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-slate-900 focus:outline-2 focus:outline-offset-2 focus:outline-slate-500"
                    >
                      {col.label}
                      {isActive ? (
                        <span aria-hidden>{direction === "asc" ? "↑" : "↓"}</span>
                      ) : null}
                    </Link>
                  </th>
                );
              })}
              <th className="py-2 pl-3">Code</th>
            </tr>
          </thead>
          <tbody>
            {scans.slice(0, 100).map((scan, i) => (
              <tr
                key={`${scan.codeScanned}-${i}`}
                className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
              >
                <td className="py-2 pr-3 pl-4 whitespace-nowrap">
                  {new Date(scan.scannedAt).toLocaleTimeString("en-PH", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </td>
                <td className="py-2 pr-3">{scan.fullName ?? "—"}</td>
                <td className="py-2 pr-3">
                  <Badge tone={RESULT_TONE[scan.result]}>{scan.result}</Badge>
                </td>
                <td className="py-2 pr-3">{scan.deviceLabel}</td>
                <td className="py-2 pl-3 font-mono text-xs text-slate-500">
                  {scan.codeScanned}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {scans.length === 0 ? (
          <p className="px-4 py-6 text-slate-600">
            No scans yet. They appear here as soon as a scanner syncs.
          </p>
        ) : null}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-3xl font-bold tabular-nums">{value}</dd>
    </div>
  );
}
