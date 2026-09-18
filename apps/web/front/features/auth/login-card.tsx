"use client";

import { motion } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/front/ui/card";
import { useLoginSequence } from "./login-sequence";
import { LoginForm } from "./login-form";

/**
 * Plain HTML/React, not part of the Three.js scene graph -- absolutely
 * positioned over the canvas. Reads the shared sequence to know when to
 * animate in; the "near the chef's hand" starting offset is a calibratable
 * approximation (like THROW_RELEASE_TIME) until the real model is visible
 * in a running app. Distance/rotation are deliberately large and the spring
 * deliberately underdamped (a small overshoot before settling) so the motion
 * reads as something being thrown across the screen, not just a fade-in.
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
