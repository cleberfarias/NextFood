"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import { LoopOnce, type Group } from "three";
import { ANIMATIONS, CARD_REVEAL_TIME, CHEF_MODEL_PATH } from "./chef-animations";
import { useLoginSequence } from "./login-sequence";

/**
 * Pure R3F/three -- no HTML/DOM here. Loads the chef model, drives the
 * enter -> restpose sequence (chef walks in carrying the card and stops),
 * and tells the shared sequence context exactly when (by the animation
 * clock, not a timer) the card should be revealed.
 */
export function ChefCharacter() {
  const group = useRef<Group>(null);
  const { scene, animations } = useGLTF(CHEF_MODEL_PATH);
  const { actions } = useAnimations(animations, group);
  const { stage, setStage } = useLoginSequence();
  const revealedRef = useRef(false);
  const settledRef = useRef(false);

  useEffect(() => {
    const enterAction = actions[ANIMATIONS.enter];
    if (!enterAction) return;

    enterAction.reset();
    enterAction.setLoop(LoopOnce, 1);
    enterAction.clampWhenFinished = true;
    enterAction.play();
    setStage("entering");

    return () => {
      enterAction.stop();
    };
    // Runs once the model (and its actions) are ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame(() => {
    if (stage !== "entering") return;

    const enterAction = actions[ANIMATIONS.enter];
    if (!enterAction) return;

    if (!revealedRef.current && enterAction.time >= CARD_REVEAL_TIME) {
      revealedRef.current = true;
      setStage("card-visible");
    }

    const duration = enterAction.getClip().duration;
    if (!settledRef.current && enterAction.time >= duration - 0.05) {
      settledRef.current = true;
      const idleAction = actions[ANIMATIONS.idle];
      idleAction?.reset().play();
      enterAction.crossFadeTo(idleAction ?? enterAction, 0.4, false);
      setStage("idle");
    }
  });

  return <primitive ref={group} object={scene} />;
}

useGLTF.preload(CHEF_MODEL_PATH);
