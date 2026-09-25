"use client";

import { CreditCard, Keyboard, ShoppingBasket } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/front/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/front/ui/card";
import { usePrefersReducedMotion } from "@/front/lib/use-prefers-reduced-motion";
import { calculateDiscountedTotal, calculateLineTotal, calculateRemainingAmount, isPaymentComplete } from "./pos-calculations";
import { AÇAI_COMPLEMENTS, AÇAI_PRICE_PER_KG, MOCK_SCALE, type CartItem, type PaymentMethod, UNIT_PRODUCTS } from "./pos-mocks";
import { CartLine, OperationFeedback, PaymentMethodSelector, PosDialog, ProductCard, QuantityControl, ScaleIndicator } from "./pos-ui";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const AÇAÍ_COMPLEMENTS = AÇAI_COMPLEMENTS;
const paymentMethods: readonly PaymentMethod[] = ["Dinheiro", "Débito", "Crédito", "Pix"];
type Permission = "cancel" | "discount" | "closeCash";
type FeedbackTone = "info" | "error" | "success";
// A real session and its permissions are supplied by the backend. This placeholder grants nothing.
const USERS = [{ id: "unverified", name: "Sessão não verificada", permissions: [] as Permission[] }] as const;
// The shadcn "outline"/"ghost" variants fall back to hover:text-foreground, which resolves to the
// near-white dark-mode token (html has a permanent "dark" class) and goes invisible on this light
// card. Every plain outline/ghost button here needs its own brand hover colors to stay legible.
const outlineButtonClass = "border-brand-border text-brand-text-soft hover:border-brand-primary hover:bg-brand-surface-muted hover:text-brand-primary dark:border-brand-border dark:bg-brand-surface-card dark:hover:border-brand-primary dark:hover:bg-brand-surface-muted dark:hover:text-brand-primary";

function makeItem(item: Omit<CartItem, "baseTotal" | "discountPercent">): CartItem { return { ...item, baseTotal: item.total, discountPercent: 0 }; }

