"use client";

import Link from "next/link";
import { House, Plus, RotateCcw, Settings } from "lucide-react";
import { Dialog } from "radix-ui";
import { useState } from "react";
import type { Catalog, SaleProduct } from "@/back/domain/catalog/catalog";
import { BrandMark } from "@/front/features/home/brand-mark";
import { CatalogEditPanel, type EditTarget } from "./catalog-edit-panel";
import { resetCatalog, saveCatalog, useCatalog } from "./catalog-store";

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary";
const secondaryButton = `inline-flex h-9 items-center gap-1.5 rounded-lg border border-brand-border bg-brand-surface-card px-3 text-sm font-medium text-brand-text-soft transition-colors hover:border-brand-primary hover:bg-brand-surface-muted hover:text-brand-primary ${focusRing}`;
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

type List = EditTarget["list"];
const TABS: readonly { list: List; label: string; newLabel: string }[] = [
  { list: "products", label: "Produtos", newLabel: "Novo produto" },
  { list: "complements", label: "Complementos", newLabel: "Novo complemento" },
  { list: "packagings", label: "Embalagens", newLabel: "Nova embalagem" },
];

const KIND_LABEL: Record<SaleProduct["kind"], string> = { peso: "Por peso", pronto: "Copo pronto", unidade: "Unidade" };

type Row = { id: string; name: string; detail?: string; value: string; active: boolean };

function rowsFor(catalog: Catalog, list: List): Row[] {
  if (list === "products") {
    return catalog.products.map((product) => ({
      id: product.id,
      name: product.name,
      detail: KIND_LABEL[product.kind],
      value: product.kind === "peso" ? `${money.format(product.pricePerKg)}/kg` : money.format(product.price),
      active: product.active,
    }));
  }
  if (list === "complements") {
    return catalog.complements.map((complement) => ({ id: complement.id, name: complement.name, value: `Adicional ${money.format(complement.extraPrice)}`, active: complement.active }));
  }
  return catalog.packagings.map((packaging) => ({
    id: packaging.id,
    name: packaging.name,
    value: `Tara ${(Math.round(packaging.tareKg * 1_000_000) / 1000).toLocaleString("pt-BR")} g`,
    active: packaging.active,
  }));
}

export function CardapioEditor() {
  const catalog = useCatalog();
  const [tab, setTab] = useState<List>("products");
  const [panel, setPanel] = useState<{ open: boolean; target: EditTarget; key: number }>({ open: false, target: { list: "products", id: null }, key: 0 });
  const [confirmReset, setConfirmReset] = useState(false);
  const [status, setStatus] = useState("");

  const current = TABS.find((entry) => entry.list === tab) ?? TABS[0];

  function openPanel(target: EditTarget) {
    setStatus("");
    setPanel((state) => ({ open: true, target, key: state.key + 1 }));
  }

  function handleSaved(next: Catalog) {
    saveCatalog(next);
    setPanel((state) => ({ ...state, open: false }));
    setStatus("Alterações salvas.");
  }

  function handleReset() {
    resetCatalog();
    setConfirmReset(false);
    setStatus("Valores de exemplo restaurados.");
  }

  return (
    <main className="theme-light min-h-dvh bg-brand-surface px-3 py-3 text-brand-plum-900 sm:px-5">
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <header className="flex flex-col gap-3 rounded-2xl border border-brand-border bg-brand-surface-card px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <BrandMark subtitle="Cardápio" />
          <nav aria-label="Navegação" className="flex items-center gap-2">
            <Link href="/configuracoes" className={secondaryButton}>
              <Settings className="size-4" /> Configurações
            </Link>
            <Link href="/dashboard" className={secondaryButton}>
              <House className="size-4" /> Início
            </Link>
          </nav>
        </header>

        <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-serif text-3xl font-semibold text-brand-plum-950">Cardápio</h1>
            <p className="mt-1 text-sm text-brand-text-soft">As mudanças ficam salvas neste navegador.</p>
          </div>
          <button type="button" onClick={() => setConfirmReset(true)} className={`${secondaryButton} w-fit`}>
            <RotateCcw className="size-4" /> Restaurar valores de exemplo
          </button>
        </div>

        <p role="status" aria-live="polite" className="px-1 text-sm font-medium text-brand-success">
          {status}
        </p>

        <section className="rounded-2xl border border-brand-border bg-brand-surface-card shadow-sm">
          <div className="flex flex-col gap-3 border-b border-brand-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div role="tablist" aria-label="Partes do cardápio" className="flex flex-wrap gap-2">
              {TABS.map((entry) => (
                <button
                  key={entry.list}
                  type="button"
                  role="tab"
                  id={`tab-${entry.list}`}
                  aria-selected={tab === entry.list}
                  aria-controls={`panel-${entry.list}`}
                  onClick={() => setTab(entry.list)}
                  className={`h-9 rounded-lg border px-3 text-sm font-medium transition-colors ${focusRing} ${
                    tab === entry.list
                      ? "border-brand-primary bg-brand-primary text-white"
                      : "border-brand-border bg-brand-surface-card text-brand-text-soft hover:border-brand-primary hover:bg-brand-surface-muted hover:text-brand-primary"
                  }`}
                >
                  {entry.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => openPanel({ list: tab, id: null })}
              className={`inline-flex h-9 w-fit items-center gap-1.5 rounded-lg bg-brand-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-primary-dark ${focusRing}`}
            >
              <Plus className="size-4" /> {current.newLabel}
            </button>
          </div>

          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            <ul aria-label={current.label} className="divide-y divide-brand-border">
              {rowsFor(catalog, tab).map((row) => (
                <li key={row.id} aria-label={row.name} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className={`font-medium ${row.active ? "text-brand-plum-950" : "text-brand-text-muted"}`}>{row.name}</p>
                    {row.detail ? <p className="text-sm text-brand-text-soft">{row.detail}</p> : null}
                  </div>
                  <div className="flex items-center gap-3">
                    {!row.active ? <span className="rounded-full bg-brand-surface-muted px-2.5 py-1 text-xs font-semibold text-brand-text-soft">Desativado</span> : null}
                    <span className="text-sm font-semibold tabular-nums text-brand-plum-900">{row.value}</span>
                    <button type="button" aria-label={`Editar ${row.name}`} onClick={() => openPanel({ list: tab, id: row.id })} className={secondaryButton}>
                      Editar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      <CatalogEditPanel
        key={panel.key}
        open={panel.open}
        onOpenChange={(open) => setPanel((state) => ({ ...state, open }))}
        catalog={catalog}
        target={panel.target}
        onSaved={handleSaved}
      />

      <Dialog.Root open={confirmReset} onOpenChange={setConfirmReset}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-brand-plum-950/45" />
          <Dialog.Content className="theme-light fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-brand-border bg-brand-surface-card p-6 shadow-xl focus:outline-none">
            <Dialog.Title className="font-serif text-2xl font-semibold text-brand-plum-950">Restaurar valores de exemplo?</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-brand-text-soft">As mudanças salvas neste navegador serão apagadas.</Dialog.Description>
            <div className="mt-6 flex justify-end gap-2">
              <Dialog.Close className={`${secondaryButton} h-10 px-4`}>Cancelar</Dialog.Close>
              <button type="button" onClick={handleReset} className={`h-10 rounded-lg bg-brand-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-primary-dark ${focusRing}`}>
                Restaurar
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </main>
  );
}
