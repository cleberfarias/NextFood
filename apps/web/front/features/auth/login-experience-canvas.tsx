"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Bounds, Environment } from "@react-three/drei";
import { ChefCharacter } from "./chef-character";

/**
 * The actual Three.js tree. Loaded exclusively through next/dynamic with
 * ssr:false (see login-experience.tsx) so none of this reaches the server
 * bundle or renders outside /login.
 *
 * <Bounds fit clip observe> frames the camera on the chef's actual bounding
 * box instead of a hand-guessed camera position -- the model's real
 * scale/origin isn't known until it's visible in a running app, so this
 * avoids re-guessing numbers every time the asset changes.
 */
export default function LoginExperienceCanvas() {
  return (
    <Canvas camera={{ fov: 35 }} dpr={[1, 2]}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 4, 2]} intensity={1.2} castShadow={false} />
      <Suspense fallback={null}>
        <Bounds fit clip observe margin={1.4}>
          <ChefCharacter />
        </Bounds>
        <Environment preset="city" />
      </Suspense>
    </Canvas>
  );
}
