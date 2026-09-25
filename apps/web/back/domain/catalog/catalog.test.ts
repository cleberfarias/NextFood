import { describe, expect, it } from "vitest";
import { unitProducts, validateCatalog, weighedProduct, type Catalog, type SaleProduct, type UnitProduct } from "./catalog";

function validCatalog(): Catalog {
  return {
    stockItems: [
      { id: "polpa", name: "Polpa", category: "insumo", unit: "kg", balance: 1, minimum: 1 },
      { id: "copo", name: "Copo", category: "insumo", unit: "un", balance: 10, minimum: 1 },
      { id: "granola", name: "Granola", category: "insumo", unit: "kg", balance: 1, minimum: 1 },
    ],
    // Same id as the stock item on purpose: uniqueness is per list.
    packagings: [{ id: "copo", name: "Copo", stockItemId: "copo", tareKg: 0.01 }],
    complements: [{ id: "granola", name: "Granola", extraPrice: 2.5, stockItemId: "granola" }],
    products: [
      { kind: "peso", id: "acai", name: "Açaí", pricePerKg: 40, packagingIds: ["copo"], consumesPerKg: [{ itemId: "polpa", quantity: 0.8 }] },
      { kind: "pronto", id: "pronto", name: "Pronto", price: 15, packagingId: "copo", includedComplements: 3, consumes: [{ itemId: "polpa", quantity: 0.35 }] },
      { kind: "unidade", id: "avulso", name: "Copo avulso", price: 10, consumes: [{ itemId: "copo", quantity: 1 }] },
    ],
  };
}

function withProduct(id: string, patch: Record<string, unknown>): Catalog {
  const catalog = validCatalog();
  return { ...catalog, products: catalog.products.map((product) => (product.id === id ? ({ ...product, ...patch } as SaleProduct) : product)) };
}

describe("validateCatalog", () => {
  it("returns no errors for a valid catalog, even with the same id in different lists", () => {
    expect(validateCatalog(validCatalog())).toEqual([]);
  });

  it("rejects a repeated id inside one list", () => {
    const catalog = validCatalog();
    const errors = validateCatalog({ ...catalog, stockItems: [...catalog.stockItems, catalog.stockItems[0]] });
    expect(errors).toContainEqual({ path: "stockItems[polpa]", message: "Id repetido: polpa." });
  });

  it("rejects a reference to a missing stock item", () => {
    expect(validateCatalog(withProduct("avulso", { consumes: [{ itemId: "nada", quantity: 1 }] }))).toContainEqual({
      path: "products[avulso].consumes[0]",
      message: "Item de estoque não encontrado: nada.",
    });
  });

  it("rejects a reference to a missing packaging", () => {
    expect(validateCatalog(withProduct("pronto", { packagingId: "x" }))).toContainEqual({
      path: "products[pronto].packagingId",
      message: "Embalagem não encontrada: x.",
    });
    expect(validateCatalog(withProduct("acai", { packagingIds: ["copo", "y"] }))).toContainEqual({
      path: "products[acai].packagingIds",
      message: "Embalagem não encontrada: y.",
    });
  });

  it("rejects a price that is zero, negative or not a number", () => {
    const message = "O preço precisa ser maior que zero.";
    expect(validateCatalog(withProduct("acai", { pricePerKg: 0 }))).toContainEqual({ path: "products[acai]", message });
    expect(validateCatalog(withProduct("pronto", { price: -1 }))).toContainEqual({ path: "products[pronto]", message });
    expect(validateCatalog(withProduct("avulso", { price: Number.NaN }))).toContainEqual({ path: "products[avulso]", message });
  });

  it("rejects a negative extra price but accepts zero", () => {
    const catalog = validCatalog();
    const negative = { ...catalog, complements: [{ ...catalog.complements[0], extraPrice: -1 }] };
    expect(validateCatalog(negative)).toContainEqual({ path: "complements[granola]", message: "O adicional não pode ser negativo." });
    expect(validateCatalog({ ...catalog, complements: [{ ...catalog.complements[0], extraPrice: 0 }] })).toEqual([]);
  });

  it("rejects a negative tare", () => {
    const catalog = validCatalog();
    const errors = validateCatalog({ ...catalog, packagings: [{ ...catalog.packagings[0], tareKg: -0.01 }] });
    expect(errors).toContainEqual({ path: "packagings[copo]", message: "A tara não pode ser negativa." });
  });

  it("rejects a fractional or negative number of included complements", () => {
    const message = "Informe um número inteiro de complementos incluídos.";
    expect(validateCatalog(withProduct("pronto", { includedComplements: 1.5 }))).toContainEqual({ path: "products[pronto]", message });
    expect(validateCatalog(withProduct("pronto", { includedComplements: -1 }))).toContainEqual({ path: "products[pronto]", message });
  });

  it("rejects a consumption of zero", () => {
    expect(validateCatalog(withProduct("pronto", { consumes: [{ itemId: "polpa", quantity: 0 }] }))).toContainEqual({
      path: "products[pronto].consumes[0]",
      message: "O consumo precisa ser maior que zero.",
    });
  });

  it("rejects a fractional consumption of an item counted in units", () => {
    expect(validateCatalog(withProduct("avulso", { consumes: [{ itemId: "copo", quantity: 0.5 }] }))).toContainEqual({
      path: "products[avulso].consumes[0]",
      message: "Use um número inteiro para itens em unidades.",
    });
  });

  it("rejects a per-kg consumption of an item counted in units", () => {
    expect(validateCatalog(withProduct("acai", { consumesPerKg: [{ itemId: "copo", quantity: 1 }] }))).toContainEqual({
      path: "products[acai].consumesPerKg[0]",
      message: "Consumo por kg só vale para itens em kg ou L.",
    });
  });

  it("rejects a packaging whose stock item is not counted in units", () => {
    const catalog = validCatalog();
    const errors = validateCatalog({ ...catalog, packagings: [{ ...catalog.packagings[0], stockItemId: "polpa" }] });
    expect(errors).toContainEqual({ path: "packagings[copo]", message: "A embalagem precisa ser um item contado em unidades." });
  });

  it("rejects a weighed product without packaging", () => {
    expect(validateCatalog(withProduct("acai", { packagingIds: [] }))).toContainEqual({
      path: "products[acai]",
      message: "Informe ao menos uma embalagem.",
    });
  });
});

describe("catalog readers", () => {
  it("unitProducts keeps only unit products, in catalog order", () => {
    const catalog = validCatalog();
    const second: UnitProduct = { kind: "unidade", id: "picole", name: "Picolé", price: 6.5, consumes: [] };
    const products = unitProducts({ ...catalog, products: [second, ...catalog.products] });
    expect(products.map((product) => product.id)).toEqual(["picole", "avulso"]);
  });

  it("weighedProduct finds the weighed product and throws when there is none", () => {
    const catalog = validCatalog();
    expect(weighedProduct(catalog).pricePerKg).toBe(40);
    expect(() => weighedProduct({ ...catalog, products: catalog.products.filter((product) => product.kind !== "peso") })).toThrow(
      "O catálogo não tem produto vendido por peso.",
    );
  });
});
