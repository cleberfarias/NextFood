import { redirect } from "next/navigation";
import { getCurrentUser, signOutAction } from "@/back/actions/auth";
import { Button } from "@/front/ui/button";

// Reads the session cookie, which depends on the Firebase Admin SDK being
// reachable (real project or emulator) -- never attempt at build time.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-950 text-zinc-50">
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-sm uppercase tracking-[0.25em] text-fuchsia-300">NextFood</p>
        <h1 className="text-3xl font-bold">Você está autenticado</h1>
        <p className="text-zinc-300">{user.email ?? user.uid}</p>
        <p className="max-w-md text-sm text-zinc-400">
          Este é um placeholder -- o dashboard real (pedidos, PDV, estoque, caixa) ainda não existe.
        </p>
      </div>
      <form action={signOutAction}>
        <Button type="submit" variant="outline">
          Sair
        </Button>
      </form>
    </main>
  );
}
