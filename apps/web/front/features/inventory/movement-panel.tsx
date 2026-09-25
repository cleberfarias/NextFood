"use client";

import { Dialog } from "radix-ui";
import { useState, type FormEvent } from "react";
import {
  applyMovement,
  formatQuantity,
  parseQuantity,
  type InventoryItem,
  type MovementError,
  type MovementInput,
  type MovementType,
} from "@/back/domain/inventory/inventory";
import { focusRing, MOVEMENT_TYPE_LABEL } from "./inventory-ui";

const TYPES: readonly MovementType[] = ["entrada", "perda", "ajuste", "inventario"];

const QUANTITY_LABEL: Record<MovementType, string> = {
  entrada: "Quantidade recebida",
  perda: "Quantidade perdida",
  ajuste: "Diferença (+ ou −)",
  inventario: "Contagem física",
};

const PREVIEW_META = { id: "preview", author: "", createdAt: "" };

const fieldClass = `w-full rounded-lg border border-brand-border bg-brand-surface-card px-3 text-sm text-brand-plum-900 ${focusRing}`;

/**
 * Mount a fresh instance (new `key`) every time it opens -- form state lives
 * here, and remounting is what guarantees a clean form after a cancelled or
 * failed attempt.
 */
export function MovementPanel({
  open,
  onOpenChange,
  items,
  initialItemId,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: readonly InventoryItem[];
  initialItemId: string | null;
  onSubmit: (itemId: string, input: MovementInput) => MovementError | null;
}) {
  const [itemId, setItemId] = useState(initialItemId ?? items[0]?.id ?? "");
  const [type, setType] = useState<MovementType>("entrada");
  const [quantityRaw, setQuantityRaw] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<MovementError | null>(null);

  const item = items.find((entry) => entry.id === itemId);
  const input: MovementInput = { type, quantity: parseQuantity(quantityRaw), reason };
  const preview = item && quantityRaw.trim() !== "" ? applyMovement(item, { ...input, reason: "prévia" }, PREVIEW_META) : null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!item) return;
    setError(onSubmit(item.id, input));
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-brand-plum-950/45" />
        <Dialog.Content className="theme-light fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-y-auto border-l border-brand-border bg-brand-surface-card p-6 shadow-xl focus:outline-none">
          <Dialog.Title className="font-serif text-2xl font-semibold text-brand-plum-950">Registrar movimentação</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-brand-text-soft">Toda movimentação precisa de uma justificativa.</Dialog.Description>

          <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-1 flex-col gap-5">
            <label className="grid gap-1.5 text-sm font-medium text-brand-plum-900">
              Item
              <select value={itemId} onChange={(event) => setItemId(event.target.value)} className={`h-10 ${fieldClass}`}>
                {items.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <p id="movement-type-label" className="text-sm font-medium text-brand-plum-900">
                Tipo
              </p>
              <div role="radiogroup" aria-labelledby="movement-type-label" className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {TYPES.map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={type === option}
                    onClick={() => {
                      setType(option);
                      setError(null);
                    }}
                    className={`h-9 rounded-lg border text-sm font-medium transition-colors ${focusRing} ${
                      type === option
                        ? "border-brand-primary bg-brand-primary text-white"
                        : "border-brand-border bg-brand-surface-card text-brand-text-soft hover:border-brand-primary hover:bg-brand-surface-muted hover:text-brand-primary"
                    }`}
                  >
                    {MOVEMENT_TYPE_LABEL[option]}
                  </button>
                ))}
              </div>
            </div>

            <label className="grid gap-1.5 text-sm font-medium text-brand-plum-900">
              {QUANTITY_LABEL[type]}
              {item ? ` (${item.unit})` : ""}
              <input
                inputMode="decimal"
                value={quantityRaw}
                onChange={(event) => setQuantityRaw(event.target.value)}
                aria-invalid={error?.field === "quantity"}
                aria-describedby={error?.field === "quantity" ? "movement-quantity-error" : undefined}
                className={`h-10 ${fieldClass}`}
              />
              {error?.field === "quantity" ? (
                <span id="movement-quantity-error" role="alert" className="text-xs font-normal text-brand-rose">
                  {error.message}
                </span>
              ) : null}
            </label>

            <label className="grid gap-1.5 text-sm font-medium text-brand-plum-900">
              Justificativa
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                aria-invalid={error?.field === "reason"}
                aria-describedby={error?.field === "reason" ? "movement-reason-error" : undefined}
                className={`py-2 ${fieldClass}`}
              />
              {error?.field === "reason" ? (
                <span id="movement-reason-error" role="alert" className="text-xs font-normal text-brand-rose">
                  {error.message}
                </span>
              ) : null}
            </label>

            {item && preview?.ok ? (
              <p className="rounded-lg bg-brand-surface-muted px-3 py-2 text-sm text-brand-plum-900">
                O saldo vai de {formatQuantity(item.balance, item.unit)} para {formatQuantity(preview.item.balance, item.unit)}.
              </p>
            ) : null}

            <div className="mt-auto flex justify-end gap-2 pt-2">
              <Dialog.Close
                className={`h-10 rounded-lg border border-brand-border bg-brand-surface-card px-4 text-sm font-medium text-brand-text-soft transition-colors hover:border-brand-primary hover:bg-brand-surface-muted hover:text-brand-primary ${focusRing}`}
              >
                Cancelar
              </Dialog.Close>
              <button
                type="submit"
                className={`h-10 rounded-lg bg-brand-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-primary-dark ${focusRing}`}
              >
                Salvar movimentação
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
