"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import { LoopOnce, Vector3, type Group, type Object3D } from "three";
import { ANIMATIONS, CHEF_MODEL_PATH, THROW_HAND_BONE, THROW_RELEASE_TIME } from "./chef-animations";
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
  const settledRef = useRef(false);
  const handBoneRef = useRef<Object3D | null>(null);
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

    // Hand-tracking only matters up to release -- stops updating once the
    // card is free, matching the domain rule (stage gate here is correct).
    if (stage === "entering" && handBoneRef.current) {
      handBoneRef.current.getWorldPosition(projected);
      projected.project(camera);
      handX.set(projected.x * 0.5 * size.width);
      handY.set(-projected.y * 0.5 * size.height);
    }

    if (!releasedRef.current && throwAction.time >= THROW_RELEASE_TIME) {
      releasedRef.current = true;
      setStage("card-visible");
    }

    // Deliberately NOT gated on `stage === "entering"`: the throw action
    // itself keeps advancing after release (React's stage state trails the
    // animation clock by up to a frame), and this check must still run to
    // ever reach "idle" -- gating it the same way as the tracking above
    // would permanently strand the chef in "card-visible".
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
