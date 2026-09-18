"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

/**
 * Single source of truth for the login page's intro choreography. Both
 * ChefCharacter (drives/reads it inside the R3F tree) and LoginCard (reads
 * it in plain React) consume the same stage instead of coordinating through
 * independent timers -- see chef-animations.ts's CARD_REVEAL_TIME for how
 * the entering -> card-visible transition is actually triggered (tied to the
 * animation clock via useFrame, not a setTimeout guess).
 */
export type SequenceStage = "booting" | "entering" | "card-visible" | "idle";

type LoginSequenceContextValue = {
  stage: SequenceStage;
  setStage: (stage: SequenceStage) => void;
  skipChoreography: boolean;
};

const LoginSequenceContext = createContext<LoginSequenceContextValue | null>(null);

/**
 * `skipChoreography` covers every reason the chef's walk-in never plays:
 * reduced motion, no WebGL, or the GLB failing to load. In all of those
 * cases the card must appear in its resting state immediately.
 */
export function LoginSequenceProvider({
  children,
  skipChoreography,
}: {
  children: ReactNode;
  skipChoreography: boolean;
}) {
  const [stage, setStage] = useState<SequenceStage>(skipChoreography ? "card-visible" : "booting");
  const value = useMemo(() => ({ stage, setStage, skipChoreography }), [stage, skipChoreography]);

  return <LoginSequenceContext.Provider value={value}>{children}</LoginSequenceContext.Provider>;
}

export function useLoginSequence(): LoginSequenceContextValue {
  const ctx = useContext(LoginSequenceContext);
  if (!ctx) {
    throw new Error("useLoginSequence must be used within a LoginSequenceProvider");
  }
  return ctx;
}
