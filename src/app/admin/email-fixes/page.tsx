import Link from "next/link";
import { listEmailFixRequests } from "@/lib/email-fixes/queries";
import { formatDateTimePH } from "@/lib/format/datetime";
import type { EmailCorrectionRequest } from "@/lib/supabase/types";
import { Badge } from "../badge";
import { Table, Th, Tr } from "../table";
import { ResolveButton } from "./resolve-button";

export const metadata = { title: "Help requests" };
export const dynamic = "force-dynamic";

type Category = EmailCorrectionRequest["category"];

// Short admin-side labels; the student-facing sentences live in
// HELP_CATEGORIES. Amber is for problems that usually need a data change.
const CATEGORY_SHORT: Record<Category, string> = {
  wrong_email: "Wrong email",
  no_qr: "No QR email",
  paid_pending: "Paid, pending",
  qr_problem: "QR won't work",
  other: "Other",
};

const CATEGORY_TONE: Record<Category, "amber" | "slate"> = {
  wrong_email: "amber",
  no_qr: "slate",
  paid_pending: "amber",
  qr_problem: "slate",
  other: "slate",
};

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
      <h1 className="font-display text-3xl uppercase">Help requests</h1>
      <p className="mt-1 text-ground/70">
        QR problems students reported from /find. Check them on the Dashboard, fix what
        needs fixing (a wrong email, a pending payment, a resend), then mark it resolved here.
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
                ? "No open requests. Everyone who's asked for help has had it."
                : "Nothing resolved yet."
              : undefined
          }
        >
          <thead>
            <tr className="text-left">
              <Th>Student</Th>
              <Th>Problem</Th>
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
                <td className="py-2 pr-3">
                  <Badge tone={CATEGORY_TONE[request.category]}>
                    {CATEGORY_SHORT[request.category]}
                  </Badge>
                  {request.message ? (
                    <p className="mt-1.5 max-w-xs text-sm break-words text-ground/80">
                      {request.message}
                    </p>
                  ) : null}
                </td>
                <td className="py-2 pr-3 font-mono break-all">
                  {request.requested_email ?? <span className="text-ground/40">—</span>}
                </td>
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
