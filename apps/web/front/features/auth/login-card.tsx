"use client";

import { motion } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/front/ui/card";
import { useLoginSequence } from "./login-sequence";
import { LoginForm } from "./login-form";

/**
 * Plain HTML/React, not part of the Three.js scene graph -- absolutely
 * positioned over the canvas. Reads the shared sequence to know when to
 * animate in. The chef grips the card and throws it down/across ("Grip_and_
 * Throw_Down"), so the motion is a sideways+rotating fling with an
 * underdamped spring (small overshoot before settling), not a straight
 * fade-in. Numbers are a calibratable approximation (like
 * THROW_RELEASE_TIME) until the real model is visible in a running app.
 */
const HIDDEN = { opacity: 0, scale: 0.2, rotateY: -40, rotateZ: 18, x: -320, y: 60 };
const VISIBLE = { opacity: 1, scale: 1, rotateY: 0, rotateZ: 0, x: 0, y: 0 };

export function LoginCard() {
  const { stage, skipChoreography } = useLoginSequence();
  const visible = skipChoreography || stage === "card-visible" || stage === "idle";

  return (
    <motion.div
      initial={skipChoreography ? VISIBLE : HIDDEN}
      animate={visible ? VISIBLE : HIDDEN}
      transition={skipChoreography ? { duration: 0 } : { type: "spring", stiffness: 220, damping: 16, mass: 1 }}
      style={{ transformPerspective: 800 }}
    >
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
