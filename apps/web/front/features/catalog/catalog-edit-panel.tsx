"use client";

import { Dialog } from "radix-ui";
import { useState, type FormEvent, type ReactNode } from "react";
import type { Catalog, CatalogError, SaleProduct, StockUsage } from "@/back/domain/catalog/catalog";
import { saveComplement, savePackaging, saveProduct, type EditResult } from "@/back/domain/catalog/catalog-edits";
import { parseQuantity, type InventoryItem, type InventoryUnit } from "@/back/domain/inventory/inventory";

export type EditTarget = { list: "products" | "complements" | "packagings"; id: string | null };

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary";
const fieldClass = `h-10 w-full rounded-lg border border-brand-border bg-brand-surface-card px-3 text-sm text-brand-plum-900 ${focusRing}`;
const labelClass = "grid gap-1.5 text-sm font-medium text-brand-plum-900";
const secondaryButton = `h-9 rounded-lg border border-brand-border bg-brand-surface-card px-3 text-sm font-medium text-brand-text-soft transition-colors hover:border-brand-primary hover:bg-brand-surface-muted hover:text-brand-primary ${focusRing}`;

/** 39.9 → "39,90" (no thousands separator, so parseQuantity reads it back). */
export function moneyInput(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });
}

function quantityInput(value: number): string {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 3, useGrouping: false });
}

type UsageRow = { key: number; itemId: string; quantityRaw: string };
let rowSeq = 0;

function toRows(usages: readonly StockUsage[]): UsageRow[] {
  return usages.map((usage) => ({ key: rowSeq++, itemId: usage.itemId, quantityRaw: quantityInput(usage.quantity) }));
}

function toUsages(rows: readonly UsageRow[], items: readonly InventoryItem[]): StockUsage[] {
  const units = new Map(items.map((item) => [item.id, item.unit]));
  return rows.map((row) => ({ itemId: row.itemId, quantity: parseQuantity(row.quantityRaw, units.get(row.itemId)) }));
}

function StockUsageEditor({ legend, rows, onChange, items }: { legend: string; rows: UsageRow[]; onChange: (rows: UsageRow[]) => void; items: readonly InventoryItem[] }) {
  const update = (key: number, patch: Partial<UsageRow>) => onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  return (
    <fieldset className="grid gap-3">
      <legend className="text-sm font-medium text-brand-plum-900">{legend}</legend>
      {rows.map((row, index) => {
        const unit = items.find((item) => item.id === row.itemId)?.unit ?? "un";
        return (
          <div key={row.key} className="grid grid-cols-[1fr_7rem_auto] items-end gap-2">
            <label className={labelClass}>
              Item do estoque
              <select value={row.itemId} onChange={(event) => update(row.key, { itemId: event.target.value })} className={fieldClass}>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.unit})
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              {`Quantidade (${unit})`}
              <input inputMode="decimal" value={row.quantityRaw} onChange={(event) => update(row.key, { quantityRaw: event.target.value })} className={fieldClass} />
            </label>
            <button type="button" aria-label={`Remover consumo ${index + 1}`} onClick={() => onChange(rows.filter((entry) => entry.key !== row.key))} className={`${secondaryButton} h-10`}>
              Remover
            </button>
          </div>
        );
      })}
      <button
        type="button"
        disabled={items.length === 0}
        onClick={() => onChange([...rows, { key: rowSeq++, itemId: items[0].id, quantityRaw: "" }])}
        className={`${secondaryButton} w-fit disabled:opacity-50`}
      >
        Adicionar consumo
      </button>
    </fieldset>
  );
}

function ErrorList({ errors }: { errors: readonly CatalogError[] }) {
  const messages = [...new Set(errors.map((error) => error.message))];
  if (messages.length === 0) return null;
  return (
    <ul role="alert" className="grid gap-1 rounded-lg border border-brand-rose/40 bg-brand-surface-muted px-3 py-2 text-sm text-brand-rose">
      {messages.map((message) => (
        <li key={message}>{message}</li>
      ))}
    </ul>
  );
}

function FormShell({ onSubmit, errors, children }: { onSubmit: () => void; errors: readonly CatalogError[]; children: ReactNode }) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }
  return (
    <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-1 flex-col gap-5">
      {children}
      <ErrorList errors={errors} />
      <div className="mt-auto flex justify-end gap-2 pt-2">
        <Dialog.Close className={`${secondaryButton} h-10 px-4`}>Cancelar</Dialog.Close>
        <button type="submit" className={`h-10 rounded-lg bg-brand-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-primary-dark ${focusRing}`}>
          Salvar
        </button>
      </div>
    </form>
  );
}

function ActiveCheckbox({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-brand-plum-900">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-4 accent-brand-primary" />
      Ativo
    </label>
  );
}

type FormProps = { catalog: Catalog; id: string | null; onSaved: (catalog: Catalog) => void };

