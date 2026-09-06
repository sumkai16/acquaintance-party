"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

const FLASH_DURATION_MS = 5000;
/** Must match the transition duration below — the exit animation plays
 * before the message actually leaves the array. */
const EXIT_ANIMATION_MS = 200;

type Tone = "success" | "error";
type FlashMessage = { id: string; tone: Tone; text: string; leaving: boolean };

type FlashContextValue = (text: string, tone?: Tone) => void;
const FlashContext = createContext<FlashContextValue | null>(null);

/**
 * The one place every mutating admin action reports its outcome — success
 * or failure — so nothing goes silent. Same context+hook shape as
 * NavVisibilityProvider/useSetNavHidden in admin-nav.tsx. Wraps every
 * non-login admin route from admin/layout.tsx.
 */
export function FlashProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<FlashMessage[]>([]);

  const remove = useCallback((id: string) => {
    setMessages((current) => current.filter((message) => message.id !== id));
  }, []);

  const dismiss = useCallback(
    (id: string) => {
      setMessages((current) =>
        current.map((message) => (message.id === id ? { ...message, leaving: true } : message)),
      );
      setTimeout(() => remove(id), EXIT_ANIMATION_MS);
    },
    [remove],
  );

  const flash = useCallback<FlashContextValue>(
    (text, tone = "success") => {
      const id = crypto.randomUUID();
      setMessages((current) => [...current, { id, tone, text, leaving: false }]);
      setTimeout(() => dismiss(id), FLASH_DURATION_MS);
    },
    [dismiss],
  );

  return (
    <FlashContext.Provider value={flash}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-4">
        {messages.map((message) => (
          <FlashToast key={message.id} message={message} onDismiss={() => dismiss(message.id)} />
        ))}
      </div>
    </FlashContext.Provider>
  );
}

function FlashToast({
  message,
  onDismiss,
}: {
  message: FlashMessage;
  onDismiss: () => void;
}) {
  const [entered, setEntered] = useState(false);

  // Mount closed, flip open a frame later — gives the enter transition
  // something to animate from instead of snapping in, and starts the
  // progress bar's width transition at the same moment the dismiss timer
  // above actually starts counting.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const visible = entered && !message.leaving;
  const tone = message.tone;

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={`pointer-events-auto w-full max-w-sm overflow-hidden rounded-xl shadow-xl ring-1 ring-white/15 transition-all duration-300 ease-out ${
        visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
      } ${
        tone === "error"
          ? "bg-gradient-to-br from-red-600 to-red-700"
          : "bg-gradient-to-br from-green-600 to-green-700"
      }`}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <ToneIcon tone={tone} />
        <p className="flex-1 pt-0.5 text-sm font-medium text-white">{message.text}</p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-m-1 shrink-0 rounded p-1 text-white/70 transition-colors hover:text-white"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {/* Progress bar: starts full, animates to empty over FLASH_DURATION_MS —
          a visual countdown to when the toast dismisses itself. */}
      <div className="h-1 w-full bg-black/20">
        <div
          className="h-full bg-white/60"
          style={{
            width: entered ? "0%" : "100%",
            transitionProperty: "width",
            transitionTimingFunction: "linear",
            transitionDuration: entered ? `${FLASH_DURATION_MS}ms` : "0ms",
          }}
        />
      </div>
    </div>
  );
}

function ToneIcon({ tone }: { tone: Tone }) {
  return (
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20">
      {tone === "error" ? (
        <svg viewBox="0 0 20 20" fill="none" className="h-3 w-3">
          <path
            d="M10 6v4.5M10 13.5h.01"
            stroke="white"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" fill="none" className="h-3 w-3">
          <path
            d="M5 10.5l3.2 3.2L15 6.5"
            stroke="white"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  );
}

/** Call to report a mutating action's outcome. Defaults to the success tone. */
export function useFlash(): FlashContextValue {
  const ctx = useContext(FlashContext);
  if (!ctx) throw new Error("useFlash must be used within FlashProvider");
  return ctx;
}
