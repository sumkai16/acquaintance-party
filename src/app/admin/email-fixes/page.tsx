import Link from "next/link";
import { listEmailFixRequests } from "@/lib/email-fixes/queries";
import { formatDateTimePH } from "@/lib/format/datetime";
import { Table, Th, Tr } from "../table";
import { ResolveButton } from "./resolve-button";

export const metadata = { title: "Email fixes" };
export const dynamic = "force-dynamic";

const VALID_STATUSES = ["open", "resolved"] as const;

export default async function EmailFixesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: rawStatus } = await searchParams;
  const status = VALID_STATUSES.includes(rawStatus as (typeof VALID_STATUSES)[number])
    ? (rawStatus as (typeof VALID_STATUSES)[number])
    : "open";

  const requests = await listEmailFixRequests(status);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl uppercase">Email fixes</h1>
      <p className="mt-1 text-ground/70">
        Students who couldn&apos;t find their ticket on /find because the email on file is
        wrong. Verify, fix the address on the Dashboard, then mark it resolved here.
      </p>

      <div className="mt-6 flex gap-2">
        <Link
          href="/admin/email-fixes"
          className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
            status === "open"
              ? "bg-accent text-white"
              : "bg-ground/5 text-ground/70 hover:bg-ground/10"
          }`}
        >
          Open
        </Link>
        <Link
          href="/admin/email-fixes?status=resolved"
          className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
            status === "resolved"
              ? "bg-accent text-white"
              : "bg-ground/5 text-ground/70 hover:bg-ground/10"
          }`}
        >
          Resolved
        </Link>
      </div>

      <div className="mt-6">
        <Table
          empty={
            requests.length === 0
              ? status === "open"
                ? "No open requests. Everyone who's asked for a fix has one."
                : "Nothing resolved yet."
              : undefined
          }
        >
          <thead>
            <tr className="text-left">
              <Th>Student</Th>
              <Th>Requested email</Th>
              <Th>When</Th>
              <Th> </Th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <Tr key={request.id}>
                <td className="py-2 pr-3 pl-4">
                  <p className="font-semibold">{request.full_name}</p>
                  <p className="text-ground/60">{request.student_id}</p>
                  {request.registration_id ? (
                    <Link
                      href={`/admin/dashboard?q=${encodeURIComponent(request.student_id)}`}
                      className="font-medium text-accent-2 underline"
                    >
                      Find on Dashboard
                    </Link>
                  ) : (
                    <Link
                      href={`/admin/dashboard?q=${encodeURIComponent(request.full_name)}`}
                      className="font-medium text-amber-300 underline"
                      title="Their student ID didn't match anything — try searching by name instead."
                    >
                      No ID match — search by name
                    </Link>
                  )}
                </td>
                <td className="py-2 pr-3 font-mono break-all">{request.requested_email}</td>
                <td className="py-2 pr-3 whitespace-nowrap text-ground/70">
                  {formatDateTimePH(request.created_at)}
                </td>
                <td className="py-2 pr-3 last:pl-3">
                  {status === "open" ? (
                    <ResolveButton id={request.id} fullName={request.full_name} />
                  ) : (
                    <span className="text-sm text-ground/50">Resolved</span>
                  )}
                </td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>
    </main>
  );
}
