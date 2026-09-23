import { describe, expect, it } from "vitest";
import { calculateLineTotal, calculateRemainingAmount, isPaymentComplete } from "./pos-calculations";

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
});
