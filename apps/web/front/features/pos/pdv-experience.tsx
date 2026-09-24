"use client";

import { CircleCheck, Printer, Scale, ShoppingBasket } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/front/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/front/ui/card";
import { calculateLineTotal, calculateRemainingAmount, isPaymentComplete } from "./pos-calculations";
import { AÇAI_COMPLEMENTS, AÇAI_PRICE_PER_KG, MOCK_SCALE, type CartItem, type PaymentMethod, UNIT_PRODUCTS } from "./pos-mocks";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const paymentMethods: readonly PaymentMethod[] = ["Dinheiro", "Débito", "Crédito", "Pix"];

export function PdvExperience() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [manualWeight, setManualWeight] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Dinheiro");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [payments, setPayments] = useState<Array<{ method: PaymentMethod; amount: number }>>([]);
  const [complementQuantities, setComplementQuantities] = useState<Record<string, number>>({});
  const [receiptReady, setReceiptReady] = useState(false);
  const [shortcutFeedback, setShortcutFeedback] = useState<string | null>(null);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalMethod, setTerminalMethod] = useState<"Débito" | "Crédito à vista" | "Crédito parcelado">("Débito");
  const [terminalStatus, setTerminalStatus] = useState<"idle" | "waiting" | "approved" | "declined">("idle");
  const [fiscalOpen, setFiscalOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelPassword, setCancelPassword] = useState("");
  const [discountPercent, setDiscountPercent] = useState(0);

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.total, 0), [cart]);
  const total = subtotal * (1 - discountPercent / 100);
  const paymentValues = payments.map((payment) => payment.amount);
  const paidTotal = paymentValues.reduce((sum, value) => sum + value, 0);
  const remaining = calculateRemainingAmount(total, paymentValues);
  const change = paymentMethod === "Dinheiro" && paidTotal > total ? paidTotal - total : 0;
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
    setDiscountPercent(0);
    setPayments([]);
    setReceiptReady(false);
  }

  function applyManualWeight() {
    const value = Number(manualWeight.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0 || value > 100) return;
    setWeightKg(value);
    setManualMode(true);
  }

  function addUnitProduct(product: (typeof UNIT_PRODUCTS)[number]) {
    setCart((items) => [
      ...items,
      { id: `${product.id}-${items.length + 1}`, name: product.name, quantityLabel: "1 unidade", total: product.price },
    ]);
    setPayments([]);
    setReceiptReady(false);
  }

  function updateComplement(complement: (typeof AÇAI_COMPLEMENTS)[number], delta: number) {
    const current = complementQuantities[complement.id] ?? 0;
    const next = Math.max(0, current + delta);
    setComplementQuantities((quantities) => ({ ...quantities, [complement.id]: next }));
    if (delta > 0) {
      setCart((items) => [...items, { id: `${complement.id}-${Date.now()}`, name: complement.name, quantityLabel: "1 adicional", total: complement.price }]);
      setPayments([]);
      setReceiptReady(false);
    }
  }

  function addPayment() {
    const amount = Number(paymentAmount.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) return;
    setPayments((entries) => [...entries, { method: paymentMethod, amount }]);
    setPaymentAmount("");
    setReceiptReady(false);
  }

  function cancelLastItem() {
    setCancelOpen(true);
  }

  function authorizeCancel() {
    if (cancelPassword !== "1234") return;
    setCart((items) => items.slice(0, -1));
    setPayments([]);
    setReceiptReady(false);
    setShortcutFeedback("Item cancelado da venda atual.");
    setCancelPassword("");
    setCancelOpen(false);
  }

  function clearSale() {
    setCart([]);
    setPayments([]);
    setWeightKg(null);
    setReceiptReady(false);
    setShortcutFeedback("Venda atual limpa.");
  }

  function openPaymentTerminal() {
    setTerminalStatus("idle");
    setTerminalOpen(true);
  }

  function reprintLastReceipt() {
    setShortcutFeedback(receiptReady ? "Reimpressão enviada para a impressora térmica." : "Nenhum recibo concluído para reimprimir.");
  }

  function openCashDrawer() {
    setShortcutFeedback("Comando de abertura da gaveta enviado (mock).");
  }

  function closeCashRegister() {
    setShortcutFeedback("Fechamento de caixa iniciado (mock).");
  }

  useEffect(() => {
    function handleKeyboardShortcut(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement) return;
      const actions: Record<string, () => void> = {
        F2: openPaymentTerminal,
        F4: cancelLastItem,
        F6: clearSale,
        F8: reprintLastReceipt,
        F9: openCashDrawer,
        F10: closeCashRegister,
      };
      const action = actions[event.key];
      if (!action) return;
      event.preventDefault();
      action();
    }

    window.addEventListener("keydown", handleKeyboardShortcut);
    return () => window.removeEventListener("keydown", handleKeyboardShortcut);
  });

  return (
    <main className="pos-theme min-h-screen bg-brand-surface px-4 py-4 text-brand-plum-900 sm:px-8 lg:h-dvh lg:min-h-0 lg:overflow-hidden">
      {terminalOpen ? <div className="fixed inset-0 z-50 grid place-items-center bg-[#32102d]/40 p-4" role="presentation" onClick={() => setTerminalOpen(false)}>
        <section role="dialog" aria-modal="true" aria-labelledby="terminal-title" className="w-full max-w-md rounded-2xl border border-brand-border bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
          <p className="text-xs font-semibold tracking-[0.18em] text-[#8b1c67]">PAGAMENTO</p>
          <h2 id="terminal-title" className="mt-1 font-serif text-2xl text-[#32102d]">Abrir pagamento na maquininha</h2>
          <p className="mt-3 text-sm text-[#71465f]">Confira o valor e inicie a cobrança no cartão.</p>
          <div className="mt-5 rounded-xl bg-[#f3e9e4] p-4"><span className="text-sm text-[#71465f]">Valor da venda</span><strong className="mt-1 block font-serif text-3xl text-[#32102d]">{money.format(total)}</strong></div>
          <fieldset className="mt-5"><legend className="text-sm font-semibold text-[#32102d]">Forma no cartão</legend><div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">{(["Débito", "Crédito à vista", "Crédito parcelado"] as const).map((method) => <Button key={method} type="button" variant={terminalMethod === method ? "default" : "outline"} className={terminalMethod === method ? "bg-[#71145b] text-white hover:bg-[#5d104b]" : "border-[#eaded8] text-[#71145b] hover:bg-[#71145b] hover:!text-white"} onClick={() => setTerminalMethod(method)}>{method}</Button>)}</div></fieldset>
          {terminalStatus === "waiting" ? <p role="status" className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">Aguardando confirmação na maquininha...</p> : null}
          {terminalStatus === "approved" ? <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">Pagamento aprovado no cartão.</p> : null}
          {terminalStatus === "declined" ? <p role="status" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">Pagamento recusado. Tente novamente.</p> : null}
          <div className="mt-5 flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={() => setTerminalOpen(false)}>Cancelar</Button>{terminalStatus === "waiting" ? <><Button variant="outline" onClick={() => setTerminalStatus("declined")}>Simular recusa</Button><Button className="bg-[#71145b] text-white hover:bg-[#5d104b]" onClick={() => setTerminalStatus("approved")}>Simular aprovação</Button></> : <Button className="bg-[#71145b] text-white hover:bg-[#5d104b]" onClick={() => { setTerminalStatus("waiting"); setShortcutFeedback(`Cobrança iniciada: ${terminalMethod}.`); }}>Iniciar cobrança</Button>}</div>
        </section>
      </div> : null}
      <div className="mx-auto flex max-w-7xl flex-col lg:h-full">
        <header className="mb-4 flex shrink-0 flex-col gap-4 border-b border-brand-border pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-brand-primary font-serif text-2xl font-bold text-white">A</div>
            <div>
              <h1 className="font-serif text-2xl font-bold tracking-tight text-[#2d102b]">Ponto do Açaí</h1>
              <p className="text-sm text-brand-text-muted">quarta-feira, 23 de setembro</p>
            </div>
          </div>
          <nav aria-label="Áreas do sistema" className="order-3 flex w-full gap-1 rounded-xl bg-brand-surface-muted p-1 text-sm font-semibold text-brand-text-soft sm:order-2 sm:w-auto">
            <Button className="bg-white text-brand-primary shadow-sm hover:bg-brand-primary hover:!text-white" variant="ghost">Caixa</Button>
            <Button className="text-brand-text-soft hover:bg-brand-primary hover:!text-white" variant="ghost">Estoque</Button>
            <Button className="text-brand-text-soft hover:bg-brand-primary hover:!text-white" variant="ghost">Financeiro</Button>
            <Button className="text-brand-text-soft hover:bg-brand-primary hover:!text-white" variant="ghost">Configurações</Button>
          </nav>
          <div className="order-2 flex items-center gap-2 self-end rounded-full border border-brand-border bg-white px-4 py-2 text-sm text-brand-text-soft shadow-sm sm:order-3 sm:self-auto">
            Saldo de hoje <strong className="font-mono text-emerald-600">R$ 0,00</strong>
          </div>
        </header>

        <div className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_25rem]">
          <section className="grid min-h-0 content-start gap-5">
            <Card className="min-h-0 border border-brand-border bg-brand-surface-card shadow-[0_8px_24px_rgba(73,28,59,0.08)]">
              <CardHeader>
                <p className="text-xs font-semibold tracking-[0.18em] text-[#8b1c67]">PESAGEM</p>
                <CardTitle className="flex items-center gap-2 font-serif text-xl text-[#32102d]"><Scale className="size-5 text-[#8b1c67]" /> Açaí por peso</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
                <div className="rounded-xl border border-[#eaded8] bg-[#f3e9e4] p-5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-[#71465f]">{MOCK_SCALE.name}</span>
                    <span className="inline-flex items-center gap-1.5 text-emerald-600"><CircleCheck className="size-4" /> {manualMode ? "Modo manual" : "Conectada"}</span>
                  </div>
                  {manualMode ? <label className="mt-5 block text-xs font-medium text-[#71465f]" htmlFor="manual-weight">Peso manual (kg)<input id="manual-weight" inputMode="decimal" value={manualWeight} onChange={(event) => { setManualWeight(event.target.value); const value = Number(event.target.value.replace(",", ".")); if (Number.isFinite(value) && value > 0 && value <= 100) setWeightKg(value); }} placeholder="0,000" className="mt-1 block w-full border-0 bg-transparent p-0 text-4xl font-semibold tabular-nums text-[#32102d] outline-none focus:ring-0" /></label> : <p className="mt-5 text-4xl font-semibold tabular-nums text-[#32102d]">{weightKg === null ? "—" : `${weightKg.toFixed(3).replace(".", ",")} kg`}</p>}
                  <p className="mt-2 text-sm text-[#8e6e80]">Preço atual: {money.format(AÇAI_PRICE_PER_KG)} por kg</p>
                </div>
                <div className="flex w-full flex-col gap-2 md:min-w-56 [&>button]:w-full">
                  {!manualMode ? <Button className="w-full border-[#eaded8] bg-white text-[#71145b] hover:bg-[#71145b] hover:!text-white" variant="outline" onClick={() => { setManualMode(true); setManualWeight(weightKg?.toFixed(3).replace(".", ",") ?? ""); }}>Usar peso manual</Button> : null}
                  {manualMode ? <Button className="border-[#eaded8] bg-white text-[#71145b] hover:bg-[#71145b] hover:!text-white" variant="outline" onClick={() => { setManualMode(false); setManualWeight(""); }}>Voltar para ler balança</Button> : null}
                  <Button className="border-[#eaded8] bg-white text-[#71145b] hover:bg-[#71145b] hover:!text-white" variant="outline" onClick={() => setWeightKg(MOCK_SCALE.readingKg)}>Ler balança</Button>
                  <Button className="w-full bg-[#71145b] text-white hover:bg-[#5d104b]" onClick={addWeighedItem} disabled={weightKg === null}>Adicionar açaí ao carrinho</Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-brand-border bg-brand-surface-card shadow-[0_8px_24px_rgba(73,28,59,0.08)]">
              <CardHeader>
                <p className="text-xs font-semibold tracking-[0.18em] text-[#8b1c67]">ITENS E ADICIONAIS</p>
                <CardTitle className="font-serif text-xl text-[#32102d]">Produtos rápidos</CardTitle>
              </CardHeader>
              <CardContent className="max-h-[19rem] space-y-4 overflow-y-auto">
                <div className="grid gap-3 sm:grid-cols-3">
                  {UNIT_PRODUCTS.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addUnitProduct(product)}
                    className="group rounded-xl border border-[#eaded8] bg-[#f3e9e4] p-4 text-left text-[#32102d] transition hover:border-[#71145b] hover:bg-[#71145b] hover:!text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b1c67]"
                  >
                    <span className="block font-medium text-[#32102d] group-hover:text-white">{product.name}</span>
                    <span className="mt-2 block text-sm text-[#8b1c67] group-hover:text-white">{money.format(product.price)}</span>
                  </button>
                  ))}
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-[#8b1c67]">COMPLEMENTOS PARA AÇAÍ</p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {AÇAI_COMPLEMENTS.map((complement) => {
                      const quantity = complementQuantities[complement.id] ?? 0;
                      return (
                        <div key={complement.id} className="rounded-xl border border-[#eaded8] bg-[#f3e9e4] p-3 text-[#32102d]">
                          <p className="font-medium">{complement.name}</p>
                          <p className="mt-1 text-sm text-[#8b1c67]">{money.format(complement.price)}</p>
                          <div className="mt-2 flex items-center justify-between">
                            <Button aria-label={`Diminuir ${complement.name}`} className="size-7 border-[#eaded8] bg-white p-0 text-[#71145b] hover:bg-[#71145b] hover:!text-white" variant="outline" onClick={() => updateComplement(complement, -1)} disabled={quantity === 0}>−</Button>
                            <span className="font-semibold">{quantity}</span>
                            <Button aria-label={`Adicionar ${complement.name}`} className="size-7 border-[#eaded8] bg-white p-0 text-[#71145b] hover:bg-[#71145b] hover:!text-white" variant="outline" onClick={() => updateComplement(complement, 1)}>+</Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <aside>
            <Card className="border border-brand-border bg-brand-surface-card shadow-[0_8px_24px_rgba(73,28,59,0.08)] lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto">
              <CardHeader>
                <p className="text-xs font-semibold tracking-[0.18em] text-[#8b1c67]">VENDA ATUAL</p>
                <CardTitle className="flex items-center gap-2 font-serif text-xl text-[#32102d]"><ShoppingBasket className="size-5" /> Carrinho</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="h-60 shrink-0 space-y-3 overflow-y-auto pr-1 [scrollbar-color:rgb(113_20_91_/_0.45)_transparent]">
                  {cart.length === 0 ? <p className="py-6 text-center text-sm text-[#b08c9f]">Nenhum item ainda — pese o açaí ou adicione um produto.</p> : cart.map((item) => (
                    <div key={item.id} className="flex justify-between gap-4 border-b border-[#eaded8] pb-3">
                      <div><p className="font-medium text-[#32102d]">{item.name}</p><p className="mt-1 text-xs text-[#9a7890]">{item.quantityLabel}</p></div>
                      <span className="font-medium tabular-nums">{money.format(item.total)}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-[#eaded8] pt-4">
                  <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-[#8e6e80]">PAGAMENTO</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {paymentMethods.map((method) => <Button key={method} className={paymentMethod === method ? "bg-[#f3e9e4] text-[#71145b] hover:bg-[#71145b] hover:!text-white" : "border-[#eaded8] bg-[#f3e9e4] text-[#71465f] hover:bg-[#71145b] hover:!text-white"} variant={paymentMethod === method ? "default" : "outline"} onClick={() => setPaymentMethod(method)}>{method}</Button>)}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <label className="sr-only" htmlFor="payment-amount">Valor do pagamento</label>
                    <input
                      id="payment-amount"
                      inputMode="decimal"
                      value={paymentAmount}
                      onChange={(event) => setPaymentAmount(event.target.value)}
                      placeholder="Valor"
                      className="h-9 min-w-0 flex-1 rounded-lg border border-[#eaded8] bg-[#f8f5f2] px-3 text-sm text-[#32102d] outline-none ring-[#b36b9e] focus:ring-2"
                    />
                    <Button className="border-[#eaded8] bg-white text-[#71145b] hover:bg-[#71145b] hover:!text-white" variant="outline" onClick={addPayment} disabled={!paymentAmount}>Adicionar</Button>
                  </div>
                  {paymentMethod === "Pix" && total > 0 ? <div className="mt-3 rounded-xl border border-[#eaded8] bg-[#f3e9e4] p-4"><p className="text-sm font-semibold text-[#32102d]">Pix — QR Code da cobrança</p><div className="mx-auto mt-3 grid size-32 grid-cols-8 gap-1 rounded-lg bg-white p-2">{Array.from({ length: 64 }, (_, index) => <span key={index} className={((index * 17 + 3) % 5 < 2 || index % 9 === 0) ? "bg-[#32102d]" : "bg-white"} />)}</div><p className="mt-2 text-center text-xs text-[#71465f]">Valor: {money.format(Math.max(remaining, total))}</p><Button className="mt-3 w-full bg-[#71145b] text-white hover:bg-[#5d104b]" onClick={() => { setPaymentAmount(Math.max(remaining, total).toFixed(2).replace(".", ",")); }}>Confirmar Pix recebido</Button></div> : null}
                  {payments.length > 0 ? <div className="mt-3 space-y-1 text-xs text-[#71465f]">{payments.map((payment, index) => <p key={`${payment.method}-${index}`} className="flex justify-between"><span>{payment.method}</span><span>{money.format(payment.amount)}</span></p>)}</div> : <p className="mt-3 text-xs text-[#9a7890]">Adicione um ou mais pagamentos para concluir a venda.</p>}
                </div>

                <div className="flex items-end justify-between border-t border-[#eaded8] pt-4">
                  <span className="text-[#71465f]">Total</span>
                  <strong className="font-serif text-3xl tabular-nums text-[#32102d]">{money.format(total)}</strong>
                </div>
                {cart.length > 0 ? <label className="flex items-center justify-between gap-3 text-sm text-[#71465f]" htmlFor="discount-percent">Desconto (%)<input id="discount-percent" type="number" min="0" max="100" value={discountPercent} onChange={(event) => setDiscountPercent(Math.min(100, Math.max(0, Number(event.target.value) || 0)))} className="h-9 w-24 rounded-lg border border-[#eaded8] bg-[#f8f5f2] px-3 text-right text-[#32102d]" /></label> : null}
                {remaining > 0 ? <p className="text-sm text-amber-700">Falta pagar {money.format(remaining)}.</p> : null}
                {change > 0 ? <p className="rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">Troco: {money.format(change)}</p> : null}
                {cart.length > 0 && !canFinish ? <p className="text-xs text-[#9a7890]">Adicione o pagamento total para habilitar a finalização da venda.</p> : null}
                <Button className="h-11 bg-[#f2c992] text-base text-[#9b8b9c] hover:bg-[#edbd7e] enabled:bg-[#71145b] enabled:text-white" disabled={!canFinish} onClick={() => setFiscalOpen(true)}>Finalizar venda</Button>
                {receiptReady ? <div role="status" className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700"><Printer className="size-4" /> Recibo pronto para impressão térmica</div> : null}
                {shortcutFeedback ? <p role="status" className="text-sm text-[#8b1c67]">{shortcutFeedback}</p> : null}
              </CardContent>
            </Card>
          </aside>
        </div>

        <section aria-label="Atalhos do caixa" className="mt-4 shrink-0 rounded-xl border border-brand-border bg-brand-surface-card p-3 shadow-[0_8px_24px_rgba(73,28,59,0.06)]">
          <div className="mb-3 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] text-[#8b1c67]">ATALHOS DO CAIXA</p>
              <p className="mt-1 text-xs text-[#9a7890]">Também funcionam pelas teclas de função quando o foco não está em um campo.</p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
            <Button className="h-auto min-h-9 whitespace-normal px-3 py-2 text-xs leading-tight hover:bg-[#71145b] hover:!text-white" variant="outline" onClick={openPaymentTerminal}>F2 · Abrir pagamento na maquininha</Button>
            <Button className="h-auto min-h-9 whitespace-normal px-3 py-2 text-xs leading-tight hover:bg-[#71145b] hover:!text-white" variant="outline" onClick={cancelLastItem} disabled={cart.length === 0}>F4 · Cancelar último item</Button>
            <Button className="h-auto min-h-9 whitespace-normal px-3 py-2 text-xs leading-tight hover:bg-[#71145b] hover:!text-white" variant="outline" onClick={clearSale} disabled={cart.length === 0}>F6 · Limpar venda</Button>
            <Button className="h-auto min-h-9 whitespace-normal px-3 py-2 text-xs leading-tight hover:bg-[#71145b] hover:!text-white" variant="outline" onClick={reprintLastReceipt}>F8 · Reimprimir recibo</Button>
            <Button className="h-auto min-h-9 whitespace-normal px-3 py-2 text-xs leading-tight hover:bg-[#71145b] hover:!text-white" variant="outline" onClick={openCashDrawer}>F9 · Abrir gaveta</Button>
            <Button className="h-auto min-h-9 whitespace-normal px-3 py-2 text-xs leading-tight hover:bg-[#71145b] hover:!text-white" variant="outline" onClick={closeCashRegister}>F10 · Fechar caixa</Button>
          </div>
        </section>
      </div>
      {fiscalOpen ? <div className="fixed inset-0 z-50 grid place-items-center bg-[#32102d]/40 p-4" role="presentation" onClick={() => setFiscalOpen(false)}><section role="dialog" aria-modal="true" aria-labelledby="fiscal-title" className="w-full max-w-md rounded-2xl border border-brand-border bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}><p className="text-xs font-semibold tracking-[0.18em] text-[#8b1c67]">EMISSÃO DA VENDA</p><h2 id="fiscal-title" className="mt-1 font-serif text-2xl text-[#32102d]">Como deseja emitir?</h2><p className="mt-2 text-sm text-[#71465f]">Escolha o documento para imprimir na impressora térmica.</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><Button className="h-auto min-h-16 border-[#eaded8] bg-white text-[#71145b] hover:bg-[#71145b] hover:!text-white" variant="outline" onClick={() => { setFiscalOpen(false); setReceiptReady(true); setShortcutFeedback("Recibo de venda enviado para impressão térmica."); }}>Recibo de venda</Button><Button className="h-auto min-h-16 bg-[#71145b] text-white hover:bg-[#5d104b]" onClick={() => { setFiscalOpen(false); setReceiptReady(true); setShortcutFeedback("Cupom fiscal enviado para impressão térmica."); }}>Cupom fiscal</Button></div></section></div> : null}
      {cancelOpen ? <div className="fixed inset-0 z-50 grid place-items-center bg-[#32102d]/40 p-4" role="presentation" onClick={() => setCancelOpen(false)}><section role="dialog" aria-modal="true" aria-labelledby="cancel-title" className="w-full max-w-sm rounded-2xl border border-brand-border bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}><h2 id="cancel-title" className="font-serif text-2xl text-[#32102d]">Autorizar cancelamento</h2><p className="mt-2 text-sm text-[#71465f]">Informe a senha do responsável para cancelar o último item.</p><input autoFocus type="password" aria-label="Senha de cancelamento" value={cancelPassword} onChange={(event) => setCancelPassword(event.target.value)} className="mt-4 h-10 w-full rounded-lg border border-[#eaded8] px-3 text-[#32102d]" /><div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setCancelOpen(false)}>Voltar</Button><Button className="bg-[#71145b] text-white hover:bg-[#5d104b]" onClick={authorizeCancel}>Autorizar</Button></div></section></div> : null}
    </main>
  );
}
