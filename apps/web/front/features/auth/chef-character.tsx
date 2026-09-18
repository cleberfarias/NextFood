"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import { LoopOnce, type Group } from "three";
import { ANIMATIONS, CHEF_MODEL_PATH, THROW_RELEASE_TIME } from "./chef-animations";
import { useLoginSequence } from "./login-sequence";

/**
 * Pure R3F/three -- no HTML/DOM here. Loads the chef model, drives the
 * throwLogin -> restpose sequence, and tells the shared sequence context
 * exactly when (by the animation clock, not a timer) the card should
 * "release" from the chef's hand.
 */
export function ChefCharacter() {
  const group = useRef<Group>(null);
  const { scene, animations } = useGLTF(CHEF_MODEL_PATH);
  const { actions } = useAnimations(animations, group);
  const { stage, setStage } = useLoginSequence();
  const releasedRef = useRef(false);
  const settledRef = useRef(false);

  useEffect(() => {
    const throwAction = actions[ANIMATIONS.throwLogin];
    if (!throwAction) return;

    throwAction.reset();
    throwAction.setLoop(LoopOnce, 1);
    throwAction.clampWhenFinished = true;
    throwAction.play();
    setStage("throwing");

    return () => {
      throwAction.stop();
    };
    // Runs once the model (and its actions) are ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame(() => {
    if (stage !== "throwing") return;

    const throwAction = actions[ANIMATIONS.throwLogin];
    if (!throwAction) return;

    if (!releasedRef.current && throwAction.time >= THROW_RELEASE_TIME) {
      releasedRef.current = true;
      setStage("card-visible");
    }

    const duration = throwAction.getClip().duration;
    if (!settledRef.current && throwAction.time >= duration - 0.05) {
      settledRef.current = true;
      const idleAction = actions[ANIMATIONS.idle];
      idleAction?.reset().play();
      throwAction.crossFadeTo(idleAction ?? throwAction, 0.4, false);
      setStage("idle");
    }
  });

  return <primitive ref={group} object={scene} />;
}

useGLTF.preload(CHEF_MODEL_PATH);
