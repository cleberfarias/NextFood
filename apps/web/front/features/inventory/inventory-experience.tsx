"use client";

import Link from "next/link";
import { House, Plus, Search } from "lucide-react";
import { useMemo, useReducer, useState } from "react";
import {
  applyMovement,
  matchesSearch,
  sortByCriticality,
  stockStatus,
  type InventoryCategory,
  type InventoryItem,
  type Movement,
  type MovementError,
  type MovementInput,
} from "@/back/domain/inventory/inventory";
import { BrandMark } from "@/front/features/home/brand-mark";
import { CATALOG } from "@/front/features/catalog/catalog-mocks";
import { MOVEMENT_AUTHOR } from "./inventory-mocks";
import { focusRing, InventoryList, LowStockBanner, RecentMovements } from "./inventory-ui";
import { MovementPanel } from "./movement-panel";

type State = { items: InventoryItem[]; movements: Movement[] };
type Action = { type: "movementApplied"; item: InventoryItem; movement: Movement };

// Only ever receives results applyMovement already validated.
function reducer(state: State, action: Action): State {
  return {
    items: state.items.map((entry) => (entry.id === action.item.id ? action.item : entry)),
    movements: [action.movement, ...state.movements],
  };
}

type CategoryFilter = "todos" | InventoryCategory;
const CATEGORY_FILTERS: readonly { value: CategoryFilter; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "insumo", label: "Insumos" },
  { value: "produto", label: "Produtos" },
];

export function InventoryExperience({ initialItems = CATALOG.stockItems }: { initialItems?: readonly InventoryItem[] }) {
  const [state, dispatch] = useReducer(reducer, { items: [...initialItems], movements: [] });
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("todos");
  const [lowOnly, setLowOnly] = useState(false);
  const [panel, setPanel] = useState<{ open: boolean; itemId: string | null; key: number }>({ open: false, itemId: null, key: 0 });

  const sorted = useMemo(() => sortByCriticality(state.items), [state.items]);
  const lowItems = sorted.filter((entry) => stockStatus(entry) !== "ok");
  const visible = sorted.filter(
    (entry) =>
      matchesSearch(entry, query) &&
      (category === "todos" || entry.category === category) &&
      (!lowOnly || stockStatus(entry) !== "ok"),
  );

  function openPanel(itemId: string | null) {
    setPanel((current) => ({ open: true, itemId, key: current.key + 1 }));
  }

  function clearFilters() {
    setQuery("");
    setCategory("todos");
    setLowOnly(false);
  }

  function submitMovement(itemId: string, input: MovementInput): MovementError | null {
    const target = state.items.find((entry) => entry.id === itemId);
    if (!target) return { field: "quantity", message: "Item não encontrado." };
    const result = applyMovement(target, input, { id: crypto.randomUUID(), author: MOVEMENT_AUTHOR, createdAt: new Date().toISOString() });
    if (!result.ok) return result.error;
    dispatch({ type: "movementApplied", item: result.item, movement: result.movement });
    setPanel((current) => ({ ...current, open: false }));
    return null;
  }

  return (
    <main className="theme-light min-h-dvh bg-brand-surface px-3 py-3 text-brand-plum-900 sm:px-5">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <header className="flex flex-col gap-3 rounded-2xl border border-brand-border bg-brand-surface-card px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <BrandMark subtitle="Estoque" />
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg border border-brand-border bg-brand-surface-card px-3 text-sm font-medium text-brand-text-soft transition-colors hover:border-brand-primary hover:bg-brand-surface-muted hover:text-brand-primary ${focusRing}`}
            >
              <House className="size-4" /> Início
            </Link>
            <button
              type="button"
              onClick={() => openPanel(null)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-primary-dark ${focusRing}`}
            >
              <Plus className="size-4" /> Registrar movimentação
            </button>
          </div>
        </header>

        <h1 className="px-1 font-serif text-3xl font-semibold text-brand-plum-950">Estoque</h1>

        <LowStockBanner items={lowItems} onShowLow={() => setLowOnly(true)} />

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <label className="relative block md:w-80">
            <span className="sr-only">Buscar item</span>
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-brand-text-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar item"
              className={`h-10 w-full rounded-lg border border-brand-border bg-brand-surface-card pl-9 pr-3 text-sm text-brand-plum-900 ${focusRing}`}
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {CATEGORY_FILTERS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={category === option.value}
                onClick={() => setCategory(option.value)}
                className={`h-9 rounded-lg border px-3 text-sm font-medium transition-colors ${focusRing} ${
                  category === option.value
                    ? "border-brand-primary bg-brand-primary text-white"
                    : "border-brand-border bg-brand-surface-card text-brand-text-soft hover:border-brand-primary hover:bg-brand-surface-muted hover:text-brand-primary"
                }`}
              >
                {option.label}
              </button>
            ))}
            <label className="ml-1 inline-flex items-center gap-2 text-sm text-brand-plum-900">
              <input
                type="checkbox"
                checked={lowOnly}
                onChange={(event) => setLowOnly(event.target.checked)}
                className="size-4 accent-brand-primary"
              />
              Só estoque baixo
            </label>
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="rounded-2xl border border-brand-border bg-brand-surface-card px-6 py-10 text-center">
            <p className="text-brand-text-soft">Nenhum item encontrado com esses filtros.</p>
            <button
              type="button"
              onClick={clearFilters}
              className={`mt-4 h-9 rounded-lg border border-brand-border px-4 text-sm font-medium text-brand-text-soft transition-colors hover:border-brand-primary hover:bg-brand-surface-muted hover:text-brand-primary ${focusRing}`}
            >
              Limpar filtros
            </button>
          </div>
        ) : (
          <InventoryList items={visible} onMove={openPanel} />
        )}

        <RecentMovements movements={state.movements} items={state.items} />
      </div>

      <MovementPanel
        key={panel.key}
        open={panel.open}
        onOpenChange={(open) => setPanel((current) => ({ ...current, open }))}
        items={sorted}
        initialItemId={panel.itemId}
        onSubmit={submitMovement}
      />
    </main>
  );
}
