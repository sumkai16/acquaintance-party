"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFlash } from "../flash";
import { nowManilaLocal } from "@/lib/expenses/parse";
import { shrinkImage } from "@/lib/expenses/resize-image";
import { addExpense } from "./actions";

const inputClass =
  "w-full rounded border border-ground/25 bg-deep px-3 py-2.5 text-ground " +
  "placeholder:text-ground/40 focus:border-accent-2 focus:outline-2 " +
  "focus:outline-offset-2 focus:outline-accent-2 [color-scheme:dark]";

export function AddExpense({ onClose }: { onClose: () => void }) {
  const [itemName, setItemName] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"cash" | "gcash">("cash");
  const [spentAt, setSpentAt] = useState(nowManilaLocal);
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const flash = useFlash();

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function clearReceipt() {
    setReceipt(null);
    setPreviewUrl(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onPickReceipt(file: File | undefined) {
    if (!file) return clearReceipt();
    setPreparingPhoto(true);
    const shrunk = await shrinkImage(file);
    setPreparingPhoto(false);
    setReceipt(shrunk);
    setPreviewUrl(URL.createObjectURL(shrunk));
  }

  // Closing unmounts this form, which drops all of its state and (via the
  // effect above) revokes the preview URL.
  const reset = onClose;

  function submit(confirmed: boolean) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("itemName", itemName);
      formData.set("amount", amount);
      formData.set("method", method);
      formData.set("spentAt", spentAt);
      formData.set("confirmed", confirmed ? "true" : "false");
      if (receipt) formData.set("receipt", receipt);

      const result = await addExpense(formData);
      if (!result.ok) {
        if (result.needsConfirm) {
          setConfirmMessage(result.error);
          setError(null);
        } else {
          setError(result.error);
          setConfirmMessage(null);
        }
        return;
      }
      flash("Expense added.");
      reset();
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-ground/20 bg-ground/5 p-5">
      <h2 className="font-display text-xl uppercase">Add expense</h2>

      {error ? (
        <p role="alert" className="mt-3 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit(false);
        }}
        className="mt-4 flex flex-col gap-4"
      >
        <label className="flex flex-col gap-1.5">
          <span className="font-semibold text-ground">Item name</span>
          <input
            value={itemName}
            onChange={(event) => setItemName(event.target.value)}
            placeholder="Tarpaulin printing"
            required
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-semibold text-ground">Amount (₱)</span>
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            placeholder="150.00"
            required
            className={inputClass}
          />
        </label>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="font-semibold text-ground">Payment method</legend>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="method"
                checked={method === "cash"}
                onChange={() => setMethod("cash")}
              />
              Cash
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="method"
                checked={method === "gcash"}
                onChange={() => setMethod("gcash")}
              />
              GCash
            </label>
          </div>
        </fieldset>

        <label className="flex flex-col gap-1.5">
          <span className="font-semibold text-ground">Date &amp; time</span>
          <input
            type="datetime-local"
            value={spentAt}
            onChange={(event) => setSpentAt(event.target.value)}
            required
            className={inputClass}
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="expense-receipt" className="font-semibold text-ground">
            Receipt photo <span className="font-normal text-ground/50">(optional)</span>
          </label>
          {previewUrl ? (
            <div className="flex items-start gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- a local blob: preview, nothing for next/image to optimize */}
              <img
                src={previewUrl}
                alt="Receipt preview"
                className="h-28 w-auto max-w-[10rem] rounded border border-ground/20 object-contain"
              />
              <button
                type="button"
                onClick={clearReceipt}
                className="text-sm text-ground/70 underline"
              >
                Remove
              </button>
            </div>
          ) : null}
          <input
            ref={fileRef}
            id="expense-receipt"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(event) => onPickReceipt(event.target.files?.[0])}
            className={`text-sm text-ground/70 file:mr-3 file:rounded file:border-0 file:bg-ground/10 file:px-3 file:py-1.5 file:text-ground ${previewUrl ? "sr-only" : ""}`}
          />
          {preparingPhoto ? <p className="text-sm text-ground/60">Preparing photo…</p> : null}
        </div>

        {confirmMessage ? (
          <div className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-300">
            <p>{confirmMessage}</p>
            <div className="mt-2 flex gap-3">
              <button
                type="button"
                disabled={pending || preparingPhoto}
                onClick={() => submit(true)}
                className="rounded bg-accent px-4 py-1.5 text-xs font-semibold uppercase text-white disabled:opacity-60"
              >
                Save anyway
              </button>
              <button
                type="button"
                onClick={() => setConfirmMessage(null)}
                className="px-4 py-1.5 text-xs text-ground/70"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={pending || preparingPhoto}
              className="rounded bg-accent px-5 py-2.5 font-semibold text-white disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save expense"}
            </button>
            <button type="button" onClick={reset} className="px-5 py-2.5 text-ground/70">
              Cancel
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
