import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import {
  formatQuantity,
  stockStatus,
  type InventoryCategory,
  type InventoryItem,
  type Movement,
  type MovementType,
  type StockStatus,
} from "@/back/domain/inventory/inventory";
import { MOVEMENT_AUTHOR } from "./inventory-mocks";

export const MOVEMENT_TYPE_LABEL: Record<MovementType, string> = {
  entrada: "Entrada",
  perda: "Perda",
  ajuste: "Ajuste",
  inventario: "Inventário",
};

const CATEGORY_LABEL: Record<InventoryCategory, string> = { insumo: "Insumo", produto: "Produto" };

const STATUS_LABEL: Record<StockStatus, string> = { "sem-estoque": "Sem estoque", baixo: "Baixo", ok: "Ok" };
const STATUS_STYLE: Record<StockStatus, string> = {
  "sem-estoque": "bg-brand-rose text-white",
  baixo: "bg-brand-accent-peach text-brand-plum-900",
  ok: "bg-brand-surface-muted text-brand-plum-900",
};

export const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary";

export function StockStatusBadge({ status }: { status: StockStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[status]}`}>
      {status === "ok" ? <span aria-hidden="true" className="size-1.5 rounded-full bg-brand-success" /> : null}
      {STATUS_LABEL[status]}
    </span>
  );
}

export function LowStockBanner({ items, onShowLow }: { items: readonly InventoryItem[]; onShowLow: () => void }) {
  if (items.length === 0) return null;
  return (
    <section
      aria-label="Itens com estoque baixo"
      className="flex flex-col gap-3 rounded-2xl border border-brand-rose/30 bg-brand-surface-muted p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex gap-3">
        <TriangleAlert className="mt-0.5 size-5 shrink-0 text-brand-rose" />
        <div>
          <p className="font-semibold text-brand-plum-950">
            {items.length === 1 ? "1 item precisa de reposição" : `${items.length} itens precisam de reposição`}
          </p>
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-brand-text-soft">
            {items.map((entry) => (
              <li key={entry.id}>
                {entry.name}: {formatQuantity(entry.balance, entry.unit)} (mínimo {formatQuantity(entry.minimum, entry.unit)})
              </li>
            ))}
          </ul>
        </div>
      </div>
      <button
        type="button"
        onClick={onShowLow}
        className={`h-9 shrink-0 rounded-lg bg-brand-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-primary-dark ${focusRing}`}
      >
        Ver só esses itens
      </button>
    </section>
  );
}

function MobileLabeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="block text-xs text-brand-text-muted md:hidden">{label}</span>
      {children}
    </div>
  );
}

const ROW_GRID = "md:grid md:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_1fr_auto] md:items-center md:gap-4";

export function InventoryList({ items, onMove }: { items: readonly InventoryItem[]; onMove: (itemId: string) => void }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface-card">
      <div aria-hidden="true" className={`hidden border-b border-brand-border px-5 py-3 text-xs font-semibold text-brand-text-muted ${ROW_GRID}`}>
        <span>Item</span>
        <span>Categoria</span>
        <span>Saldo</span>
        <span>Mínimo</span>
        <span>Status</span>
        <span className="w-24" />
      </div>
      <ul aria-label="Itens do estoque">
        {items.map((entry) => {
          const status = stockStatus(entry);
          return (
            <li key={entry.id} aria-label={entry.name} className={`flex flex-col gap-3 border-b border-brand-border px-5 py-4 last:border-0 ${ROW_GRID}`}>
              <div className="flex items-center justify-between gap-3 md:block">
                <span className="font-medium text-brand-plum-900">{entry.name}</span>
                <span className="md:hidden">
                  <StockStatusBadge status={status} />
                </span>
              </div>
              <span className="hidden text-sm text-brand-text-soft md:block">{CATEGORY_LABEL[entry.category]}</span>
              <div className="flex gap-8 md:contents">
                <MobileLabeled label="Saldo">
                  <strong className="font-serif text-lg font-semibold text-brand-plum-950">{formatQuantity(entry.balance, entry.unit)}</strong>
                </MobileLabeled>
                <MobileLabeled label="Mínimo">
                  <span className="text-sm text-brand-text-soft">{formatQuantity(entry.minimum, entry.unit)}</span>
                </MobileLabeled>
              </div>
              <span className="hidden md:block">
                <StockStatusBadge status={status} />
              </span>
              <button
                type="button"
                aria-label={`Movimentar ${entry.name}`}
                onClick={() => onMove(entry.id)}
                className={`h-9 w-full rounded-lg border border-brand-border bg-brand-surface-card px-3 text-sm font-medium text-brand-text-soft transition-colors hover:border-brand-primary hover:bg-brand-surface-muted hover:text-brand-primary md:w-24 ${focusRing}`}
              >
                Movimentar
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const timeFormat = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

export function RecentMovements({ movements, items }: { movements: readonly Movement[]; items: readonly InventoryItem[] }) {
  const byId = new Map(items.map((entry) => [entry.id, entry]));
  return (
    <section aria-label="Movimentações recentes" className="rounded-2xl border border-brand-border bg-brand-surface-card p-5">
      <h2 className="font-serif text-xl font-semibold text-brand-plum-950">Movimentações recentes</h2>
      <p className="mt-1 text-xs text-brand-text-muted">Registradas por {MOVEMENT_AUTHOR}.</p>
      {movements.length === 0 ? (
        <p className="mt-3 text-sm text-brand-text-muted">
          Nenhuma movimentação registrada ainda. Use “Registrar movimentação” para lançar entradas, perdas, ajustes ou inventários.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-brand-border">
          {movements.slice(0, 10).map((movement) => {
            const entry = byId.get(movement.itemId);
            if (!entry) return null;
            return (
              <li key={movement.id} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 py-3 text-sm">
                <span className="font-medium text-brand-plum-900">{entry.name}</span>
                <span className={`text-right font-semibold tabular-nums ${movement.delta < 0 ? "text-brand-rose" : "text-brand-plum-900"}`}>
                  {formatQuantity(movement.delta, entry.unit, { signed: true })}
                </span>
                <span className="text-brand-text-soft">
                  <span className="font-medium text-brand-plum-900">{MOVEMENT_TYPE_LABEL[movement.type]}:</span> {movement.reason}
                </span>
                <span className="text-right text-xs text-brand-text-muted">{timeFormat.format(new Date(movement.createdAt))}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
