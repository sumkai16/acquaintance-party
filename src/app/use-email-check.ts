"use client";

import { useState } from "react";
import { emailProblem } from "@/lib/registrations/schema";

/**
 * Live email check shared by every form that takes an address, so they all
 * behave like the walk-in "Type a list" screen: a problem stays quiet while
 * someone is still typing in the box ("juan@g" isn't shouted at mid-word),
 * except a mistyped provider, which shows at once with a one-tap fix.
 */
export function useEmailCheck(value: string) {
  const [focused, setFocused] = useState(false);
  const problem = emailProblem(value);
  const message = problem && (!focused || problem.fix) ? problem.message : undefined;
  return {
    message,
    fix: message ? (problem?.fix ?? null) : null,
    focusProps: {
      onFocus: () => setFocused(true),
      onBlur: () => setFocused(false),
    },
  };
}