function useResult(onSaved: (catalog: Catalog) => void) {
  const [errors, setErrors] = useState<CatalogError[]>([]);
  return {
    errors,
    apply(result: EditResult) {
      if (result.ok) onSaved(result.catalog);
      else setErrors(result.errors);
    },
  };
}

const NEW_KINDS: readonly { value: "pronto" | "unidade"; label: string }[] = [
  { value: "pronto", label: "Copo pronto" },
  { value: "unidade", label: "Unidade" },
];

function ProductForm({ catalog, id, onSaved }: FormProps) {
  const existing = id ? catalog.products.find((product) => product.id === id) : undefined;
  const firstActivePackaging = catalog.packagings.find((packaging) => packaging.active)?.id ?? "";
  const [kind, setKind] = useState<SaleProduct["kind"]>(existing?.kind ?? "pronto");
  const [name, setName] = useState(existing?.name ?? "");
  const [active, setActive] = useState(existing?.active ?? true);
  const [priceRaw, setPriceRaw] = useState(existing ? moneyInput(existing.kind === "peso" ? existing.pricePerKg : existing.price) : "");
  const [packagingIds, setPackagingIds] = useState<string[]>(existing?.kind === "peso" ? existing.packagingIds : []);
  const [packagingId, setPackagingId] = useState(existing?.kind === "pronto" ? existing.packagingId : firstActivePackaging);
  const [includedRaw, setIncludedRaw] = useState(existing?.kind === "pronto" ? String(existing.includedComplements) : "3");
  const [rows, setRows] = useState<UsageRow[]>(() => toRows(existing ? (existing.kind === "peso" ? existing.consumesPerKg : existing.consumes) : []));
  const [trackStock, setTrackStock] = useState(true);
  const { errors, apply } = useResult(onSaved);

  const usageItems = kind === "peso" ? catalog.stockItems.filter((item) => item.unit !== "un") : catalog.stockItems;
  const selectablePackagings = catalog.packagings.filter((packaging) => packaging.active || packaging.id === packagingId || packagingIds.includes(packaging.id));

  function submit() {
    const price = parseQuantity(priceRaw);
    const usages = toUsages(rows, catalog.stockItems);
    const base = { id: existing?.id ?? "", name, active };
    const draft: SaleProduct =
      kind === "peso"
        ? { ...base, kind, pricePerKg: price, packagingIds, consumesPerKg: usages }
        : kind === "pronto"
          ? { ...base, kind, price, packagingId, includedComplements: parseQuantity(includedRaw), consumes: usages }
          : { ...base, kind, price, consumes: usages };
    apply(saveProduct(catalog, draft, { trackStock: !existing && kind === "unidade" && trackStock }));
  }

  return (
    <FormShell onSubmit={submit} errors={errors}>
      {!existing ? (
        <div>
          <p id="product-kind-label" className="text-sm font-medium text-brand-plum-900">
            Tipo
          </p>
          <div role="radiogroup" aria-labelledby="product-kind-label" className="mt-1.5 grid grid-cols-2 gap-2">
            {NEW_KINDS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={kind === option.value}
                onClick={() => setKind(option.value)}
                className={`h-9 rounded-lg border text-sm font-medium transition-colors ${focusRing} ${
                  kind === option.value
                    ? "border-brand-primary bg-brand-primary text-white"
                    : "border-brand-border bg-brand-surface-card text-brand-text-soft hover:border-brand-primary hover:bg-brand-surface-muted hover:text-brand-primary"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <label className={labelClass}>
        Nome
        <input value={name} onChange={(event) => setName(event.target.value)} className={fieldClass} />
      </label>

      <label className={labelClass}>
        {kind === "peso" ? "Preço por kg (R$)" : "Preço (R$)"}
        <input inputMode="decimal" value={priceRaw} onChange={(event) => setPriceRaw(event.target.value)} className={fieldClass} />
      </label>

      {kind === "peso" ? (
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium text-brand-plum-900">Embalagens aceitas</legend>
          {selectablePackagings.map((packaging) => (
            <label key={packaging.id} className="inline-flex items-center gap-2 text-sm text-brand-plum-900">
              <input
                type="checkbox"
                checked={packagingIds.includes(packaging.id)}
                onChange={(event) =>
                  setPackagingIds((current) => (event.target.checked ? [...current, packaging.id] : current.filter((entry) => entry !== packaging.id)))
                }
                className="size-4 accent-brand-primary"
              />
              {packaging.name}
            </label>
          ))}
        </fieldset>
      ) : null}

      {kind === "pronto" ? (
        <>
          <label className={labelClass}>
            Embalagem
            <select value={packagingId} onChange={(event) => setPackagingId(event.target.value)} className={fieldClass}>
              {selectablePackagings.map((packaging) => (
                <option key={packaging.id} value={packaging.id}>
                  {packaging.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Complementos incluídos
            <input inputMode="numeric" value={includedRaw} onChange={(event) => setIncludedRaw(event.target.value)} className={fieldClass} />
          </label>
        </>
      ) : null}

      <StockUsageEditor
        legend={kind === "peso" ? "Consumo por kg vendido" : kind === "pronto" ? "Consumo por copo" : "Consumo por unidade"}
        rows={rows}
        onChange={setRows}
        items={usageItems}
      />

      {!existing && kind === "unidade" ? (
        <label className="inline-flex items-center gap-2 text-sm text-brand-plum-900">
          <input type="checkbox" checked={trackStock} onChange={(event) => setTrackStock(event.target.checked)} className="size-4 accent-brand-primary" />
          Controlar estoque deste produto
        </label>
      ) : null}

      {existing && existing.kind !== "peso" ? <ActiveCheckbox checked={active} onChange={setActive} /> : null}
    </FormShell>
  );
}

const STOCK_UNITS: readonly InventoryUnit[] = ["kg", "L", "un"];

function ComplementForm({ catalog, id, onSaved }: FormProps) {
  const existing = id ? catalog.complements.find((complement) => complement.id === id) : undefined;
  const [name, setName] = useState(existing?.name ?? "");
  const [extraRaw, setExtraRaw] = useState(existing ? moneyInput(existing.extraPrice) : "");
  const [active, setActive] = useState(existing?.active ?? true);
  const [stockUnit, setStockUnit] = useState<InventoryUnit>("kg");
  const { errors, apply } = useResult(onSaved);

  function submit() {
    const draft = { id: existing?.id ?? "", name, active, extraPrice: parseQuantity(extraRaw), stockItemId: existing?.stockItemId ?? "" };
    apply(saveComplement(catalog, draft, { stockUnit }));
  }

  return (
    <FormShell onSubmit={submit} errors={errors}>
      <label className={labelClass}>
        Nome
        <input value={name} onChange={(event) => setName(event.target.value)} className={fieldClass} />
      </label>
      <label className={labelClass}>
        Adicional (R$)
        <input inputMode="decimal" value={extraRaw} onChange={(event) => setExtraRaw(event.target.value)} className={fieldClass} />
      </label>
      {!existing ? (
        <label className={labelClass}>
          Unidade no estoque
          <select value={stockUnit} onChange={(event) => setStockUnit(event.target.value as InventoryUnit)} className={fieldClass}>
            {STOCK_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <ActiveCheckbox checked={active} onChange={setActive} />
      )}
    </FormShell>
  );
}

function PackagingForm({ catalog, id, onSaved }: FormProps) {
  const existing = id ? catalog.packagings.find((packaging) => packaging.id === id) : undefined;
  const [name, setName] = useState(existing?.name ?? "");
  const [tareRaw, setTareRaw] = useState(existing ? quantityInput(Math.round(existing.tareKg * 1_000_000) / 1000) : "");
  const [active, setActive] = useState(existing?.active ?? true);
  const { errors, apply } = useResult(onSaved);

  function submit() {
    const draft = { id: existing?.id ?? "", name, active, tareKg: parseQuantity(tareRaw) / 1000, stockItemId: existing?.stockItemId ?? "" };
    apply(savePackaging(catalog, draft));
  }

  return (
    <FormShell onSubmit={submit} errors={errors}>
      <label className={labelClass}>
        Nome
        <input value={name} onChange={(event) => setName(event.target.value)} className={fieldClass} />
      </label>
      <label className={labelClass}>
        Tara (g)
        <input inputMode="decimal" value={tareRaw} onChange={(event) => setTareRaw(event.target.value)} className={fieldClass} />
      </label>
      {existing ? <ActiveCheckbox checked={active} onChange={setActive} /> : null}
    </FormShell>
  );
}

const NEW_TITLE: Record<EditTarget["list"], string> = { products: "Novo produto", complements: "Novo complemento", packagings: "Nova embalagem" };

function panelTitle(catalog: Catalog, target: EditTarget): string {
  if (target.id === null) return NEW_TITLE[target.list];
  const entries: readonly { id: string; name: string }[] = catalog[target.list];
  return `Editar ${entries.find((entry) => entry.id === target.id)?.name ?? ""}`;
}

/** Mount a fresh instance (new `key`) on every open, so a cancelled or failed attempt never leaks into the next one. */
export function CatalogEditPanel({
  open,
  onOpenChange,
  catalog,
  target,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalog: Catalog;
  target: EditTarget;
  onSaved: (catalog: Catalog) => void;
}) {
  const formProps = { catalog, id: target.id, onSaved };
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-brand-plum-950/45" />
        <Dialog.Content className="theme-light fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-y-auto border-l border-brand-border bg-brand-surface-card p-6 shadow-xl focus:outline-none">
          <Dialog.Title className="font-serif text-2xl font-semibold text-brand-plum-950">{panelTitle(catalog, target)}</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-brand-text-soft">As mudanças valem para o caixa assim que forem salvas.</Dialog.Description>
          {target.list === "products" ? <ProductForm {...formProps} /> : target.list === "complements" ? <ComplementForm {...formProps} /> : <PackagingForm {...formProps} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
