export type PaymentMethod = "Dinheiro" | "Débito" | "Crédito";

export type CartItem = {
  id: string;
  name: string;
  quantityLabel: string;
  total: number;
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
