"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { isWebGLAvailable } from "@/front/lib/webgl";
import { usePrefersReducedMotion } from "@/front/lib/use-prefers-reduced-motion";
import { LoginSequenceProvider } from "./login-sequence";
import { LoginCard } from "./login-card";
import { ThreeErrorBoundary } from "./three-error-boundary";

// Three.js/WebGL only ever loads on /login, never server-rendered, never
// bundled into other routes.
const LoginExperienceCanvas = dynamic(() => import("./login-experience-canvas"), {
  ssr: false,
  loading: () => null,
});

type WebglState = "checking" | "available" | "unavailable";

export function LoginExperience() {
  const prefersReducedMotion = usePrefersReducedMotion();
  // WebGL detection touches `document`, which doesn't exist during SSR --
  // it must run client-side only, inside an effect, never during render.
  const [webglState, setWebglState] = useState<WebglState>("checking");

  useEffect(() => {
    setWebglState(isWebGLAvailable() ? "available" : "unavailable");
  }, []);

  if (webglState === "checking") {
    return <div className="min-h-screen bg-zinc-950" />;
  }

  const use3D = webglState === "available" && !prefersReducedMotion;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950 px-6">
      <LoginSequenceProvider skipChoreography={!use3D}>
        {use3D ? (
          <ThreeErrorBoundary fallback={null}>
            <div className="absolute inset-0" aria-hidden="true">
              <LoginExperienceCanvas />
            </div>
          </ThreeErrorBoundary>
        ) : null}

        <div className="relative z-10">
          <LoginCard />
        </div>
      </LoginSequenceProvider>
    </main>
  );
}
