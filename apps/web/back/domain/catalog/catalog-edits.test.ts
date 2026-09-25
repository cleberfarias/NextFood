import { describe, expect, it } from "vitest";
import type { Catalog, ReadyCupProduct, UnitProduct } from "./catalog";
import { saveComplement, savePackaging, saveProduct, setActive, slugId, type EditResult } from "./catalog-edits";

function baseCatalog(): Catalog {
  return {
    stockItems: [
      { id: "polpa", name: "Polpa", category: "insumo", unit: "kg", balance: 1, minimum: 1 },
      { id: "copo", name: "Copo", category: "insumo", unit: "un", balance: 10, minimum: 1 },
      { id: "granola", name: "Granola", category: "insumo", unit: "kg", balance: 1, minimum: 1 },
    ],
    packagings: [{ id: "copo", name: "Copo", active: true, stockItemId: "copo", tareKg: 0.01 }],
    complements: [{ id: "granola", name: "Granola", active: true, extraPrice: 2.5, stockItemId: "granola" }],
    products: [
      { kind: "peso", id: "acai", name: "Açaí", active: true, pricePerKg: 40, packagingIds: ["copo"], consumesPerKg: [{ itemId: "polpa", quantity: 0.8 }] },
      { kind: "unidade", id: "avulso", name: "Copo avulso", active: true, price: 10, consumes: [{ itemId: "copo", quantity: 1 }] },
    ],
  };
}

