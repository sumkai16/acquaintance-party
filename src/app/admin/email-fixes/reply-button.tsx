"use client";

import { useState, useTransition } from "react";
import { useFlash } from "../flash";
import { Modal } from "../modal";
import { replyToHelp } from "./actions";

const REPLY_MAX = 1000;

/**
 * One reply per request — sending it also resolves the request. The student
 * reads it on their ticket page, and by email when there's a registration
 * to send it to.
 */
export function ReplyButton({
  id,
  fullName,
  problem,
  message,
  hasRegistration,
}: {
  id: string;
  fullName: string;
  problem: string;
  message: string | null;
  hasRegistration: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reply, setReply] = useState("");
  const [pending, startTransition] = useTransition();
  const flash = useFlash();

  function send() {
    startTransition(async () => {
      const result = await replyToHelp(id, reply);
      if (!result.ok) {
        flash(result.error, "error");
        return;
      }
      setOpen(false);
      setReply("");
      if (result.emailStatus === "sent") {
        flash(`Reply sent to ${fullName}.`);
      } else if (result.emailStatus === "failed") {
        flash(`Reply saved to ${fullName}'s ticket page, but the email failed.`, "error");
      } else if (result.emailStatus === "no_registration") {
        flash(`Reply saved, but ${fullName} has no matching registration to show it on.`, "error");
      } else {
        flash(`Reply saved to ${fullName}'s ticket page (email isn't configured).`);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-ground/30 px-4 py-2 text-sm font-semibold text-ground hover:bg-ground/10"
      >
        Reply
      </button>

      {open ? (
        <Modal title={`Reply to ${fullName}`} onClose={pending ? () => {} : () => setOpen(false)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
            className="flex flex-col gap-3"
          >
            <div className="rounded border border-ground/15 bg-ground/5 px-3 py-2 text-sm">
              <p className="font-semibold">{problem}</p>
              {message ? <p className="mt-1 break-words text-ground/70">{message}</p> : null}
            </div>
            <p className="text-sm text-ground/60">
              {hasRegistration
                ? "Shown on their ticket page and emailed to the address on their registration. One reply per request; sending it marks the request resolved."
                : "Their student ID matched no registration, so there's no ticket page or email to deliver this to. Find them on the Dashboard instead."}
            </p>
            <textarea
              autoFocus
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              maxLength={REPLY_MAX}
              rows={5}
              placeholder="e.g. Your payment is approved — your QR is on your ticket page now."
              aria-label={`Reply to ${fullName}`}
              className="rounded border border-ground/25 bg-deep px-3 py-2 text-sm placeholder:text-ground/40 focus:border-accent-3 focus:outline-2 focus:outline-offset-2 focus:outline-accent-3"
            />
            <p className="-mt-1 text-right text-xs text-ground/50">
              {reply.length}/{REPLY_MAX}
            </p>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={pending || !reply.trim()}
                className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {pending ? "Sending…" : "Send reply"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="text-sm font-semibold text-ground/60 hover:text-ground"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
