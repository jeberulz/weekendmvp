"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * How the signed-in editor confirms it's them again (WP46-E4e): a fresh
 * sign-in with the account's own method. Present only in the live workspace;
 * the local demo has no provider and simulates the step instead.
 */
export type StepUp = {
  method: "google" | "email" | null;
  /** The account's own address, for its own email sign-in link. */
  email: string | null;
};

const StepUpContext = createContext<StepUp | null>(null);

export function StepUpProvider({ value, children }: { value: StepUp; children: ReactNode }) {
  return <StepUpContext.Provider value={value}>{children}</StepUpContext.Provider>;
}

export function useStepUp(): StepUp | null {
  return useContext(StepUpContext);
}
