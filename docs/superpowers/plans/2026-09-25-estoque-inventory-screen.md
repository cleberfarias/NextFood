# Tela de Estoque — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/estoque`: stock balances with low-stock alerts, filters, a side panel to register movements (entrada, perda, ajuste, inventário) and a recent-movements log, on simulated in-memory data.

**Architecture:** All stock rules are pure functions in `back/domain/inventory/inventory.ts` (no Next/React/Firebase), unit-tested in isolation. The screen (`front/features/inventory/`) keeps `{ items, movements }` in a `useReducer` and only ever applies results that `applyMovement` has already validated. Radix Dialog anchored right is the movement panel.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind v4 brand tokens, `radix-ui` Dialog, `lucide-react`, Vitest + Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-09-25-estoque-inventory-screen-design.md`

## Global Constraints

- `back/domain/**` must not import `firebase-admin`, `next` or `react` (enforced by `back/architecture.test.ts`).
- Visual: reuse `--brand-*` tokens and `font-serif` (Fraunces); wrap the screen root and the dialog content in `.theme-light`. No new colors.
- UI copy is Portuguese, sentence case. Error messages exactly as listed in the spec.
- Business errors are returned as `{ ok: false, error: { field, message } }`, never thrown.
- Recent movements show at most 10, newest first. Author is fixed: `"Usuário local (simulação)"`.
- Tests run from `apps/web`: `pnpm test:unit -- <path>`; typecheck `pnpm typecheck`; lint `pnpm lint`.

## Review Focus

1. **Empty quantity with "Inventário"**: an empty field must not silently set the balance to 0. `parseQuantity("")` returns `NaN` and `applyMovement` rejects it with "Informe uma quantidade válida." (test in Task 1).
2. **Decimal input and float drift**: "1,5" and "1.5" both parse to 1.5, and 0.2 kg + 0.1 kg must be exactly 0.3 kg, not 0.30000000000000004 (tests in Task 1).
3. **Typed minus sign on "Ajuste"**: the label says "Diferença (+ ou −)", so a pasted "−2" (U+2212) must parse as -2 (test in Task 1).
4. **Fractional quantity for "un" items**: "1,5 copos" is not a real count; reject with "Use um número inteiro para itens em unidades." (added rule, test in Task 1).
5. **Reopening the panel**: after a failed attempt and Cancel, reopening must show a clean form with no stale error or values (test in Task 2).

---

### Task 1: Inventory domain rules

**Files:**
- Create: `apps/web/back/domain/inventory/inventory.ts`
- Test: `apps/web/back/domain/inventory/inventory.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (used by Task 2):
  - Types: `InventoryCategory = "insumo" | "produto"`, `InventoryUnit = "kg" | "un" | "L"`, `InventoryItem`, `MovementType = "entrada" | "perda" | "ajuste" | "inventario"`, `MovementInput = { type; quantity: number; reason: string }`, `Movement`, `MovementMeta = { id; author; createdAt }`, `MovementError = { field: "quantity" | "reason"; message }`, `MovementResult`, `StockStatus = "sem-estoque" | "baixo" | "ok"`.
  - `applyMovement(item: InventoryItem, input: MovementInput, meta: MovementMeta): MovementResult`
  - `stockStatus(item: InventoryItem): StockStatus`
  - `sortByCriticality(items: readonly InventoryItem[]): InventoryItem[]`
  - `formatQuantity(value: number, unit: InventoryUnit, options?: { signed?: boolean }): string`
  - `parseQuantity(raw: string): number`
  - `matchesSearch(item: InventoryItem, query: string): boolean`

- [ ] **Step 1: Write the failing tests**

`apps/web/back/domain/inventory/inventory.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  applyMovement,
  formatQuantity,
  matchesSearch,
  parseQuantity,
  sortByCriticality,
  stockStatus,
  type InventoryItem,
  type MovementInput,
} from "./inventory";

const META = { id: "m1", author: "Usuário local (simulação)", createdAt: "2026-09-25T12:00:00.000Z" };

function item(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return { id: "acai", name: "Polpa de açaí", category: "insumo", unit: "kg", balance: 2, minimum: 5, ...overrides };
}

function apply(target: InventoryItem, input: Partial<MovementInput>) {
  return applyMovement(target, { type: "entrada", quantity: 1, reason: "Motivo", ...input }, META);
}

describe("applyMovement", () => {
  it("adds an entrada to the balance", () => {
    const result = apply(item(), { type: "entrada", quantity: 10 });
    expect(result).toEqual({
      ok: true,
      item: item({ balance: 12 }),
      movement: { ...META, itemId: "acai", type: "entrada", reason: "Motivo", delta: 10, balanceAfter: 12 },
    });
  });

  it("subtracts a perda from the balance", () => {
    const result = apply(item(), { type: "perda", quantity: 0.5 });
    expect(result.ok && result.item.balance).toBe(1.5);
    expect(result.ok && result.movement.delta).toBe(-0.5);
  });

  it("applies a signed ajuste", () => {
    expect(apply(item(), { type: "ajuste", quantity: -1.5 })).toMatchObject({
      ok: true,
      item: { balance: 0.5 },
      movement: { delta: -1.5, balanceAfter: 0.5 },
    });
  });

  it("replaces the balance with the physical count on inventario and records the difference", () => {
    const result = apply(item({ balance: 2 }), { type: "inventario", quantity: 3.25 });
    expect(result).toMatchObject({ ok: true, item: { balance: 3.25 }, movement: { delta: 1.25, balanceAfter: 3.25 } });
  });

  it("accepts an inventario count of zero", () => {
    expect(apply(item(), { type: "inventario", quantity: 0 })).toMatchObject({ ok: true, item: { balance: 0 }, movement: { delta: -2 } });
  });

  it("trims the reason it stores", () => {
    const result = apply(item(), { reason: "  Recebimento  " });
    expect(result.ok && result.movement.reason).toBe("Recebimento");
  });

  it("rejects an empty reason first", () => {
    expect(apply(item(), { reason: "   ", quantity: Number.NaN })).toEqual({
      ok: false,
      error: { field: "reason", message: "Informe a justificativa." },
    });
  });

  it("rejects a non-numeric quantity (e.g. an empty field on inventario)", () => {
    expect(apply(item(), { type: "inventario", quantity: parseQuantity("") })).toEqual({
      ok: false,
      error: { field: "quantity", message: "Informe uma quantidade válida." },
    });
  });

  it("rejects fractional quantities for items counted in units", () => {
    expect(apply(item({ unit: "un", balance: 10 }), { quantity: 1.5 })).toEqual({
      ok: false,
      error: { field: "quantity", message: "Use um número inteiro para itens em unidades." },
    });
  });

  it.each(["entrada", "perda"] as const)("rejects %s with zero or negative quantity", (type) => {
    for (const quantity of [0, -1]) {
      expect(apply(item(), { type, quantity })).toEqual({
        ok: false,
        error: { field: "quantity", message: "A quantidade precisa ser maior que zero." },
      });
    }
  });

  it("rejects a zero ajuste", () => {
    expect(apply(item(), { type: "ajuste", quantity: 0 })).toEqual({
      ok: false,
      error: { field: "quantity", message: "O ajuste não pode ser zero." },
    });
  });

  it("rejects a negative inventario count", () => {
    expect(apply(item(), { type: "inventario", quantity: -1 })).toEqual({
      ok: false,
      error: { field: "quantity", message: "A contagem não pode ser negativa." },
    });
  });

  it("rejects a perda larger than the balance, citing the balance", () => {
    expect(apply(item({ balance: 2 }), { type: "perda", quantity: 3 })).toEqual({
      ok: false,
      error: { field: "quantity", message: "A perda de 3 kg é maior que o saldo de 2 kg." },
    });
  });

  it("rejects an ajuste that would make the balance negative", () => {
    expect(apply(item({ balance: 2 }), { type: "ajuste", quantity: -3 })).toEqual({
      ok: false,
      error: { field: "quantity", message: "O ajuste de -3 kg deixaria o saldo negativo (saldo atual: 2 kg)." },
    });
  });

  it("keeps decimal arithmetic exact to 3 places", () => {
    const result = apply(item({ balance: 0.2 }), { type: "entrada", quantity: 0.1 });
    expect(result.ok && result.item.balance).toBe(0.3);
    expect(result.ok && result.movement.delta).toBe(0.1);
  });
});

describe("stockStatus", () => {
  it("is sem-estoque at zero, baixo at or under the minimum, ok above it", () => {
    expect(stockStatus(item({ balance: 0, minimum: 5 }))).toBe("sem-estoque");
    expect(stockStatus(item({ balance: 5, minimum: 5 }))).toBe("baixo");
    expect(stockStatus(item({ balance: 4.9, minimum: 5 }))).toBe("baixo");
    expect(stockStatus(item({ balance: 5.1, minimum: 5 }))).toBe("ok");
  });
});

describe("sortByCriticality", () => {
  it("puts sem-estoque first, then baixo, then ok, by name within each group", () => {
    const items = [
      item({ id: "c", name: "Copo", balance: 50, minimum: 10 }),
      item({ id: "b", name: "Banana", balance: 1, minimum: 2 }),
      item({ id: "m", name: "Morango", balance: 0, minimum: 1 }),
      item({ id: "a", name: "Açaí", balance: 1, minimum: 5 }),
    ];
    expect(sortByCriticality(items).map((entry) => entry.id)).toEqual(["m", "a", "b", "c"]);
    expect(items[0].id).toBe("c");
  });
});

describe("formatQuantity", () => {
  it("formats in pt-BR with the unit", () => {
    expect(formatQuantity(1.2, "kg")).toBe("1,2 kg");
    expect(formatQuantity(0.125, "L")).toBe("0,125 L");
    expect(formatQuantity(40, "un")).toBe("40 un");
    expect(formatQuantity(1500, "un")).toBe("1.500 un");
  });

  it("shows the sign when asked", () => {
    expect(formatQuantity(10, "kg", { signed: true })).toBe("+10 kg");
    expect(formatQuantity(-3, "un", { signed: true })).toBe("-3 un");
  });
});

describe("parseQuantity", () => {
  it("accepts comma or dot decimals", () => {
    expect(parseQuantity("1,5")).toBe(1.5);
    expect(parseQuantity("1.5")).toBe(1.5);
    expect(parseQuantity(" 10 ")).toBe(10);
  });

  it("accepts a typographic minus", () => {
    expect(parseQuantity("−2")).toBe(-2);
    expect(parseQuantity("-2,5")).toBe(-2.5);
  });

  it("returns NaN for empty or non-numeric input", () => {
    expect(parseQuantity("")).toBeNaN();
    expect(parseQuantity("   ")).toBeNaN();
    expect(parseQuantity("abc")).toBeNaN();
  });
});

describe("matchesSearch", () => {
  it("ignores case and accents, and matches everything on an empty query", () => {
    const acai = item({ name: "Polpa de açaí" });
    expect(matchesSearch(acai, "ACAI")).toBe(true);
    expect(matchesSearch(acai, "polpa")).toBe(true);
    expect(matchesSearch(acai, "granola")).toBe(false);
    expect(matchesSearch(acai, "  ")).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test:unit -- back/domain/inventory`
Expected: FAIL with `Failed to resolve import "./inventory"`.

- [ ] **Step 3: Implement the domain module**

`apps/web/back/domain/inventory/inventory.ts`:

```ts
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

/** Parses what a person types: "1,5", "1.5" or "−2" (typographic minus). Empty or garbage is NaN. */
export function parseQuantity(raw: string): number {
  const cleaned = raw.trim().replace(/[−–]/g, "-").replace(/\s+/g, "");
  if (cleaned === "") return Number.NaN;
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test:unit -- back/domain/inventory`
Expected: PASS (all tests in `inventory.test.ts`), and `back/architecture.test.ts` still passes.

- [ ] **Step 5: Commit**

```bash
git add apps/web/back/domain/inventory/inventory.ts apps/web/back/domain/inventory/inventory.test.ts
git commit -m "feat(estoque): regras de domínio de saldo e movimentações"
```

---

### Task 2: `/estoque` screen

**Files:**
- Create: `apps/web/front/features/inventory/inventory-mocks.ts`
- Create: `apps/web/front/features/inventory/inventory-ui.tsx`
- Create: `apps/web/front/features/inventory/movement-panel.tsx`
- Create: `apps/web/front/features/inventory/inventory-experience.tsx`
- Modify: `apps/web/app/estoque/page.tsx` (replace the `ComingSoon` placeholder)
- Test: `apps/web/front/features/inventory/inventory-experience.test.tsx`

**Interfaces:**
- Consumes (Task 1, from `@/back/domain/inventory/inventory`): `applyMovement`, `stockStatus`, `sortByCriticality`, `formatQuantity`, `parseQuantity`, `matchesSearch`, and the types listed in Task 1. From the home feature: `BrandMark({ subtitle: string })` in `@/front/features/home/brand-mark`.
- Produces: `InventoryExperience({ initialItems?: readonly InventoryItem[] })`, the client component rendered by `app/estoque/page.tsx`.

- [ ] **Step 1: Write the failing screen tests**

`apps/web/front/features/inventory/inventory-experience.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { InventoryExperience } from "./inventory-experience";

afterEach(cleanup);

function lowStockBanner() {
  return screen.getByRole("region", { name: "Itens com estoque baixo" });
}

function itemRow(name: string) {
  return screen.getByRole("listitem", { name });
}

function registerEntrada(itemName: string, quantity: string, reason: string) {
  fireEvent.click(screen.getByRole("button", { name: `Movimentar ${itemName}` }));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText(/quantidade recebida/i), { target: { value: quantity } });
  fireEvent.change(within(dialog).getByLabelText("Justificativa"), { target: { value: reason } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Salvar movimentação" }));
}

describe("InventoryExperience", () => {
  it("lists the low and empty items in the alert banner", () => {
    render(<InventoryExperience />);
    const banner = lowStockBanner();
    expect(within(banner).getByText(/4 itens precisam de reposição/)).toBeInTheDocument();
    expect(within(banner).getByText("Polpa de açaí: 1,2 kg (mínimo 5 kg)")).toBeInTheDocument();
    expect(within(banner).getByText(/Morango/)).toBeInTheDocument();
  });

  it("filters the list down to low stock from the banner", () => {
    render(<InventoryExperience />);
    fireEvent.click(within(lowStockBanner()).getByRole("button", { name: "Ver só esses itens" }));
    const list = screen.getByRole("list", { name: "Itens do estoque" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByRole("checkbox", { name: "Só estoque baixo" })).toBeChecked();
  });

  it("finds items ignoring accents and shows an empty state with a reset", () => {
    render(<InventoryExperience />);
    fireEvent.change(screen.getByLabelText("Buscar item"), { target: { value: "acai" } });
    expect(within(screen.getByRole("list", { name: "Itens do estoque" })).getAllByRole("listitem")).toHaveLength(1);

    fireEvent.change(screen.getByLabelText("Buscar item"), { target: { value: "inexistente" } });
    expect(screen.getByText("Nenhum item encontrado com esses filtros.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(within(screen.getByRole("list", { name: "Itens do estoque" })).getAllByRole("listitem")).toHaveLength(12);
  });

  it("registers an entrada, updates the balance and clears the alert for that item", () => {
    render(<InventoryExperience />);
    registerEntrada("Polpa de açaí", "10", "Recebimento do fornecedor");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(within(itemRow("Polpa de açaí")).getByText("11,2 kg")).toBeInTheDocument();
    expect(within(lowStockBanner()).queryByText(/Polpa de açaí/)).not.toBeInTheDocument();

    const history = screen.getByRole("region", { name: "Movimentações recentes" });
    expect(within(history).getByText("Recebimento do fornecedor")).toBeInTheDocument();
    expect(within(history).getByText("+10 kg")).toBeInTheDocument();
  });

  it("keeps the panel open with the message when the reason is empty", () => {
    render(<InventoryExperience />);
    registerEntrada("Polpa de açaí", "10", "   ");

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Informe a justificativa.")).toBeInTheDocument();
    expect(within(itemRow("Polpa de açaí")).getByText("1,2 kg")).toBeInTheDocument();
  });

  it("previews the resulting balance before saving", () => {
    render(<InventoryExperience />);
    fireEvent.click(screen.getByRole("button", { name: "Movimentar Polpa de açaí" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/quantidade recebida/i), { target: { value: "10" } });
    expect(within(dialog).getByText("O saldo vai de 1,2 kg para 11,2 kg.")).toBeInTheDocument();
  });

  it("changes the quantity label with the movement type", () => {
    render(<InventoryExperience />);
    fireEvent.click(screen.getByRole("button", { name: "Movimentar Polpa de açaí" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("radio", { name: "Inventário" }));
    expect(within(dialog).getByLabelText(/contagem física/i)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("radio", { name: "Ajuste" }));
    expect(within(dialog).getByLabelText(/diferença/i)).toBeInTheDocument();
  });

  it("reopens the panel with a clean form after a failed attempt", () => {
    render(<InventoryExperience />);
    registerEntrada("Polpa de açaí", "10", "");
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));

    fireEvent.click(screen.getByRole("button", { name: "Movimentar Polpa de açaí" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByText("Informe a justificativa.")).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText(/quantidade recebida/i)).toHaveValue("");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test:unit -- front/features/inventory`
Expected: FAIL with `Failed to resolve import "./inventory-experience"`.

- [ ] **Step 3: Add the simulated data**

`apps/web/front/features/inventory/inventory-mocks.ts`:

```ts
import type { InventoryItem } from "@/back/domain/inventory/inventory";

export const MOVEMENT_AUTHOR = "Usuário local (simulação)";

// Morango starts empty and three items start at or under their minimum, so
// the low-stock banner is visible on first load.
export const INVENTORY_ITEMS: readonly InventoryItem[] = [
  { id: "polpa-acai", name: "Polpa de açaí", category: "insumo", unit: "kg", balance: 1.2, minimum: 5 },
  { id: "granola", name: "Granola", category: "insumo", unit: "kg", balance: 3.5, minimum: 2 },
  { id: "leite-condensado", name: "Leite condensado", category: "insumo", unit: "un", balance: 4, minimum: 6 },
  { id: "pacoca", name: "Paçoca", category: "insumo", unit: "un", balance: 30, minimum: 10 },
  { id: "banana", name: "Banana", category: "insumo", unit: "kg", balance: 2, minimum: 1.5 },
  { id: "morango", name: "Morango", category: "insumo", unit: "kg", balance: 0, minimum: 1 },
  { id: "confete", name: "Confete", category: "insumo", unit: "kg", balance: 0.8, minimum: 0.5 },
  { id: "copo-300", name: "Copo 300 ml", category: "insumo", unit: "un", balance: 180, minimum: 50 },
  { id: "copo-500", name: "Copo 500 ml", category: "insumo", unit: "un", balance: 40, minimum: 50 },
  { id: "colher", name: "Colheres", category: "insumo", unit: "un", balance: 500, minimum: 100 },
  { id: "pote-1l", name: "Pote 1 L", category: "insumo", unit: "un", balance: 12, minimum: 10 },
  { id: "picole", name: "Picolé cremoso", category: "produto", unit: "un", balance: 25, minimum: 20 },
];
```

- [ ] **Step 4: Add the presentational pieces**

`apps/web/front/features/inventory/inventory-ui.tsx`:

```tsx
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
```

- [ ] **Step 5: Add the movement panel**

`apps/web/front/features/inventory/movement-panel.tsx`:

```tsx
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
```

- [ ] **Step 6: Add the screen**

`apps/web/front/features/inventory/inventory-experience.tsx`:

```tsx
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
import { INVENTORY_ITEMS, MOVEMENT_AUTHOR } from "./inventory-mocks";
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

export function InventoryExperience({ initialItems = INVENTORY_ITEMS }: { initialItems?: readonly InventoryItem[] }) {
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
```

- [ ] **Step 7: Route `/estoque` to the screen**

`apps/web/app/estoque/page.tsx` (full replacement):

```tsx
import { InventoryExperience } from "@/front/features/inventory/inventory-experience";

export default function EstoquePage() {
  return <InventoryExperience />;
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `pnpm test:unit -- front/features/inventory`
Expected: PASS (8 tests). Then run the whole suite, `pnpm test:unit`, plus `pnpm typecheck` and `pnpm lint`, all clean.

- [ ] **Step 9: Verify in the browser**

With the dev server running, open `/estoque`:
- Desktop (1440×900) and mobile (390×844): banner, filters and list render without overlap or horizontal scroll; on mobile each item is a card with "Saldo" and "Mínimo" labels.
- Hover every outline button (Início, category filters, Movimentar, Cancelar, Limpar filtros, the panel's type buttons): background `rgb(243, 233, 228)`, text/border `rgb(113, 20, 91)` via `getComputedStyle` while `:hover`.
- Full flow: "Movimentar" on Polpa de açaí → entrada 10 → justificativa → Salvar. The row shows 11,2 kg, Polpa leaves the banner, and the history lists the movement.
- Error flow: perda of 100 on Granola shows "A perda de 100 kg é maior que o saldo de 3,5 kg." under the quantity field, and the panel stays open.

- [ ] **Step 10: Commit**

```bash
git add apps/web/front/features/inventory apps/web/app/estoque/page.tsx
git commit -m "feat(estoque): tela de saldos, alertas e movimentações com dados simulados"
```
