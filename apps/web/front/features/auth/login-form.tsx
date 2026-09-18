"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { establishSessionAction } from "@/back/actions/auth";
import { getClientAuth } from "@/front/lib/firebase-client";
import { usePrefersReducedMotion } from "@/front/lib/use-prefers-reduced-motion";
import { Button } from "@/front/ui/button";
import { Input } from "@/front/ui/input";
import { Label } from "@/front/ui/label";
import { computeDodge } from "./compute-dodge";

const EMPTY_FIELDS_MESSAGE = "Preencha seu e-mail e senha para continuar.";
// How long the "Entrar" button stays dodged before easing back to its normal
// spot -- it flees, but it doesn't abandon the form.
const DODGE_RETURN_DELAY_MS = 900;

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dodgeCount, setDodgeCount] = useState(0);
  const [buttonOffset, setButtonOffset] = useState({ x: 0, y: 0 });
  const returnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    return () => {
      if (returnTimeoutRef.current) clearTimeout(returnTimeoutRef.current);
    };
  }, []);

  const fieldsEmpty = email.trim() === "" || password.trim() === "";

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    // Mouse-proximity only -- keyboard navigation never fires pointer events,
    // so Tab/Enter can never trigger a dodge.
    if (prefersReducedMotion) return;
    const container = containerRef.current;
    const button = buttonRef.current;
    if (!container || !button) return;

    const containerRect = container.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();

    const { shouldDodge, nextPosition } = computeDodge({
      cursor: { x: event.clientX, y: event.clientY },
      buttonRect,
      containerRect,
      dodgeCount,
      fieldsEmpty,
    });

    if (shouldDodge && nextPosition) {
      setButtonOffset((prev) => ({
        x: prev.x + (nextPosition.x - buttonRect.x),
        y: prev.y + (nextPosition.y - buttonRect.y),
      }));
      setDodgeCount((count) => count + 1);

      // Flees, but comes back -- it doesn't strand the button somewhere the
      // user can never reach.
      if (returnTimeoutRef.current) clearTimeout(returnTimeoutRef.current);
      returnTimeoutRef.current = setTimeout(() => {
        setButtonOffset({ x: 0, y: 0 });
      }, DODGE_RETURN_DELAY_MS);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (fieldsEmpty) {
      setError(EMPTY_FIELDS_MESSAGE);
      return;
    }

    startTransition(async () => {
      try {
        const credential = await signInWithEmailAndPassword(getClientAuth(), email, password);
        const idToken = await credential.user.getIdToken();
        const result = await establishSessionAction(idToken);
        if (result.status === "error") {
          setError(result.message);
          return;
        }
        router.push("/dashboard");
      } catch {
        setError("E-mail ou senha inválidos.");
      }
    });
  }

  return (
    <div ref={containerRef} onPointerMove={handlePointerMove} className="relative">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="voce@negocio.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Sua senha"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        <motion.div
          animate={{ x: buttonOffset.x, y: buttonOffset.y }}
          transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 20 }}
          className="inline-block"
        >
          <Button ref={buttonRef} type="submit" disabled={isPending}>
            {isPending ? "Entrando..." : "Entrar"}
          </Button>
        </motion.div>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </form>
    </div>
  );
}
