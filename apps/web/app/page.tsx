export default function HomePage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-16">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.25em] text-fuchsia-300">NextFood</p>
        <h1 className="max-w-3xl text-5xl font-bold tracking-tight sm:text-6xl">
          Gestão inteligente para operações de alimentação.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
          Plataforma SaaS multi-tenant começando por lojas de açaí, preparada para pedidos, PDV,
          estoque, caixa, clientes e relatórios.
        </p>
      </section>
    </main>
  );
}
