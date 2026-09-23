const CENTS = 100;

function roundCurrency(value: number): number {
  return Math.round((value + 1e-9) * CENTS) / CENTS;
}

export function calculateLineTotal(weightKg: number, pricePerKg: number): number {
  return roundCurrency(weightKg * pricePerKg);
}

export function calculateRemainingAmount(total: number, payments: readonly number[]): number {
  return roundCurrency(Math.max(0, total - payments.reduce((sum, payment) => sum + payment, 0)));
}

export function isPaymentComplete(total: number, payments: readonly number[]): boolean {
  return calculateRemainingAmount(total, payments) === 0;
}
