import Link from "next/link";
import { ArrowRight, Boxes, ChartColumn, LogOut, Settings, ShoppingBasket, type LucideIcon } from "lucide-react";
import { BrandMark } from "./brand-mark";

type Module = { href: string; title: string; description: string; icon: LucideIcon };

const SECONDARY_MODULES: readonly Module[] = [
  { href: "/estoque", title: "Estoque", description: "Entradas, saídas e alertas de reposição.", icon: Boxes },
  { href: "/relatorios", title: "Relatórios", description: "Vendas por dia, formas de pagamento e mais vendidos.", icon: ChartColumn },
  { href: "/configuracoes", title: "Configurações", description: "Produtos, preços, usuários e dados da loja.", icon: Settings },
];

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary";

/**
 * Operational home the owner lands on after login. The till is the screen
 * used all day, so it gets the dominant tile; the rest are occasional and
 * sit together as secondary tiles.
 */
export function HomeHub({ userLabel, signOutAction }: { userLabel: string; signOutAction: () => Promise<void> }) {
  return (
    <main className="theme-light min-h-dvh bg-brand-surface px-3 py-3 text-brand-plum-900 sm:px-5">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-3 rounded-2xl border border-brand-border bg-brand-surface-card px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <BrandMark subtitle="Início" />
          <div className="flex items-center gap-3">
            <span className="truncate text-sm text-brand-text-soft">{userLabel}</span>
            <form action={signOutAction}>
              <button
                type="submit"
                className={`inline-flex h-8 items-center gap-1.5 rounded-lg border border-brand-border bg-brand-surface-card px-3 text-sm font-medium text-brand-text-soft transition-colors hover:border-brand-primary hover:bg-brand-surface-muted hover:text-brand-primary ${focusRing}`}
              >
                <LogOut className="size-4" /> Sair
              </button>
            </form>
          </div>
        </header>

        <h1 className="px-1 font-serif text-3xl font-semibold text-brand-plum-950">Onde vamos trabalhar agora?</h1>

        <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
          <Link
            href="/pdv"
            className={`group flex min-h-72 flex-col justify-between rounded-3xl bg-brand-primary p-7 text-white shadow-md transition-colors hover:bg-brand-primary-dark ${focusRing}`}
          >
            <ShoppingBasket className="size-12" strokeWidth={1.5} />
            <div>
              <p className="font-serif text-5xl font-semibold">Caixa</p>
              <p className="mt-2 max-w-sm text-base text-white/80">Registre vendas, pesagens de açaí e pagamentos.</p>
              <p className="mt-6 inline-flex items-center gap-2 text-sm font-semibold">
                Abrir caixa <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </p>
            </div>
          </Link>

          <div className="grid gap-4">
            {SECONDARY_MODULES.map(({ href, title, description, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-4 rounded-2xl border border-brand-border bg-brand-surface-card p-5 transition-colors hover:border-brand-primary hover:bg-brand-surface-muted ${focusRing}`}
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-surface-muted text-brand-primary">
                  <Icon className="size-6" strokeWidth={1.75} />
                </span>
                <span>
                  <span className="block font-serif text-xl font-semibold text-brand-plum-950">{title}</span>
                  <span className="mt-0.5 block text-sm text-brand-text-soft">{description}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
