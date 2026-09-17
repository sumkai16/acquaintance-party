"use client";

import { useState, useTransition } from "react";
import { Badge } from "../badge";
import { Modal } from "../modal";
import { Table, Th, Tr } from "../table";
import { useFlash } from "../flash";
import { formatPeso } from "@/lib/config/event";
import type { Registration } from "@/lib/supabase/types";
import { completeWalkInBalanceAction } from "./actions";

/**
 * Walk-ins still waiting on their remaining balance. Lives on /admin/walk-in
 * rather than the Dashboard because staff — who are the ones actually
 * taking this cash — can't reach Find a registration; see admin/layout.tsx's
 * staff allowlist.
 */
export function OutstandingBalances({ registrations }: { registrations: Registration[] }) {
  if (registrations.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="mb-3 font-display text-xl uppercase text-ground/90">
        Outstanding balances
      </h2>
      <Table>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Paid / Owed</Th>
            <Th>Recorded</Th>
            <Th>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {registrations.map((registration) => (
            <BalanceRow key={registration.id} registration={registration} />
          ))}
        </tbody>
      </Table>
    </section>
  );
}

function BalanceRow({ registration }: { registration: Registration }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const flash = useFlash();
  const owed = registration.amount - registration.amount_paid;

  function handleComplete() {
    startTransition(async () => {
      const result = await completeWalkInBalanceAction(registration.id);
      if (!result.ok) {
        flash(result.error ?? "Something went wrong.", "error");
        setConfirming(false);
        return;
      }
      setConfirming(false);
      flash(`Recorded the balance for ${registration.full_name} — ticket emailed.`);
    });
  }

  return (
    <Tr>
      <td className="py-2 pr-3 pl-4">
        <p className="font-semibold">{registration.full_name}</p>
        <p className="text-ground/60">
          {registration.year_level} · Section {registration.section} · {registration.email}
        </p>
        <p className="text-ground/60">ID: {registration.student_id}</p>
      </td>
      <td className="py-2 pr-3 whitespace-nowrap">
        <Badge tone="amber">Partial payment</Badge>{" "}
        {formatPeso(registration.amount_paid)} / {formatPeso(registration.amount)}
      </td>
      <td className="py-2 pr-3 whitespace-nowrap text-ground/70">
        {new Date(registration.created_at).toLocaleString("en-PH")}
      </td>
      <td className="py-2 pl-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming(true)}
          className="font-semibold text-accent-2 underline disabled:opacity-50 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
        >
          Mark balance paid
        </button>

        {confirming ? (
          <Modal
            title={`Collect ${formatPeso(owed)} from ${registration.full_name}?`}
            onClose={() => setConfirming(false)}
          >
            <div className="flex flex-col gap-3">
              <p className="text-sm text-ground/60">
                Only confirm once you have the remaining {formatPeso(owed)} in hand — their QR
                is emailed immediately.
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={pending}
                  onClick={handleComplete}
                  className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {pending ? "Recording…" : "Confirm — balance paid"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="text-sm font-semibold text-ground/60 hover:text-ground"
                >
                  Cancel
                </button>
              </div>
            </div>
          </Modal>
        ) : null}
      </td>
    </Tr>
  );
}
