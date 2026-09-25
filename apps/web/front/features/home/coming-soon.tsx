import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandMark } from "./brand-mark";

export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <main className="theme-light min-h-dvh bg-brand-surface px-3 py-3 text-brand-plum-900 sm:px-5">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="rounded-2xl border border-brand-border bg-brand-surface-card px-4 py-3 shadow-sm">
          <BrandMark subtitle={title} />
        </header>

        <section className="rounded-3xl border border-brand-border bg-brand-surface-card px-6 py-14 text-center shadow-sm">
          <h1 className="font-serif text-4xl font-semibold text-brand-plum-950">{title}</h1>
          <p className="mx-auto mt-3 max-w-md text-base text-brand-text-soft">{description}</p>
          <p className="mx-auto mt-6 max-w-md text-sm text-brand-text-muted">Esta área ainda está sendo construída.</p>
          <Link
            href="/dashboard"
            className="mt-8 inline-flex h-10 items-center gap-2 rounded-lg bg-brand-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          >
            <ArrowLeft className="size-4" /> Voltar para o início
          </Link>
        </section>
      </div>
    </main>
  );
}
