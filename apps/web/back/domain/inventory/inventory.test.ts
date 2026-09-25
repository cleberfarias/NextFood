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
