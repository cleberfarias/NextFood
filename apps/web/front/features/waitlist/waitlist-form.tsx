"use client";

import { useActionState } from "react";
import { initialWaitlistActionState, joinWaitlistAction } from "@/back/actions/waitlist";
import { Button } from "@/front/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/front/ui/card";
import { Input } from "@/front/ui/input";
import { Label } from "@/front/ui/label";

export function WaitlistForm() {
  const [state, formAction, isPending] = useActionState(
    joinWaitlistAction,
    initialWaitlistActionState,
  );

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Entre na lista de espera</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="businessName">Nome do negócio</Label>
            <Input id="businessName" name="businessName" placeholder="Açaí Daquele" required />
            {state.fieldErrors?.businessName ? (
              <p className="text-sm text-destructive">{state.fieldErrors.businessName}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" placeholder="voce@negocio.com" required />
            {state.fieldErrors?.email ? (
              <p className="text-sm text-destructive">{state.fieldErrors.email}</p>
            ) : null}
          </div>

          <Button type="submit" disabled={isPending}>
            {isPending ? "Enviando..." : "Quero entrar"}
          </Button>

          {state.status !== "idle" && state.message ? (
            <p
              role="status"
              className={state.status === "success" ? "text-sm text-primary" : "text-sm text-destructive"}
            >
              {state.message}
            </p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
