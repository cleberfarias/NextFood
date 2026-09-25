import Link from "next/link";
import { ArrowRight, House, Store, UsersRound, UtensilsCrossed, type LucideIcon } from "lucide-react";
import { BrandMark } from "@/front/features/home/brand-mark";

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary";

type Area = { title: string; description: string; icon: LucideIcon; href?: string };

const AREAS: readonly Area[] = [
  { title: "Cardápio", description: "Preços, copos, complementos e embalagens.", icon: UtensilsCrossed, href: "/configuracoes/cardapio" },
  { title: "Usuários", description: "Quem acessa o sistema e o que cada pessoa pode fazer.", icon: UsersRound },
  { title: "Dados da loja", description: "Nome, CNPJ, endereço e dados fiscais.", icon: Store },
];

function AreaBody({ area }: { area: Area }) {
  const Icon = area.icon;
  return (
    <>
      <span className="grid size-12 place-items-center rounded-xl bg-brand-surface-muted text-brand-primary">
        <Icon className="size-6" strokeWidth={1.75} />
      </span>
      <span className="block">
        <span className="block font-serif text-xl font-semibold text-brand-plum-950">{area.title}</span>
        <span className="mt-1 block text-sm text-brand-text-soft">{area.description}</span>
      </span>
      {area.href ? (
        <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-brand-primary">
          Abrir <ArrowRight className="size-4" />
        </span>
      ) : (
        <span className="mt-auto inline-flex w-fit rounded-full bg-brand-surface-muted px-2.5 py-1 text-xs font-semibold text-brand-text-soft">Em breve</span>
      )}
    </>
  );
}

export function SettingsHub() {
  return (
    <main className="theme-light min-h-dvh bg-brand-surface px-3 py-3 text-brand-plum-900 sm:px-5">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-3 rounded-2xl border border-brand-border bg-brand-surface-card px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <BrandMark subtitle="Configurações" />
          <Link
            href="/dashboard"
            className={`inline-flex h-9 w-fit items-center gap-1.5 rounded-lg border border-brand-border bg-brand-surface-card px-3 text-sm font-medium text-brand-text-soft transition-colors hover:border-brand-primary hover:bg-brand-surface-muted hover:text-brand-primary ${focusRing}`}
          >
            <House className="size-4" /> Início
          </Link>
        </header>

        <h1 className="px-1 font-serif text-3xl font-semibold text-brand-plum-950">Configurações</h1>

        <ul aria-label="Áreas de configuração" className="grid gap-4 md:grid-cols-3">
          {AREAS.map((area) => (
            <li key={area.title}>
              {area.href ? (
                <Link
                  href={area.href}
                  className={`flex h-full min-h-48 flex-col gap-4 rounded-2xl border border-brand-border bg-brand-surface-card p-5 transition-colors hover:border-brand-primary hover:bg-brand-surface-muted ${focusRing}`}
                >
                  <AreaBody area={area} />
                </Link>
              ) : (
                <div className="flex h-full min-h-48 flex-col gap-4 rounded-2xl border border-dashed border-brand-border bg-brand-surface-card p-5 opacity-80">
                  <AreaBody area={area} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
