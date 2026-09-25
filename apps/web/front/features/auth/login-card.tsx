"use client";

import { useEffect, useRef } from "react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/front/ui/card";
import { useLoginSequence } from "./login-sequence";
import { LoginForm } from "./login-form";

/**
 * Plain HTML/React, not part of the Three.js scene graph -- absolutely
 * positioned over the canvas. Position (x/y) is bound to handX/handY (see
 * login-sequence.tsx), which ChefCharacter updates every frame from the
 * hands' real screen position while "entering" -- the card visually stays
 * gripped between the hands for the whole wind-up, not just at a single
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
const GRIPPED = { opacity: 1, scale: 0.38, rotateY: -18, rotateZ: 10, rotateX: 0 };
const RELEASED = { opacity: 1, scale: 1, rotateY: 0, rotateZ: 0, rotateX: 0 };
const SPRING = { type: "spring" as const, stiffness: 220, damping: 16, mass: 1 };

// The card's neutral (0,0) position sits roughly chest-height, level with
// where the chef's hands rest once he's done -- settling exactly there read
// as sitting in/on top of the hands rather than below them.
const RELEASED_Y_OFFSET_PX = 90;

// One toss, like a chef flipping food out of a pan: a short dip-and-tilt
// back (anticipation), a single arc up and down, exactly one full flip
// around X timed to that arc so the card comes down already facing the
// viewer, then a brief squash on landing. The fall ends at the resting
// position itself, so there's no second slide into place afterwards.
// Looping the arc until the hand came down made it bounce 2-3 times
// (juggling, not a toss), and a free-running spin landed at a random angle
// that the settle spring then visibly corrected.
const ANTICIPATION = { dipPx: 24, tiltX: -18, duration: 0.14 };
const TOSS_RISE_PX = 170;
const TOSS_UP = { duration: 0.45, ease: "easeOut" as const };
const TOSS_DOWN = { duration: 0.5, ease: "easeIn" as const };
const FLIP = { duration: TOSS_UP.duration + TOSS_DOWN.duration, ease: "linear" as const };
const TOSS_TILT = -12;
const SQUASH = { scale: 0.94, duration: 0.07 };

function clamp01(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

export function LoginCard() {
  const { stage, skipChoreography, handX, handY } = useLoginSequence();
  const thrown = !skipChoreography && stage === "thrown";
  const released = skipChoreography || stage === "card-visible" || stage === "idle";

  const initial = skipChoreography ? RELEASED : GRIPPED;
  const opacity = useMotionValue(initial.opacity);
  const scale = useMotionValue(initial.scale);
  const rotateY = useMotionValue(initial.rotateY);
  const rotateZ = useMotionValue(initial.rotateZ);
  const rotateX = useMotionValue(initial.rotateX);
  // The toss runs to completion on its own once it starts. "thrown" usually
  // ends a few frames before the card lands, and letting the "released"
  // springs take over mid-fall inherited the flip's angular velocity --
  // measured live as a -800..-1100deg wobble right at the landing.
  const tossingRef = useRef(false);
  const unmountedRef = useRef(false);
  useEffect(() => {
    // Reset on (re)mount: StrictMode's dev-only mount/unmount/mount cycle
    // would otherwise leave this stuck at true and abort every toss.
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
    };
  }, []);

  // Ground shadow under the card's resting spot: invisible while the card is
  // still small in the chef's hands, faint and tight while it's high in the
  // air, full and wide once it's down.
  const shadowOpacity = useTransform([handY, scale], ([y, s]: number[]) => {
    const height = clamp01((RELEASED_Y_OFFSET_PX - y) / TOSS_RISE_PX);
    const grown = clamp01((s - 0.6) / 0.4);
    return (1 - height * 0.7) * grown * 0.4;
  });
  const shadowScale = useTransform(handY, (y) => 1 - clamp01((RELEASED_Y_OFFSET_PX - y) / TOSS_RISE_PX) * 0.5);

  useEffect(() => {
    if (skipChoreography) {
      opacity.set(RELEASED.opacity);
      scale.set(RELEASED.scale);
      rotateY.set(RELEASED.rotateY);
      rotateZ.set(RELEASED.rotateZ);
      rotateX.set(RELEASED.rotateX);
      handX.set(0);
      handY.set(0);
      return;
    }

    if (thrown) {
      if (tossingRef.current) return;
      tossingRef.current = true;
      const startY = handY.get();
      animate(opacity, RELEASED.opacity, SPRING);
      animate(rotateY, RELEASED.rotateY, SPRING);
      animate(handX, 0, SPRING);

      (async () => {
        await Promise.all([
          animate(handY, startY + ANTICIPATION.dipPx, { duration: ANTICIPATION.duration, ease: "easeOut" }),
          animate(rotateX, ANTICIPATION.tiltX, { duration: ANTICIPATION.duration, ease: "easeOut" }),
        ]);
        if (unmountedRef.current) return;

        animate(scale, RELEASED.scale, SPRING);
        animate(rotateZ, TOSS_TILT, SPRING);
        animate(rotateX, 360, FLIP);
        await animate(handY, startY - TOSS_RISE_PX, TOSS_UP);
        if (unmountedRef.current) return;
        await animate(handY, RELEASED_Y_OFFSET_PX, TOSS_DOWN);
        if (unmountedRef.current) return;

        // 360deg and 0deg are the same pose; jump() (not set()) so the
        // flip's velocity isn't carried into anything that animates this
        // value later.
        rotateX.jump(0);
        animate(rotateZ, RELEASED.rotateZ, SPRING);
        await animate(scale, SQUASH.scale, { duration: SQUASH.duration, ease: "easeOut" });
        if (unmountedRef.current) return;
        await animate(scale, RELEASED.scale, SPRING);
        tossingRef.current = false;
      })();
      return;
    }

    // The toss above lands every channel on RELEASED by itself.
    if (tossingRef.current) return;

    const target = released ? RELEASED : GRIPPED;
    animate(opacity, target.opacity, SPRING);
    animate(scale, target.scale, SPRING);
    animate(rotateY, target.rotateY, SPRING);
    animate(rotateZ, target.rotateZ, SPRING);
    animate(rotateX, target.rotateX, SPRING);

    // The chef lets go: hand-tracking stops driving x/y (ChefCharacter only
    // updates them while stage is "entering"), so spring them the rest of
    // the way to the card's resting position -- a no-op when the toss above
    // already landed there, a catch-up when "thrown" ended mid-air.
    if (released) {
      animate(handX, 0, SPRING);
      animate(handY, RELEASED_Y_OFFSET_PX, SPRING);
    }

    return () => {
      opacity.stop();
      scale.stop();
      rotateY.stop();
      rotateZ.stop();
      rotateX.stop();
      handX.stop();
      handY.stop();
    };
  }, [thrown, released, skipChoreography, opacity, scale, rotateY, rotateZ, rotateX, handX, handY]);

  return (
    <div className="relative">
      {skipChoreography ? null : (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-4 left-1/2 h-6 w-[70%] rounded-[50%] bg-black blur-md"
          style={{ x: "-50%", y: RELEASED_Y_OFFSET_PX, opacity: shadowOpacity, scaleX: shadowScale }}
        />
      )}
      <motion.div className="relative" style={{ x: handX, y: handY, opacity, scale, rotateY, rotateZ, rotateX, transformPerspective: 800 }}>
        <Card className="theme-light w-full max-w-sm bg-white text-zinc-900">
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
    </div>
  );
}
