"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useMotionValue, type MotionValue } from "motion/react";

/**
 * Single source of truth for the login page's intro choreography. Both
 * ChefCharacter (drives/reads it inside the R3F tree) and LoginCard (reads
 * it in plain React) consume the same stage instead of coordinating through
 * independent timers -- see chef-animations.ts's THROW_RELEASE_TIME for how
 * the entering -> card-visible transition is actually triggered (tied to the
 * animation clock via useFrame, not a setTimeout guess). "entering" is
 * deliberately named for the phase, not the specific motion (throw, walk-in,
 * ...) -- that's kept out of shared state so the entrance animation can
 * change without renaming this.
 *
 * handX/handY: the chef's hand bone position, projected to screen space and
 * updated every frame by ChefCharacter *while* stage is "entering" -- this
 * is how the card's position stays genuinely synchronized with the hand's
 * motion instead of playing a pre-baked animation alongside it. They're
 * MotionValues (not React state) specifically so a 60fps update doesn't
 * trigger a React re-render on every frame; LoginCard binds to them via
 * `style`, which Motion updates directly in the DOM.
 *
 * "thrown" sits between "entering" and "card-visible": the card has left
 * the hand and is tumbling on its own (LoginCard drives that motion, not
 * hand tracking) while ChefCharacter keeps watching the hand bone's real
 * height every frame, waiting for it to come back down before advancing to
 * "card-visible".
 */
export type SequenceStage = "booting" | "entering" | "thrown" | "card-visible" | "idle";

type LoginSequenceContextValue = {
  stage: SequenceStage;
  setStage: (stage: SequenceStage) => void;
  skipChoreography: boolean;
  handX: MotionValue<number>;
  handY: MotionValue<number>;
};

const LoginSequenceContext = createContext<LoginSequenceContextValue | null>(null);

/**
 * `skipChoreography` covers every reason the chef's entrance animation never
 * plays: reduced motion, no WebGL, or the GLB failing to load. In all of
 * those cases the card must appear in its resting state immediately.
 */
export function LoginSequenceProvider({
  children,
  skipChoreography,
}: {
  children: ReactNode;
  skipChoreography: boolean;
}) {
  const [stage, setStage] = useState<SequenceStage>(skipChoreography ? "card-visible" : "booting");
  const handX = useMotionValue(0);
  const handY = useMotionValue(0);
  const value = useMemo(
    () => ({ stage, setStage, skipChoreography, handX, handY }),
    [stage, skipChoreography, handX, handY],
  );

  return <LoginSequenceContext.Provider value={value}>{children}</LoginSequenceContext.Provider>;
}

export function useLoginSequence(): LoginSequenceContextValue {
  const ctx = useContext(LoginSequenceContext);
  if (!ctx) {
    throw new Error("useLoginSequence must be used within a LoginSequenceProvider");
  }
  return ctx;
}
