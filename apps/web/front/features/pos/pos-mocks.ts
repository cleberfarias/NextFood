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
