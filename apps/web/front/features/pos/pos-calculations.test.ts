import { describe, expect, it } from "vitest";
import { calculateDiscountedTotal, calculateLineTotal, calculatePaymentTotals, calculateRemainingAmount, isPaymentComplete } from "./pos-calculations";

describe("PDV calculations", () => {
  it("calculates a weighed item from kilograms and the price per kilogram", () => {
    expect(calculateLineTotal(0.45, 39.9)).toBe(17.96);
  });

  it("calculates the amount still due across split payments", () => {
    expect(calculateRemainingAmount(25, [10, 8.5])).toBe(6.5);
  });

  it("only accepts completion when split payments cover the sale total", () => {
    expect(isPaymentComplete(25, [10, 15])).toBe(true);
    expect(isPaymentComplete(25, [10, 14.99])).toBe(false);
  });

  it("limits discounts and rounds the resulting total", () => {
    expect(calculateDiscountedTotal(19.9, 10)).toBe(17.91);
    expect(calculateDiscountedTotal(19.9, 200)).toBe(0);
  });

  it("groups completed payments for cash-register closing", () => {
    expect(calculatePaymentTotals([
      { method: "Dinheiro", amount: 10 },
      { method: "Pix", amount: 5.5 },
      { method: "Dinheiro", amount: 2.25 },
    ])).toEqual({ Dinheiro: 12.25, Pix: 5.5 });
  });
});