function expectOk(result: EditResult): Catalog {
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result.errors)}`);
  return result.catalog;
}

describe("slugId", () => {
  it("builds a readable id and avoids the ones already taken", () => {
    expect(slugId("Copo 700 ml", [])).toBe("copo-700-ml");
    expect(slugId(" Açaí Grande! ", [])).toBe("acai-grande");
    expect(slugId("Copo", ["copo", "copo-2"])).toBe("copo-3");
    expect(slugId("  !!  ", [])).toBe("item");
  });
});

describe("saveProduct", () => {
  it("appends a new ready cup with a generated id and a trimmed name", () => {
    const draft: ReadyCupProduct = { kind: "pronto", id: "", name: " Copo pronto 700 ml ", active: true, price: 20, packagingId: "copo", includedComplements: 4, consumes: [] };
    const catalog = expectOk(saveProduct(baseCatalog(), draft));
    expect(catalog.products.map((product) => product.id)).toEqual(["acai", "avulso", "copo-pronto-700-ml"]);
    expect(catalog.products[2].name).toBe("Copo pronto 700 ml");
  });

  it("creates a stock item for a new unit product when asked to track its stock", () => {
    const draft: UnitProduct = { kind: "unidade", id: "", name: "Picolé de uva", active: true, price: 7, consumes: [] };
    const catalog = expectOk(saveProduct(baseCatalog(), draft, { trackStock: true }));
    expect(catalog.stockItems).toContainEqual({ id: "picole-de-uva", name: "Picolé de uva", category: "produto", unit: "un", balance: 0, minimum: 0 });
    expect(catalog.products.find((product) => product.id === "picole-de-uva")).toMatchObject({ consumes: [{ itemId: "picole-de-uva", quantity: 1 }] });
  });

  it("does not create a stock item when stock tracking is off", () => {
    const draft: UnitProduct = { kind: "unidade", id: "", name: "Água", active: true, price: 3, consumes: [] };
    expect(expectOk(saveProduct(baseCatalog(), draft)).stockItems).toHaveLength(3);
  });

  it("refuses a second product sold by weight", () => {
    const draft = { ...baseCatalog().products[0], id: "" };
    expect(saveProduct(baseCatalog(), draft)).toEqual({ ok: false, errors: [{ path: "products", message: "Só pode existir um açaí por peso." }] });
  });

  it("refuses to change the kind of an existing product", () => {
    const draft: ReadyCupProduct = { kind: "pronto", id: "avulso", name: "Copo avulso", active: true, price: 10, packagingId: "copo", includedComplements: 1, consumes: [] };
    expect(saveProduct(baseCatalog(), draft)).toEqual({ ok: false, errors: [{ path: "products[avulso]", message: "O tipo do produto não pode mudar." }] });
  });

  it("replaces an existing product in place", () => {
    const base = baseCatalog();
    const catalog = expectOk(saveProduct(base, { ...(base.products[1] as UnitProduct), price: 12 }));
    expect(catalog.products.map((product) => product.id)).toEqual(["acai", "avulso"]);
    expect(catalog.products[1]).toMatchObject({ price: 12 });
  });

  it("returns the errors and leaves the catalog untouched when the edit is invalid", () => {
    const base = baseCatalog();
    const result = saveProduct(base, { ...base.products[0], pricePerKg: 0 } as typeof base.products[0]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContainEqual({ path: "products[acai]", message: "O preço precisa ser maior que zero." });
    expect(base.products[0]).toMatchObject({ pricePerKg: 40 });
  });
});

describe("saveComplement", () => {
  it("creates the stock item of a new complement with the chosen unit", () => {
    const catalog = expectOk(saveComplement(baseCatalog(), { id: "", name: "Mel", active: true, extraPrice: 1.5, stockItemId: "" }, { stockUnit: "L" }));
    expect(catalog.complements.at(-1)).toEqual({ id: "mel", name: "Mel", active: true, extraPrice: 1.5, stockItemId: "mel" });
    expect(catalog.stockItems).toContainEqual({ id: "mel", name: "Mel", category: "insumo", unit: "L", balance: 0, minimum: 0 });
  });

  it("uses kg for the stock item when no unit is chosen", () => {
    const catalog = expectOk(saveComplement(baseCatalog(), { id: "", name: "Aveia", active: true, extraPrice: 1, stockItemId: "" }));
    expect(catalog.stockItems.find((item) => item.id === "aveia")?.unit).toBe("kg");
  });

  it("renames a complement without renaming its stock item", () => {
    const base = baseCatalog();
    const catalog = expectOk(saveComplement(base, { ...base.complements[0], name: "Granola crocante" }));
    expect(catalog.complements[0].name).toBe("Granola crocante");
    expect(catalog.stockItems.find((item) => item.id === "granola")?.name).toBe("Granola");
  });

  it("refuses a new complement without a name", () => {
    const result = saveComplement(baseCatalog(), { id: "", name: "  ", active: true, extraPrice: 1, stockItemId: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContainEqual(expect.objectContaining({ message: "Informe o nome." }));
  });
});

describe("savePackaging", () => {
  it("creates a stock item counted in units for a new packaging", () => {
    const catalog = expectOk(savePackaging(baseCatalog(), { id: "", name: "Copo 700 ml", active: true, stockItemId: "", tareKg: 0.02 }));
    expect(catalog.packagings.at(-1)).toEqual({ id: "copo-700-ml", name: "Copo 700 ml", active: true, stockItemId: "copo-700-ml", tareKg: 0.02 });
    expect(catalog.stockItems).toContainEqual({ id: "copo-700-ml", name: "Copo 700 ml", category: "insumo", unit: "un", balance: 0, minimum: 0 });
  });

  it("gives the new packaging and its stock item ids that are free in each list", () => {
    const catalog = expectOk(savePackaging(baseCatalog(), { id: "", name: "Copo", active: true, stockItemId: "", tareKg: 0.01 }));
    expect(catalog.packagings.at(-1)).toMatchObject({ id: "copo-2", stockItemId: "copo-2" });
  });
});

describe("setActive", () => {
  it("refuses to disable the product sold by weight", () => {
    const result = setActive(baseCatalog(), "products", "acai", false);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContainEqual({ path: "products", message: "O catálogo precisa de um açaí por peso ativo." });
  });

  it("refuses to disable a packaging an active product still uses", () => {
    const result = setActive(baseCatalog(), "packagings", "copo", false);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContainEqual({ path: "products[acai].packagingIds", message: "A embalagem Copo está desativada." });
  });

  it("disables a complement", () => {
    expect(expectOk(setActive(baseCatalog(), "complements", "granola", false)).complements[0].active).toBe(false);
  });
});
