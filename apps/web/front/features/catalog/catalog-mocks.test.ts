import { describe, expect, it } from "vitest";
import { validateCatalog } from "@/back/domain/catalog/catalog";
import { CATALOG } from "./catalog-mocks";

describe("CATALOG", () => {
  it("passes every catalog rule", () => {
    expect(validateCatalog(CATALOG)).toEqual([]);
  });

  it("keeps the unit products, prices and complements the till sells today", () => {
    expect(CATALOG.products.filter((product) => product.kind === "unidade").map((product) => [product.name, product.price])).toEqual([
      ["Copo 300 ml", 14.9],
      ["Pote de sorvete 1 L", 29.9],
      ["Picolé cremoso", 6.5],
    ]);
    expect(CATALOG.complements.map((complement) => [complement.name, complement.extraPrice])).toEqual([
      ["Banana", 2],
      ["Granola", 2.5],
      ["Leite condensado", 2.5],
      ["Paçoca", 2.5],
      ["Morango", 3.5],
      ["Confete", 2],
    ]);
  });
});
