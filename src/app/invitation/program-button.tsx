"use client";

import { useCallback, useState } from "react";
import { PROGRAM } from "@/lib/faculty/letter";
import { useModal } from "./use-modal";
import styles from "./letter.module.css";

/**
 * The evening's running order, opened from a link under the letter.
 *
 * A sheet rather than more letter: the letter is sized to fit one screen with
 * its button, and a program this long would push both below the fold. The
 * sheet scrolls inside itself, so the page behind never does.
 */
export function ProgramButton() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const closeRef = useModal(open, close);

  return (
    <>
      <div className={styles.programRow}>
        <button type="button" onClick={() => setOpen(true)} className={styles.programLink}>
          Program of the evening
        </button>
      </div>

      {open ? (
        <div
          className={styles.overlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="program-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div className={styles.sheet}>
            <button
              ref={closeRef}
              type="button"
              onClick={close}
              aria-label="Close"
              className={styles.close}
            >
              ×
            </button>

            <h2 id="program-title" className={styles.modalTitle}>
              Program of the Evening
            </h2>

            {PROGRAM.map((part) => (
              <section key={part.title} className={styles.part}>
                <h3 className={styles.partTitle}>{part.title}</h3>

                {part.slots.map((slot) => (
                  <div key={slot.time} className={styles.slot}>
                    <p className={styles.slotHead}>
                      <span className={styles.slotTime}>{slot.time}</span>
                      <span className={styles.slotTitle}>{slot.title}</span>
                    </p>
                    <ul className={styles.slotItems}>
                      {slot.items.map((item) => (
                        <li key={item.label + (item.who ?? "")}>
                          {item.label}
                          {item.who ? (
                            <span className={styles.slotWho}> — {item.who}</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}
