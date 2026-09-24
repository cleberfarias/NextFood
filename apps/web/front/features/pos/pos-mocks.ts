export type PaymentMethod = "Dinheiro" | "Débito" | "Crédito" | "Pix";

export type CartItem = {
  id: string;
  sourceId?: string;
  /** Id of the "açaí por peso" line this complement was added to, when the sale has more than one. */
  groupId?: string;
  name: string;
  quantityLabel: string;
  total: number;
  baseTotal?: number;
  discountPercent?: number;
};

export const MOCK_SCALE = {
  name: "Balança do caixa 01",
  readingKg: 0.45,
  status: "connected" as const,
};

export const AÇAI_PRICE_PER_KG = 39.9;

export const UNIT_PRODUCTS = [
  { id: "copo-300", name: "Copo 300 ml", price: 14.9 },
  { id: "pote-1l", name: "Pote de sorvete 1 L", price: 29.9 },
  { id: "picole", name: "Picolé cremoso", price: 6.5 },
] as const;

export const AÇAI_COMPLEMENTS = [
  { id: "banana", name: "Banana", price: 2 },
  { id: "granola", name: "Granola", price: 2.5 },
  { id: "leite-condensado", name: "Leite condensado", price: 2.5 },
  { id: "pacoca", name: "Paçoca", price: 2.5 },
  { id: "morango", name: "Morango", price: 3.5 },
  { id: "confete", name: "Confete", price: 2 },
] as const;
