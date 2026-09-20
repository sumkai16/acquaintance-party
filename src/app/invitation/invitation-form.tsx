"use client";

import { useActionState, useCallback, useState } from "react";
import { MAX_DEPARTMENT_LENGTH } from "@/lib/faculty/schema";
import { submitAcknowledgement, type FormState } from "./actions";
import { useModal } from "./use-modal";
import styles from "./letter.module.css";

const initial: FormState = { status: "idle", attempt: 0 };

/**
 * The gold call to action under the banner, and the form it opens.
 *
 * Design 11a puts the form in a modal rather than inline: the letter is the
 * whole point of the page and a form stacked under it competes with the
 * reading. Tapping the button is the first half of the acknowledgement and
 * the tick inside is the second — the tick is what gets recorded, and the
 * server re-checks it on every submit (see submitAcknowledgement), so the
 * two are not merely decorative duplication.
 */
export function InvitationForm() {
  const [state, action, pending] = useActionState(submitAcknowledgement, initial);
  const [open, setOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const closeRef = useModal(open, close);
  const errors = state.fieldErrors ?? {};
  const entered = state.status === "entered";

  // Same remount-on-attempt trick as checkout-form.tsx: React resets an
  // uncontrolled field when the action finishes without redirecting, so
  // keying on the attempt number restores what they actually typed.
  const keyed = (name: string) => `${name}-${state.attempt}`;

  if (entered) {
    return (
      <div className={styles.entered} role="status">
        <p className={styles.enteredTitle}>You&apos;re on the list</p>
        <p className={styles.enteredBody}>
          {state.message} The giveaway is drawn during the programme.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className={styles.actions}>
        <button type="button" onClick={() => setOpen(true)} className={styles.cta}>
          I Have Read This Letter
        </button>
      </div>

      {open ? (
        <div
          className={styles.overlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          // Clicking the backdrop closes; clicks inside the card must not.
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className={styles.modal}>
            <button
              ref={closeRef}
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className={styles.close}
            >
              ×
            </button>

            <h2 id="confirm-title" className={styles.modalTitle}>
              Confirm and Enter
            </h2>
            <p className={styles.modalIntro}>
              Tick the box, then give your name. That&apos;s your entry to the
              faculty giveaway.
            </p>

            <form action={action} noValidate>
              {state.message ? (
                <p role="alert" className={styles.formError}>
                  {state.message}
                </p>
              ) : null}

              <label className={styles.tick}>
                <input
                  type="checkbox"
                  name="acknowledged"
                  checked={acknowledged}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                />
                <span>I have read this letter of invitation.</span>
              </label>
              {errors.acknowledged ? (
                <p className={styles.error}>{errors.acknowledged}</p>
              ) : null}

              <label htmlFor="fullName" className={styles.label}>
                Your full name
              </label>
              <input
                key={keyed("fullName")}
                id="fullName"
                name="fullName"
                required
                autoComplete="name"
                placeholder="Juana D. Santos"
                defaultValue={state.values?.fullName ?? ""}
                className={styles.input}
              />
              {errors.fullName ? (
                <p className={styles.error}>{errors.fullName}</p>
              ) : null}

              <label htmlFor="department" className={styles.label}>
                Department <span className={styles.optional}>(optional)</span>
              </label>
              <input
                key={keyed("department")}
                id="department"
                name="department"
                maxLength={MAX_DEPARTMENT_LENGTH}
                placeholder="e.g. BSIT"
                defaultValue={state.values?.department ?? ""}
                className={styles.input}
              />
              {errors.department ? (
                <p className={styles.error}>{errors.department}</p>
              ) : null}

              <button
                type="submit"
                disabled={pending || !acknowledged}
                className={styles.submit}
              >
                {pending ? "Sending…" : "Confirm and Enter"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
