import Link from "next/link";
import { allScans, approvedCount } from "@/lib/scans/queries";
import { findDoubleScans, summarize } from "@/lib/scans/report";

export const metadata = { title: "Attendance" };
// Attendance changes every few seconds during the event; never serve a cached
// count to someone deciding whether to open the doors wider.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [scans, sold] = await Promise.all([allScans(), approvedCount()]);
  const summary = summarize(scans, sold);
  const doubles = findDoubleScans(scans);

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Attendance</h1>
        <div className="flex gap-3 text-sm">
          <Link href="/admin/scan" className="underline">
            Scanner
          </Link>
          <Link href="/admin/review" className="underline">
            Review queue
          </Link>
          <Link href="/admin/raffle" className="underline">
            Raffle
          </Link>
          <a href="/admin/dashboard/export" className="underline">
            Download .xlsx
          </a>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Checked in" value={summary.checkedIn} />
        <Stat label="Tickets sold" value={sold} />
        <Stat label="Not yet arrived" value={summary.notYetArrived} />
        <Stat label="Invalid scans" value={summary.invalid} />
      </dl>

      {doubles.length > 0 ? (
        <section className="mt-8 rounded border border-red-300 bg-red-50 p-4">
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

      <h2 className="mt-8 font-bold">Recent scans</h2>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-left">
              <th className="py-2 pr-3">Time</th>
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Result</th>
              <th className="py-2 pr-3">Door</th>
              <th className="py-2">Code</th>
            </tr>
          </thead>
          <tbody>
            {scans.slice(0, 100).map((scan, i) => (
              <tr key={`${scan.codeScanned}-${i}`} className="border-b border-slate-200">
                <td className="py-1.5 pr-3 whitespace-nowrap">
                  {new Date(scan.scannedAt).toLocaleTimeString("en-PH", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </td>
                <td className="py-1.5 pr-3">{scan.fullName ?? "—"}</td>
                <td className="py-1.5 pr-3">{scan.result}</td>
                <td className="py-1.5 pr-3">{scan.deviceLabel}</td>
                <td className="py-1.5 font-mono text-xs">{scan.codeScanned}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {scans.length === 0 ? (
          <p className="py-6 text-slate-600">
            No scans yet. They appear here as soon as a scanner syncs.
          </p>
        ) : null}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-slate-300 bg-white p-4">
      <dt className="text-sm text-slate-600">{label}</dt>
      <dd className="text-3xl font-bold tabular-nums">{value}</dd>
    </div>
  );
}
