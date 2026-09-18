"use client";

import { useEffect } from "react";
import { animate, motion, useMotionValue } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/front/ui/card";
import { useLoginSequence } from "./login-sequence";
import { LoginForm } from "./login-form";

/**
 * Plain HTML/React, not part of the Three.js scene graph -- absolutely
 * positioned over the canvas. Position (x/y) is bound to handX/handY (see
 * login-sequence.tsx), which ChefCharacter updates every frame from the
 * hand bone's real screen position while "entering" -- the card visually
 * stays gripped in the hand for the whole wind-up, not just at a single
 * release instant.
 *
 * Every animated channel here (opacity/scale/rotation, plus handX/handY) is
 * a MotionValue driven imperatively via animate(), all bound through the
 * same `style` prop. Mixing that with the declarative `animate`/`initial`
 * props on the same element for overlapping transform channels (scale/
 * rotate vs x/y) turned out to silently drop the `animate`-prop values --
 * confirmed live (getComputedStyle stayed at the identity matrix the whole
 * time). One mechanism for the whole transform avoids that.
 */
const GRIPPED = { opacity: 1, scale: 0.22, rotateY: -18, rotateZ: 10 };
const RELEASED = { opacity: 1, scale: 1, rotateY: 0, rotateZ: 0 };
const SPRING = { type: "spring" as const, stiffness: 220, damping: 16, mass: 1 };

export function LoginCard() {
  const { stage, skipChoreography, handX, handY } = useLoginSequence();
  const released = skipChoreography || stage === "card-visible" || stage === "idle";

  const initial = skipChoreography ? RELEASED : GRIPPED;
  const opacity = useMotionValue(initial.opacity);
  const scale = useMotionValue(initial.scale);
  const rotateY = useMotionValue(initial.rotateY);
  const rotateZ = useMotionValue(initial.rotateZ);

  useEffect(() => {
    const target = released ? RELEASED : GRIPPED;

    if (skipChoreography) {
      opacity.set(target.opacity);
      scale.set(target.scale);
      rotateY.set(target.rotateY);
      rotateZ.set(target.rotateZ);
      handX.set(0);
      handY.set(0);
      return;
    }

    animate(opacity, target.opacity, SPRING);
    animate(scale, target.scale, SPRING);
    animate(rotateY, target.rotateY, SPRING);
    animate(rotateZ, target.rotateZ, SPRING);

    // The chef lets go: hand-tracking stops driving x/y (ChefCharacter only
    // updates them while stage is "entering"), so spring them the rest of
    // the way to the card's resting position instead of leaving them
    // wherever the hand last was.
    if (released) {
      animate(handX, 0, SPRING);
      animate(handY, 0, SPRING);
    }

    return () => {
      opacity.stop();
      scale.stop();
      rotateY.stop();
      rotateZ.stop();
      handX.stop();
      handY.stop();
    };
  }, [released, skipChoreography, opacity, scale, rotateY, rotateZ, handX, handY]);

  return (
    <motion.div style={{ x: handX, y: handY, opacity, scale, rotateY, rotateZ, transformPerspective: 800 }}>
      <Card className="w-full max-w-sm bg-white text-zinc-900">
        <CardHeader>
          <CardTitle className="text-2xl">
            <span className="text-zinc-900">Next</span>
            <span className="text-orange-500">Food</span>
          </CardTitle>
          <p className="text-sm text-zinc-500">Mais que um sistema, um ingrediente para o seu sucesso!</p>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </motion.div>
  );
}
