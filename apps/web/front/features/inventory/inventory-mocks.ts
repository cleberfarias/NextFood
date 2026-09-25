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
