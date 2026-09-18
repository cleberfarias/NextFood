"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import { ChefCharacter } from "./chef-character";

/**
 * The actual Three.js tree. Loaded exclusively through next/dynamic with
 * ssr:false (see login-experience.tsx) so none of this reaches the server
 * bundle or renders outside /login.
 *
 * Camera/lighting are a reasonable starting point -- expect to retune once
 * the real model's scale/orientation is visible in a running app, the same
 * way THROW_RELEASE_TIME is meant to be calibrated by eye.
 */
export default function LoginExperienceCanvas() {
  return (
    <Canvas camera={{ position: [0, 1.4, 3.2], fov: 35 }} dpr={[1, 2]}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 4, 2]} intensity={1.2} castShadow={false} />
      <Suspense fallback={null}>
        <ChefCharacter />
        <Environment preset="city" />
      </Suspense>
    </Canvas>
  );
}
