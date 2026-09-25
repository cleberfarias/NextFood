export type InventoryCategory = "insumo" | "produto";
export type InventoryUnit = "kg" | "un" | "L";

export type InventoryItem = {
  id: string;
  name: string;
  category: InventoryCategory;
  unit: InventoryUnit;
  balance: number;
  minimum: number;
};

export type MovementType = "entrada" | "perda" | "ajuste" | "inventario";

export type MovementInput = { type: MovementType; quantity: number; reason: string };

export type Movement = {
  id: string;
  itemId: string;
  type: MovementType;
  reason: string;
  author: string;
  createdAt: string;
  delta: number;
  balanceAfter: number;
};

export type MovementMeta = { id: string; author: string; createdAt: string };
export type MovementError = { field: "quantity" | "reason"; message: string };
export type MovementResult =
  | { ok: true; item: InventoryItem; movement: Movement }
  | { ok: false; error: MovementError };

export type StockStatus = "sem-estoque" | "baixo" | "ok";

// Balances are kg/L with up to 3 decimals; rounding every result keeps
// 0.2 + 0.1 at 0.3 instead of accumulating binary float drift.
function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function fail(field: MovementError["field"], message: string): MovementResult {
  return { ok: false, error: { field, message } };
}

function nextBalance(balance: number, type: MovementType, quantity: number): number {
  switch (type) {
    case "entrada":
      return balance + quantity;
    case "perda":
      return balance - quantity;
    case "ajuste":
      return balance + quantity;
    case "inventario":
      return quantity;
  }
}

export function formatQuantity(value: number, unit: InventoryUnit, options: { signed?: boolean } = {}): string {
  const formatter = new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: unit === "un" ? 0 : 3,
    signDisplay: options.signed ? "exceptZero" : "auto",
  });
  return `${formatter.format(value)} ${unit}`;
}

// "1.000" with no comma: pt-BR thousands, or an English-style decimal?
const THOUSANDS_DOTS = /^[+-]?[1-9]\d{0,2}(\.\d{3})+$/;

/**
 * Parses what a person types: "1,5", "1.5" or "−2" (typographic minus). Empty or garbage is NaN.
 * A lone "1.000" is thousands for whole-unit items; for kg/L it is ambiguous, so it is NaN
 * rather than a silent 1 or 1000.
 */
export function parseQuantity(raw: string, unit?: InventoryUnit): number {
  const cleaned = raw.trim().replace(/[−–]/g, "-").replace(/\s+/g, "");
  if (cleaned === "") return Number.NaN;
  if (!cleaned.includes(",") && THOUSANDS_DOTS.test(cleaned)) {
    return unit === "un" ? Number(cleaned.replace(/\./g, "")) : Number.NaN;
  }
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  return Number(normalized);
}

export function applyMovement(item: InventoryItem, input: MovementInput, meta: MovementMeta): MovementResult {
  const reason = input.reason.trim();
  const { type, quantity } = input;

  if (reason === "") return fail("reason", "Informe a justificativa.");
  if (!Number.isFinite(quantity)) return fail("quantity", "Informe uma quantidade válida.");
  if (item.unit === "un" && !Number.isInteger(quantity)) {
    return fail("quantity", "Use um número inteiro para itens em unidades.");
  }
  if ((type === "entrada" || type === "perda") && quantity <= 0) {
    return fail("quantity", "A quantidade precisa ser maior que zero.");
  }
  if (type === "ajuste" && quantity === 0) return fail("quantity", "O ajuste não pode ser zero.");
  if (type === "inventario" && quantity < 0) return fail("quantity", "A contagem não pode ser negativa.");

  const balanceAfter = round3(nextBalance(item.balance, type, quantity));
  if (balanceAfter < 0) {
    const current = formatQuantity(item.balance, item.unit);
    return fail(
      "quantity",
      type === "perda"
        ? `A perda de ${formatQuantity(quantity, item.unit)} é maior que o saldo de ${current}.`
        : `O ajuste de ${formatQuantity(quantity, item.unit, { signed: true })} deixaria o saldo negativo (saldo atual: ${current}).`,
    );
  }

  return {
    ok: true,
    item: { ...item, balance: balanceAfter },
    movement: {
      id: meta.id,
      itemId: item.id,
      type,
      reason,
      author: meta.author,
      createdAt: meta.createdAt,
      delta: round3(balanceAfter - item.balance),
      balanceAfter,
    },
  };
}

export function stockStatus(item: InventoryItem): StockStatus {
  if (item.balance <= 0) return "sem-estoque";
  if (item.balance <= item.minimum) return "baixo";
  return "ok";
}

const STATUS_RANK: Record<StockStatus, number> = { "sem-estoque": 0, baixo: 1, ok: 2 };

export function sortByCriticality(items: readonly InventoryItem[]): InventoryItem[] {
  return [...items].sort(
    (a, b) => STATUS_RANK[stockStatus(a)] - STATUS_RANK[stockStatus(b)] || a.name.localeCompare(b.name, "pt-BR"),
  );
}

function normalizeForSearch(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function matchesSearch(item: InventoryItem, query: string): boolean {
  const needle = normalizeForSearch(query.trim());
  return needle === "" || normalizeForSearch(item.name).includes(needle);
}
