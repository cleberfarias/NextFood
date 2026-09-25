import type { Catalog } from "@/back/domain/catalog/catalog";

// Tare, pulp factors and portions are simulated estimates; the owner tunes them in Cardápio.
// Morango starts empty and three items start at or under their minimum, so
// the low-stock banner is visible on first load.
export const CATALOG: Catalog = {
  stockItems: [
    { id: "polpa-acai", name: "Polpa de açaí", category: "insumo", unit: "kg", balance: 1.2, minimum: 5 },
    { id: "granola", name: "Granola", category: "insumo", unit: "kg", balance: 3.5, minimum: 2 },
    { id: "leite-condensado", name: "Leite condensado", category: "insumo", unit: "un", balance: 4, minimum: 6 },
    { id: "pacoca", name: "Paçoca", category: "insumo", unit: "un", balance: 30, minimum: 10 },
    { id: "banana", name: "Banana", category: "insumo", unit: "kg", balance: 2, minimum: 1.5 },
    { id: "morango", name: "Morango", category: "insumo", unit: "kg", balance: 0, minimum: 1 },
    { id: "confete", name: "Confete", category: "insumo", unit: "kg", balance: 0.8, minimum: 0.5 },
    { id: "copo-300", name: "Copo 300 ml", category: "insumo", unit: "un", balance: 180, minimum: 50 },
    { id: "copo-500", name: "Copo 500 ml", category: "insumo", unit: "un", balance: 40, minimum: 50 },
    { id: "casquinha", name: "Casquinha", category: "insumo", unit: "un", balance: 60, minimum: 20 },
    { id: "colher", name: "Colheres", category: "insumo", unit: "un", balance: 500, minimum: 100 },
    { id: "pote-1l", name: "Pote 1 L", category: "insumo", unit: "un", balance: 12, minimum: 10 },
    { id: "picole", name: "Picolé cremoso", category: "produto", unit: "un", balance: 25, minimum: 20 },
  ],
  packagings: [
    { id: "copo-300", name: "Copo 300 ml", active: true, stockItemId: "copo-300", tareKg: 0.012 },
    { id: "copo-500", name: "Copo 500 ml", active: true, stockItemId: "copo-500", tareKg: 0.018 },
    { id: "casquinha", name: "Casquinha", active: true, stockItemId: "casquinha", tareKg: 0.01 },
  ],
  complements: [
    { id: "banana", name: "Banana", active: true, extraPrice: 2, stockItemId: "banana" },
    { id: "granola", name: "Granola", active: true, extraPrice: 2.5, stockItemId: "granola" },
    { id: "leite-condensado", name: "Leite condensado", active: true, extraPrice: 2.5, stockItemId: "leite-condensado" },
    { id: "pacoca", name: "Paçoca", active: true, extraPrice: 2.5, stockItemId: "pacoca" },
    { id: "morango", name: "Morango", active: true, extraPrice: 3.5, stockItemId: "morango" },
    { id: "confete", name: "Confete", active: true, extraPrice: 2, stockItemId: "confete" },
  ],
  products: [
    {
      kind: "peso",
      id: "acai-peso",
      name: "Açaí por peso",
      active: true,
      pricePerKg: 39.9,
      packagingIds: ["copo-300", "copo-500", "casquinha"],
      consumesPerKg: [{ itemId: "polpa-acai", quantity: 0.8 }],
    },
    {
      kind: "pronto",
      id: "copo-pronto-500",
      name: "Copo pronto 500 ml",
      active: true,
      price: 15,
      packagingId: "copo-500",
      includedComplements: 3,
      consumes: [
        { itemId: "polpa-acai", quantity: 0.35 },
        { itemId: "colher", quantity: 1 },
      ],
    },
    {
      kind: "unidade",
      id: "copo-300",
      name: "Copo 300 ml",
      active: true,
      price: 14.9,
      consumes: [
        { itemId: "copo-300", quantity: 1 },
        { itemId: "colher", quantity: 1 },
      ],
    },
    { kind: "unidade", id: "pote-1l", name: "Pote de sorvete 1 L", active: true, price: 29.9, consumes: [{ itemId: "pote-1l", quantity: 1 }] },
    { kind: "unidade", id: "picole", name: "Picolé cremoso", active: true, price: 6.5, consumes: [{ itemId: "picole", quantity: 1 }] },
  ],
};
