"use client";

import { createContext, useCallback, useContext, useState } from "react";

const FLASH_DURATION_MS = 4000;

type Tone = "success" | "error";
type FlashMessage = { id: string; tone: Tone; text: string };

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

  const dismiss = useCallback((id: string) => {
    setMessages((current) => current.filter((message) => message.id !== id));
  }, []);

  const flash = useCallback<FlashContextValue>(
    (text, tone = "success") => {
      const id = crypto.randomUUID();
      setMessages((current) => [...current, { id, tone, text }]);
      setTimeout(() => dismiss(id), FLASH_DURATION_MS);
    },
    [dismiss],
  );

  return (
    <FlashContext.Provider value={flash}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-4">
        {messages.map((message) => (
          <div
            key={message.id}
            role={message.tone === "error" ? "alert" : "status"}
            aria-live={message.tone === "error" ? "assertive" : "polite"}
            className={`pointer-events-auto flex max-w-sm items-start gap-3 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${
              message.tone === "error" ? "bg-red-700" : "bg-green-600"
            }`}
          >
            <p className="flex-1">{message.text}</p>
            <button
              type="button"
              onClick={() => dismiss(message.id)}
              aria-label="Dismiss"
              className="text-white/70 hover:text-white"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </FlashContext.Provider>
  );
}

/** Call to report a mutating action's outcome. Defaults to the success tone. */
export function useFlash(): FlashContextValue {
  const ctx = useContext(FlashContext);
  if (!ctx) throw new Error("useFlash must be used within FlashProvider");
  return ctx;
}
