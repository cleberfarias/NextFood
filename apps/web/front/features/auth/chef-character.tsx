"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import { LoopOnce, Vector3, type Group, type Object3D } from "three";
import {
  ANIMATIONS,
  CHEF_MODEL_PATH,
  HAND_DESCENT_THRESHOLD_PX,
  THROW_HAND_BONE,
  THROW_RELEASE_TIME,
} from "./chef-animations";
import { useLoginSequence } from "./login-sequence";

/**
 * Pure R3F/three -- no HTML/DOM here. Loads the chef model, drives the
 * throwLogin -> restpose sequence, and while it plays, projects the hand
 * bone's real position to screen space every frame so LoginCard can move
 * with it (see login-sequence.tsx's handX/handY) instead of playing a
 * separately-timed animation alongside it.
 */
export function ChefCharacter() {
  const group = useRef<Group>(null);
  const { scene, animations } = useGLTF(CHEF_MODEL_PATH);
  const { actions } = useAnimations(animations, group);
  const { stage, setStage, handX, handY } = useLoginSequence();
  const { camera, size } = useThree();
  const releasedRef = useRef(false);
  const stabilizedRef = useRef(false);
  const settledRef = useRef(false);
  const handBoneRef = useRef<Object3D | null>(null);
  // Highest point (most negative screen Y) the hand bone has reached so
  // far, updated live every frame -- there's no reliable static "down"
  // pose to sample in advance (the model's bind pose before the mixer
  // runs doesn't match any pose the clip actually reaches), so "back down"
  // is measured relative to how high the hand actually got during this
  // playthrough instead of a pre-captured reference.
  const handPeakYRef = useRef<number | null>(null);
  const projected = useMemo(() => new Vector3(), []);

  useEffect(() => {
    const throwAction = actions[ANIMATIONS.throwLogin];
    if (!throwAction) return;

    // GLTFLoader strips ':' from node names -- the raw GLB has
    // "mixamorig:RightHand", the loaded scene has "mixamorigRightHand". See
    // THROW_HAND_BONE's own comment; verify against the loaded scene (not
    // just the GLB's JSON) if this ever needs to change again.
    handBoneRef.current = scene.getObjectByName(THROW_HAND_BONE) ?? null;

    throwAction.reset();
    throwAction.setLoop(LoopOnce, 1);
    throwAction.clampWhenFinished = true;
    throwAction.play();
    setStage("entering");

    return () => {
      throwAction.stop();
    };
    // Runs once the model (and its actions) are ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame(() => {
    const throwAction = actions[ANIMATIONS.throwLogin];
    if (!throwAction) return;

    // One hand-position read per frame, reused below -- while "entering" to
    // drive the card, and through "entering"/"thrown" to track how high the
    // hand actually gets (see handPeakYRef).
    let handScreenY: number | null = null;
    if (handBoneRef.current) {
      handBoneRef.current.getWorldPosition(projected);
      projected.project(camera);
      handScreenY = -projected.y * 0.5 * size.height;
    }

    if (stage === "entering" && handScreenY !== null) {
      handX.set(projected.x * 0.5 * size.width);
      handY.set(handScreenY);
    }

    if ((stage === "entering" || stage === "thrown") && handScreenY !== null) {
      handPeakYRef.current = handPeakYRef.current === null ? handScreenY : Math.min(handPeakYRef.current, handScreenY);
    }

    if (!releasedRef.current && throwAction.time >= THROW_RELEASE_TIME) {
      releasedRef.current = true;
      setStage("thrown");
    }

    // Once thrown, the card is animating on its own (see LoginCard) -- it
    // no longer follows the hand -- but we keep sampling the hand bone's
    // real screen height every frame, waiting for it to descend back
    // toward where it started from its peak, which is what actually ends
    // "thrown". Gated on `stage` (React state), not `releasedRef` (a plain
    // ref): the ref is already true the instant setStage("thrown") runs
    // above, so gating on it let this check fire on that same frame,
    // immediately calling setStage("card-visible") right behind it and
    // overwriting "thrown" before it ever rendered. `stage` here is a
    // stale closure value until React actually re-renders with "thrown",
    // which is exactly the one-frame delay needed.
    if (stage === "thrown" && !stabilizedRef.current && handScreenY !== null && handPeakYRef.current !== null) {
      if (handScreenY - handPeakYRef.current >= HAND_DESCENT_THRESHOLD_PX) {
        stabilizedRef.current = true;
        setStage("card-visible");
      }
    }

    // Deliberately NOT gated on `stage === "entering"`: the throw action
    // itself keeps advancing after release (React's stage state trails the
    // animation clock by up to a frame), and this check must still run to
    // ever reach "idle" -- gating it the same way as the tracking above
    // would permanently strand the chef in "card-visible".
    const duration = throwAction.getClip().duration;
    if (!settledRef.current && throwAction.time >= duration - 0.05) {
      settledRef.current = true;
      // Safety net: if the hand-down detection above never fired (clip's
      // follow-through doesn't return the bone close enough to its start
      // height), force the card to stabilize now rather than strand it
      // mid-toss when the chef freezes on the clip's last frame.
      if (!stabilizedRef.current) {
        stabilizedRef.current = true;
        setStage("card-visible");
      }
      const idleAction = actions[ANIMATIONS.idle];
      idleAction?.reset().play();
      throwAction.crossFadeTo(idleAction ?? throwAction, 0.4, false);
      setStage("idle");
    }
  });

  return <primitive ref={group} object={scene} />;
}

useGLTF.preload(CHEF_MODEL_PATH);
