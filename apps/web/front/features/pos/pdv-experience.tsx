"use client";

import { CircleCheck, Printer, Scale, ShoppingBasket, Wifi } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/front/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/front/ui/card";
import { calculateLineTotal, calculateRemainingAmount, isPaymentComplete } from "./pos-calculations";
import { AÇAI_PRICE_PER_KG, MOCK_SCALE, type CartItem, type PaymentMethod, UNIT_PRODUCTS } from "./pos-mocks";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const paymentMethods: readonly PaymentMethod[] = ["Dinheiro", "Débito", "Crédito"];

export function PdvExperience() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Dinheiro");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [payments, setPayments] = useState<Array<{ method: PaymentMethod; amount: number }>>([]);
  const [receiptReady, setReceiptReady] = useState(false);

  const total = useMemo(() => cart.reduce((sum, item) => sum + item.total, 0), [cart]);
  const paymentValues = payments.map((payment) => payment.amount);
  const remaining = calculateRemainingAmount(total, paymentValues);
  const canFinish = cart.length > 0 && isPaymentComplete(total, paymentValues);

  function addWeighedItem() {
    if (weightKg === null) return;

    const lineTotal = calculateLineTotal(weightKg, AÇAI_PRICE_PER_KG);
    setCart((items) => [
      ...items,
      {
        id: `acai-${items.length + 1}`,
        name: "Açaí por peso",
        quantityLabel: `${weightKg.toFixed(3).replace(".", ",")} kg × ${money.format(AÇAI_PRICE_PER_KG)}/kg`,
        total: lineTotal,
      },
    ]);
    setWeightKg(null);
    setPayments([]);
    setReceiptReady(false);
  }

  function addUnitProduct(product: (typeof UNIT_PRODUCTS)[number]) {
    setCart((items) => [
      ...items,
      { id: `${product.id}-${items.length + 1}`, name: product.name, quantityLabel: "1 unidade", total: product.price },
    ]);
    setPayments([]);
    setReceiptReady(false);
  }

  function addPayment() {
    const amount = Number(paymentAmount.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) return;
    setPayments((entries) => [...entries, { method: paymentMethod, amount }]);
    setPaymentAmount("");
    setReceiptReady(false);
  }

  return (
    <main className="min-h-screen bg-[#111611] px-4 py-6 text-stone-100 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.24em] text-lime-300">PONTO DO AÇAÍ</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Caixa</h1>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="inline-flex items-center gap-2 rounded-full bg-lime-300/10 px-3 py-1.5 text-lime-200"><Wifi className="size-4" /> Online</span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-stone-300">Caixa 01 · Aberto</span>
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_25rem]">
          <section className="grid gap-5">
            <Card className="border border-lime-200/10 bg-[#1a2119]">
              <CardHeader>
                <p className="text-xs font-semibold tracking-[0.18em] text-lime-300">PESAGEM</p>
                <CardTitle className="flex items-center gap-2 text-xl"><Scale className="size-5 text-lime-300" /> Açaí por peso</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
                <div className="rounded-xl border border-lime-300/20 bg-lime-300/5 p-5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-stone-300">{MOCK_SCALE.name}</span>
                    <span className="inline-flex items-center gap-1.5 text-lime-200"><CircleCheck className="size-4" /> Conectada</span>
                  </div>
                  <p className="mt-5 text-4xl font-semibold tabular-nums">{weightKg === null ? "—" : `${weightKg.toFixed(3).replace(".", ",")} kg`}</p>
                  <p className="mt-2 text-sm text-stone-400">Preço atual: {money.format(AÇAI_PRICE_PER_KG)} por kg</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setWeightKg(MOCK_SCALE.readingKg)}>Ler balança</Button>
                  <Button onClick={addWeighedItem} disabled={weightKg === null}>Adicionar açaí ao carrinho</Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-white/10 bg-[#1a2119]">
              <CardHeader>
                <p className="text-xs font-semibold tracking-[0.18em] text-lime-300">ITENS POR UNIDADE</p>
                <CardTitle className="text-xl">Produtos rápidos</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3">
                {UNIT_PRODUCTS.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addUnitProduct(product)}
                    className="rounded-xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-lime-300/50 hover:bg-lime-300/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-300"
                  >
                    <span className="block font-medium">{product.name}</span>
                    <span className="mt-2 block text-sm text-lime-200">{money.format(product.price)}</span>
                  </button>
                ))}
              </CardContent>
            </Card>
          </section>

          <aside>
            <Card className="sticky top-6 border border-white/10 bg-[#20291f]">
              <CardHeader>
                <p className="text-xs font-semibold tracking-[0.18em] text-lime-300">VENDA ATUAL</p>
                <CardTitle className="flex items-center gap-2 text-xl"><ShoppingBasket className="size-5" /> Carrinho</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="min-h-32 space-y-3">
                  {cart.length === 0 ? <p className="py-6 text-center text-sm text-stone-400">Nenhum item ainda — pese o açaí ou adicione um produto.</p> : cart.map((item) => (
                    <div key={item.id} className="flex justify-between gap-4 border-b border-white/10 pb-3">
                      <div><p className="font-medium">{item.name}</p><p className="mt-1 text-xs text-stone-400">{item.quantityLabel}</p></div>
                      <span className="font-medium tabular-nums">{money.format(item.total)}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-white/10 pt-4">
                  <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-stone-400">PAGAMENTO</p>
                  <div className="grid grid-cols-3 gap-2">
                    {paymentMethods.map((method) => <Button key={method} variant={paymentMethod === method ? "default" : "outline"} onClick={() => setPaymentMethod(method)}>{method}</Button>)}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <label className="sr-only" htmlFor="payment-amount">Valor do pagamento</label>
                    <input
                      id="payment-amount"
                      inputMode="decimal"
                      value={paymentAmount}
                      onChange={(event) => setPaymentAmount(event.target.value)}
                      placeholder="Valor"
                      className="h-9 min-w-0 flex-1 rounded-lg border border-white/15 bg-black/10 px-3 text-sm outline-none ring-lime-300 focus:ring-2"
                    />
                    <Button variant="outline" onClick={addPayment} disabled={!paymentAmount}>Adicionar</Button>
                  </div>
                  {payments.length > 0 ? <div className="mt-3 space-y-1 text-xs text-stone-300">{payments.map((payment, index) => <p key={`${payment.method}-${index}`} className="flex justify-between"><span>{payment.method}</span><span>{money.format(payment.amount)}</span></p>)}</div> : <p className="mt-3 text-xs text-stone-400">Adicione um ou mais pagamentos para concluir a venda.</p>}
                </div>

                <div className="flex items-end justify-between border-t border-white/10 pt-4">
                  <span className="text-stone-300">Total</span>
                  <strong className="text-2xl tabular-nums text-lime-200">{money.format(total)}</strong>
                </div>
                {remaining > 0 ? <p className="text-sm text-amber-200">Falta pagar {money.format(remaining)}.</p> : null}
                <Button className="h-11 text-base" disabled={!canFinish} onClick={() => setReceiptReady(true)}>Finalizar venda</Button>
                {receiptReady ? <div role="status" className="flex items-center gap-2 rounded-lg bg-lime-300/10 p-3 text-sm text-lime-100"><Printer className="size-4" /> Recibo pronto para impressão térmica</div> : null}
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </main>
  );
}