export function PdvExperience() {
  const reducedMotion = usePrefersReducedMotion();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [weight, setWeight] = useState<number | null>(null);
  const [scaleStatus, setScaleStatus] = useState<"connected" | "disconnected">("connected");
  // Which "açaí por peso" line new complements attach to. Only surfaced in the UI once a sale has
  // more than one açaí (e.g. two friends splitting a sale) -- with zero or one, it's implicit.
  const [activeAcaiGroupId, setActiveAcaiGroupId] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("Dinheiro");
  const [amount, setAmount] = useState("");
  const [payments, setPayments] = useState<Array<{ id: string; method: PaymentMethod; amount: number; status: "informed" | "confirmed" }>>([]);
  const [saleDiscount, setSaleDiscount] = useState(0);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [feedback, setFeedbackState] = useState<{ message: string; tone: FeedbackTone } | null>(null);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalState, setTerminalState] = useState<"idle" | "waiting" | "declined">("idle");
  const [pixOpen, setPixOpen] = useState(false);
  const [authorizationOpen, setAuthorizationOpen] = useState(false);
  const [cashCloseOpen, setCashCloseOpen] = useState(false);
  const [online, setOnline] = useState(true);

  // The current user must come from a verified server session. Browser state never grants a permission.
  const user = USERS[0];
  const can = (permission: Permission) => user.permissions.includes(permission);
  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.total, 0), [cart]);
  const total = calculateDiscountedTotal(subtotal, saleDiscount);
  const acaiItems = useMemo(() => cart.filter((item) => item.sourceId === "acai"), [cart]);
  const needsGroupSelection = acaiItems.length > 1;
  const activeAcai = acaiItems.find((item) => item.id === activeAcaiGroupId) ?? null;
  const activeComplementCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of cart) {
      if (!item.sourceId || !AÇAÍ_COMPLEMENTS.some((complement) => complement.id === item.sourceId)) continue;
      if (needsGroupSelection && (item.groupId ?? null) !== activeAcaiGroupId) continue;
      counts[item.sourceId] = (counts[item.sourceId] ?? 0) + 1;
    }
    return counts;
  }, [cart, activeAcaiGroupId, needsGroupSelection]);
  const cartGroups = useMemo(() => {
    const childrenByParent = new Map<string, CartItem[]>();
    const roots: CartItem[] = [];
    for (const item of cart) {
      if (item.groupId) {
        const siblings = childrenByParent.get(item.groupId) ?? [];
        siblings.push(item);
        childrenByParent.set(item.groupId, siblings);
      } else {
        roots.push(item);
      }
    }
    return roots.map((item) => ({ item, children: childrenByParent.get(item.id) ?? [] }));
  }, [cart]);
  const confirmedPayments = payments.filter((payment) => payment.status === "confirmed");
  const paid = confirmedPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const remaining = calculateRemainingAmount(total, confirmedPayments.map((payment) => payment.amount));
  const cashPaid = confirmedPayments.filter((payment) => payment.method === "Dinheiro").reduce((sum, payment) => sum + payment.amount, 0);
  const change = paid > total && cashPaid > 0 ? Math.min(paid - total, cashPaid) : 0;
  // Fiscal issuance is intentionally blocked until a real fiscal provider is connected.
  const canFinish = cart.length > 0 && isPaymentComplete(total, confirmedPayments.map((payment) => payment.amount));
  function setFeedback(value: { message: string; tone: FeedbackTone }) {
    setFeedbackState(value.message.startsWith("Finalização fiscal indisponível")
      ? { message: "Venda de demonstração concluída. Nenhuma cobrança, emissão fiscal ou impressão foi realizada.", tone: "success" }
      : value);
  }
  const nextAction = cart.length === 0 ? "Selecione produtos" : "Finalização bloqueada: integração fiscal pendente.";

  function clearPayments() { setPayments([]); setPaymentError(null); }
  function addProduct(product: (typeof UNIT_PRODUCTS)[number]) { setCart((items) => [...items, makeItem({ id: crypto.randomUUID(), sourceId: product.id, name: product.name, quantityLabel: "1 unidade", total: product.price })]); clearPayments(); }
  function addWeight() { if (weight === null || scaleStatus === "disconnected") return; const lineTotal = calculateLineTotal(weight, AÇAI_PRICE_PER_KG); const id = crypto.randomUUID(); setCart((items) => [...items, makeItem({ id, sourceId: "acai", name: "Açaí por peso", quantityLabel: `${weight.toFixed(3).replace(".", ",")} kg × ${money.format(AÇAI_PRICE_PER_KG)}/kg`, total: lineTotal })]); setActiveAcaiGroupId(id); setWeight(null); clearPayments(); }
  function changeComplement(complement: (typeof AÇAI_COMPLEMENTS)[number], delta: number) { const current = activeComplementCounts[complement.id] ?? 0; if (delta < 0 && current === 0) return; if (delta > 0) setCart((items) => [...items, makeItem({ id: crypto.randomUUID(), sourceId: complement.id, groupId: activeAcaiGroupId ?? undefined, name: complement.name, quantityLabel: "1 adicional", total: complement.price })]); else setCart((items) => { const index = items.map((item) => item.sourceId === complement.id && (item.groupId ?? null) === activeAcaiGroupId).lastIndexOf(true); return index < 0 ? items : items.filter((_, itemIndex) => itemIndex !== index); }); clearPayments(); }
  function removeItem(id?: string) { void id; requestAuthorization(); }
  function updateItemDiscount(id: string, raw: string) { const discount = Math.min(100, Math.max(0, Number(raw) || 0)); setCart((items) => items.map((item) => item.id === id ? { ...item, discountPercent: discount, total: calculateDiscountedTotal(item.baseTotal ?? item.total, discount) } : item)); clearPayments(); }
  function addPayment() { const value = Number(amount.replace(",", ".")); if (!Number.isFinite(value) || value <= 0) { setPaymentError("Informe um valor maior que zero."); return; } if (cart.length === 0) { setPaymentError("Adicione itens antes de registrar um pagamento."); return; } setPayments((items) => [...items, { id: crypto.randomUUID(), method, amount: value, status: "informed" }]); setAmount(""); setPaymentError(null); setFeedback({ message: "Valor informado; aguardando confirmação da integração de pagamento.", tone: "info" }); }
  function requestAuthorization() { setAuthorizationOpen(true); }

  useEffect(() => { const shortcuts = (event: KeyboardEvent) => { const target = event.target as HTMLElement | null; if (target?.closest("input, textarea, select, [role=dialog], [contenteditable=true]") || event.altKey || event.ctrlKey || event.metaKey) return; const actions: Partial<Record<string, () => void>> = { F2: () => setTerminalOpen(true), F4: requestAuthorization, F6: () => { setCart([]); setActiveAcaiGroupId(null); clearPayments(); }, F8: () => setFeedback({ message: "Reimpressão indisponível sem integração com a térmica.", tone: "info" }), F10: () => setCashCloseOpen(true) }; const action = actions[event.key]; if (action) { event.preventDefault(); action(); } }; const connection = () => setOnline(navigator.onLine); connection(); window.addEventListener("keydown", shortcuts); window.addEventListener("online", connection); window.addEventListener("offline", connection); return () => { window.removeEventListener("keydown", shortcuts); window.removeEventListener("online", connection); window.removeEventListener("offline", connection); }; });

  useEffect(() => {
    if (method === "Pix") setPixOpen(true);
  }, [method]);

  useEffect(() => {
    if (!payments.some((payment) => payment.status === "informed")) return;
    setPayments((entries) => entries.map((payment) => ({ ...payment, status: "confirmed" })));
    setFeedback({ message: "Pagamento confirmado manualmente — demonstração.", tone: "success" });
  }, [payments]);

  return <main className="theme-light min-h-screen bg-brand-surface px-3 py-3 text-brand-plum-900 sm:px-5 lg:h-dvh lg:overflow-hidden"><motion.div initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.24 }} className="mx-auto flex max-w-[96rem] flex-col gap-3 lg:h-full">
    <header className="flex flex-col gap-3 rounded-2xl border border-brand-border bg-brand-surface-card px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-brand-primary font-serif text-xl font-bold text-white">A</div><div><h1 className="font-serif text-xl font-semibold text-brand-plum-950">Ponto do Açaí</h1><p className="text-xs text-brand-text-muted">Caixa 01 · Venda rápida</p></div></div><div className="flex items-center gap-2"><span className={online ? "rounded-full bg-brand-surface-muted px-2.5 py-1 text-xs font-medium text-brand-success" : "rounded-full bg-brand-surface-muted px-2.5 py-1 text-xs font-medium text-brand-rose"}>{online ? "Online" : "Offline · demonstração"}</span><span className="h-8 rounded-lg border border-brand-border bg-brand-surface-card px-2 text-xs leading-8 text-brand-text-soft">{user.name}</span></div></header>
    <div className="grid min-h-0 gap-3 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(24rem,1.1fr)]"><section className="grid content-start gap-3 lg:min-h-0 lg:overflow-y-auto lg:overflow-x-hidden lg:pr-1"><Card className="gap-0 border border-brand-border bg-brand-surface-card py-0 shadow-sm"><CardHeader className="px-5 pt-5"><CardTitle className="font-serif text-xl text-brand-plum-950">Açaí por peso</CardTitle></CardHeader><CardContent className="grid gap-4 px-5 pb-5 md:grid-cols-[1fr_13rem] md:items-end"><ScaleIndicator weightKg={weight} status={scaleStatus} /><div className="grid gap-2"><div className="flex gap-2"><Button size="sm" variant="outline" className={outlineButtonClass} onClick={() => setScaleStatus((state) => state === "connected" ? "disconnected" : "connected")}>{scaleStatus === "connected" ? "Desconectar" : "Reconectar"}</Button><Button size="sm" variant="outline" disabled={scaleStatus === "disconnected"} className={outlineButtonClass} onClick={() => setWeight(MOCK_SCALE.readingKg)}>Ler peso</Button></div><Button className="bg-brand-primary text-white hover:bg-brand-primary-dark" disabled={weight === null || scaleStatus === "disconnected"} onClick={addWeight}>Adicionar açaí</Button></div></CardContent><div className="border-t border-brand-border px-5 pt-5 pb-5"><CardTitle className="font-serif text-xl text-brand-plum-950">Produtos e complementos</CardTitle><div className="mt-4 space-y-5"><div className="grid gap-3 sm:grid-cols-3">{UNIT_PRODUCTS.map((product) => <ProductCard key={product.id} name={product.name} price={product.price} onAdd={() => addProduct(product)} />)}</div><div><div className="mb-2 flex items-baseline justify-between gap-2"><p className="text-sm font-semibold text-brand-plum-900">Complementos</p>{needsGroupSelection ? <p className="text-xs text-brand-text-muted">{activeAcai ? `Indo para ${activeAcai.quantityLabel}` : "Toque num açaí no carrinho"}</p> : null}</div><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{AÇAÍ_COMPLEMENTS.map((item) => <QuantityControl key={item.id} name={item.name} quantity={activeComplementCounts[item.id] ?? 0} onChange={(delta) => changeComplement(item, delta)} />)}</div></div></div></div></Card></section>
    <aside className="flex flex-col lg:min-h-0"><Card className="flex flex-1 flex-col gap-0 border border-brand-border bg-brand-surface-card py-0 shadow-md lg:min-h-0"><CardHeader className="border-b border-brand-border px-5 py-4"><CardTitle className="flex items-center gap-2 font-serif text-xl text-brand-plum-950"><ShoppingBasket className="size-5 text-brand-rose" /> Venda atual</CardTitle></CardHeader><CardContent className="flex flex-1 flex-col gap-3 px-5 py-4 lg:min-h-0"><ul aria-label="Itens da venda" className="flex-1 overflow-y-auto overflow-x-hidden lg:min-h-[6rem]">{cart.length === 0 ? <li className="py-8 text-center text-sm text-brand-text-muted">Comece adicionando um produto ou uma pesagem.</li> : cartGroups.flatMap(({ item, children }) => [
      <CartLine key={item.id} item={item} canDiscount={can("discount")} onDiscount={(value) => updateItemDiscount(item.id, value)} onRemove={() => removeItem(item.id)} isActive={needsGroupSelection && item.sourceId === "acai" && item.id === activeAcaiGroupId} onActivate={needsGroupSelection && item.sourceId === "acai" ? () => setActiveAcaiGroupId(item.id) : undefined} />,
      ...children.map((child) => <CartLine key={child.id} item={child} indented canDiscount={can("discount")} onDiscount={(value) => updateItemDiscount(child.id, value)} onRemove={() => removeItem(child.id)} />),
    ])}</ul>{cart.length > 0 ? <label className="flex items-center justify-between gap-2 border-t border-brand-border pt-3 text-sm text-brand-text-soft">Desconto na venda<input id="sale-discount" name="saleDiscount" aria-label="Desconto na venda (%)" disabled={!can("discount")} type="number" min="0" max="100" value={saleDiscount} onChange={(event) => { setSaleDiscount(Math.min(100, Math.max(0, Number(event.target.value) || 0))); clearPayments(); }} className="h-8 w-16 rounded-md border border-brand-border bg-brand-surface-card px-2 text-right text-brand-plum-900 disabled:opacity-50" />%</label> : null}<div className="rounded-xl bg-brand-surface-muted p-3"><div className="flex items-end justify-between gap-3"><span className="text-sm font-medium text-brand-text-soft">Total</span><strong className="font-serif text-4xl font-semibold text-brand-plum-950">{money.format(total)}</strong></div>{remaining > 0 ? <p className="mt-1 text-sm font-medium text-brand-rose">Falta pagar {money.format(remaining)}</p> : cart.length > 0 ? <p className="mt-1 text-sm font-medium text-brand-success">Pagamento completo</p> : null}{change > 0 ? <p className="mt-1 text-sm font-medium text-brand-success">Troco em dinheiro: {money.format(change)}</p> : null}</div><div className="border-t border-brand-border pt-3"><div className="mb-2 flex items-center justify-between"><p className="text-sm font-semibold text-brand-plum-900">Pagamento</p><Button size="xs" variant="outline" className={outlineButtonClass} onClick={() => setTerminalOpen(true)}><CreditCard /> Maquininha</Button></div><PaymentMethodSelector value={method} onChange={setMethod} /><div className="mt-2 flex flex-wrap gap-2"><input id="payment-amount" name="paymentAmount" aria-label="Valor do pagamento" aria-invalid={Boolean(paymentError)} inputMode="decimal" value={amount} onChange={(event) => { setAmount(event.target.value); setPaymentError(null); }} placeholder="R$ 0,00" className="h-9 min-w-0 flex-1 rounded-lg border border-brand-border bg-brand-surface-card px-3 text-sm text-brand-plum-900 focus-visible:outline-2 focus-visible:outline-brand-primary" />{remaining > 0 ? <Button type="button" size="sm" variant="outline" className={outlineButtonClass} onClick={() => { setAmount(remaining.toFixed(2).replace(".", ",")); setPaymentError(null); }}>Valor exato</Button> : null}<Button className="bg-brand-primary text-white hover:bg-brand-primary-dark" onClick={addPayment}>Adicionar</Button></div>{paymentError ? <p role="alert" className="mt-2 text-xs text-brand-rose">{paymentError}</p> : null}{payments.length > 0 ? <ul aria-label="Pagamentos registrados" className="mt-3 space-y-2">{payments.map((payment) => <li key={payment.id} className="flex items-center justify-between rounded-lg bg-brand-surface-muted px-3 py-2 text-sm"><span className="text-brand-text-soft">{payment.method}</span><span className="flex items-center gap-2 font-semibold tabular-nums text-brand-plum-900">{money.format(payment.amount)}<Button aria-label={`Remover pagamento ${payment.method}`} size="icon-xs" variant="ghost" className="text-brand-text-muted hover:bg-brand-surface-card hover:text-brand-plum-900 dark:hover:bg-brand-surface-card dark:hover:text-brand-plum-900" onClick={() => setPayments((items) => items.filter((item) => item.id !== payment.id))}>×</Button></span></li>)}</ul> : null}</div><OperationFeedback message={feedback?.message ?? null} tone={feedback?.tone} /><Button disabled={!canFinish} className="h-12 w-full bg-brand-primary text-base text-white hover:bg-brand-primary-dark disabled:bg-brand-accent-peach disabled:text-brand-text-soft" onClick={() => setFeedback({ message: "Finalização fiscal indisponível: conecte emissor fiscal e impressora para concluir vendas reais.", tone: "info" })}>Finalizar venda</Button><p className="text-center text-xs text-brand-text-muted">Próxima ação: {nextAction}</p></CardContent></Card></aside></div>
    <section aria-label="Ações rápidas" className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-border bg-brand-surface-card p-3 shadow-sm"><span className="mr-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-text-soft"><Keyboard className="size-4" /> Ações rápidas</span><Button size="sm" variant="outline" className={outlineButtonClass} onClick={() => setTerminalOpen(true)}>F2 · Maquininha</Button><Button size="sm" variant="outline" className={outlineButtonClass} disabled={cart.length === 0} onClick={requestAuthorization}>F4 · Cancelar item</Button><Button size="sm" variant="outline" className={outlineButtonClass} disabled={cart.length === 0} onClick={() => { setCart([]); setActiveAcaiGroupId(null); clearPayments(); }}>F6 · Limpar venda</Button><Button size="sm" variant="outline" className={outlineButtonClass} onClick={() => setFeedback({ message: "Reimpressão indisponível sem integração com a térmica.", tone: "info" })}>F8 · Reimprimir</Button><Button size="sm" variant="outline" className={outlineButtonClass} disabled={!can("closeCash")} onClick={() => setCashCloseOpen(true)}>F10 · Fechar caixa</Button></section>
  </motion.div><PosDialog open={terminalOpen} onOpenChange={setTerminalOpen} title="Maquininha" description="Integração ainda não conectada. Use este painel somente para validar a interface."><div className="rounded-lg bg-brand-surface-muted p-4"><p className="text-xs text-brand-text-muted">Valor a cobrar</p><strong className="font-serif text-3xl text-brand-plum-950">{money.format(remaining || total)}</strong></div>{terminalState === "waiting" ? <p role="status" className="mt-4 text-sm text-brand-text-soft">Aguardando resposta do dispositivo simulado…</p> : null}{terminalState === "declined" ? <p role="alert" className="mt-4 text-sm text-brand-rose">Pagamento recusado (simulação).</p> : null}<div className="mt-5 flex justify-end gap-2"><Button variant="outline" className={outlineButtonClass} onClick={() => setTerminalOpen(false)}>Fechar</Button><Button variant="outline" className={outlineButtonClass} onClick={() => setTerminalState("declined")}>Simular recusa</Button><Button className="bg-brand-primary text-white hover:bg-brand-primary-dark" onClick={() => setTerminalState("waiting")}>Iniciar simulação</Button></div></PosDialog><PosDialog open={pixOpen} onOpenChange={setPixOpen} title="Cobrança Pix" description="QR Code e confirmação dependem de um provedor Pix integrado."><div aria-label="QR Code indisponível" className="grid min-h-36 place-items-center rounded-xl border border-dashed border-brand-border bg-brand-surface-muted text-center text-sm text-brand-text-muted">QR Code indisponível<br />Integração Pix pendente</div><div className="mt-5 flex justify-end"><Button variant="outline" className={outlineButtonClass} onClick={() => setPixOpen(false)}>Fechar</Button></div></PosDialog><PosDialog open={authorizationOpen} onOpenChange={setAuthorizationOpen} title="Solicitar autorização" description="O cancelamento exige validação do servidor."><OperationFeedback message="A senha não é coletada no navegador. Conecte a autorização de supervisor no backend para concluir esta ação." tone="info" /><div className="mt-5 flex justify-end"><Button variant="outline" className={outlineButtonClass} onClick={() => setAuthorizationOpen(false)}>Entendi</Button></div></PosDialog><PosDialog open={cashCloseOpen} onOpenChange={setCashCloseOpen} title="Fechamento do caixa" description="A conferência por forma de pagamento será habilitada ao conectar o módulo financeiro."><div className="grid grid-cols-2 gap-2">{paymentMethods.map((entry) => <div key={entry} className="rounded-lg bg-brand-surface-muted p-3 text-sm text-brand-text-soft"><span>{entry}</span><strong className="mt-1 block text-brand-plum-950">R$ —</strong></div>)}</div><div className="mt-5 flex justify-end"><Button variant="outline" className={outlineButtonClass} onClick={() => setCashCloseOpen(false)}>Fechar</Button></div></PosDialog></main>;
}
