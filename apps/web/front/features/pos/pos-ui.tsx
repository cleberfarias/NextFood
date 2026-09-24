"use client";

import { CheckCircle2, CircleAlert, Minus, Plus, Scale, Trash2 } from "lucide-react";
import { Dialog } from "radix-ui";
import type { ReactNode } from "react";
import { Button } from "@/front/ui/button";
import type { CartItem, PaymentMethod } from "./pos-mocks";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function ProductCard({ name, price, onAdd }: { name: string; price: number; onAdd: () => void }) {
  return <button type="button" onClick={onAdd} className="group min-h-24 rounded-xl border border-brand-border bg-brand-surface-muted p-4 text-left transition-colors hover:border-brand-primary hover:bg-brand-surface-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary">
    <span className="block text-sm font-semibold text-brand-plum-900">{name}</span><span className="mt-2 block text-base font-semibold text-brand-primary">{money.format(price)}</span><span className="mt-1 block text-xs text-brand-text-muted group-hover:text-brand-text-soft">Adicionar ao carrinho</span>
  </button>;
}

export function CartLine({ item, canDiscount, onDiscount, onRemove }: { item: CartItem; canDiscount: boolean; onDiscount: (value: string) => void; onRemove: () => void }) {
  return <li className="grid grid-cols-[1fr_auto] gap-x-3 border-b border-brand-border py-3 last:border-0">
    <div><p className="font-medium text-brand-plum-900">{item.name}</p><p className="mt-0.5 text-xs text-brand-text-muted">{item.quantityLabel}</p>{canDiscount ? <label className="mt-2 inline-flex items-center gap-1 text-xs text-brand-text-soft">Desconto <input aria-label={`Desconto de ${item.name} (%)`} type="number" min="0" max="100" value={item.discountPercent ?? 0} onChange={(event) => onDiscount(event.target.value)} className="h-7 w-12 rounded-md border border-brand-border bg-brand-surface-card px-1 text-right text-brand-plum-900 focus-visible:outline-2 focus-visible:outline-brand-primary" />%</label> : null}</div>
    <div className="flex items-start gap-1"><strong className="pt-1 text-sm tabular-nums text-brand-plum-900">{money.format(item.total)}</strong><Button aria-label={`Remover ${item.name}`} variant="ghost" size="icon-xs" className="text-brand-text-muted hover:bg-brand-surface-muted hover:text-brand-plum-900" onClick={onRemove}><Trash2 /></Button></div>
  </li>;
}

export function PaymentMethodSelector({ value, onChange }: { value: PaymentMethod; onChange: (method: PaymentMethod) => void }) {
  return <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Forma de pagamento">{(["Dinheiro", "Débito", "Crédito", "Pix"] as const).map((method) => <Button key={method} type="button" variant={value === method ? "default" : "outline"} aria-checked={value === method} role="radio" className={value === method ? "bg-brand-primary text-white hover:bg-brand-primary-dark" : "border-brand-border bg-brand-surface-card text-brand-text-soft hover:border-brand-primary hover:bg-brand-surface-muted"} onClick={() => onChange(method)}>{method}</Button>)}</div>;
}

export function ScaleIndicator({ weightKg, status }: { weightKg: number | null; status: "connected" | "disconnected" }) {
  const connected = status === "connected";
  return <div className="rounded-xl border border-brand-border bg-brand-surface-muted p-5"><div className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2 text-sm font-medium text-brand-plum-900"><Scale className="size-4 text-brand-rose" /> Balança do caixa 01</span><span className={connected ? "inline-flex items-center gap-1 text-xs font-medium text-brand-success" : "inline-flex items-center gap-1 text-xs font-medium text-brand-rose"}>{connected ? <CheckCircle2 className="size-4" /> : <CircleAlert className="size-4" />}{connected ? "Simulada" : "Desconectada"}</span></div><p className="mt-5 font-mono text-4xl font-semibold tracking-tight text-brand-plum-950">{weightKg === null ? "—" : `${weightKg.toFixed(3).replace(".", ",")} kg`}</p><p className="mt-2 text-xs text-brand-text-muted">Leitura demonstrativa; conecte uma balança para usar dados reais.</p></div>;
}

export function QuantityControl({ name, quantity, onChange }: { name: string; quantity: number; onChange: (delta: number) => void }) {
  return <div className="flex items-center justify-between gap-2 rounded-lg border border-brand-border bg-brand-surface-muted px-3 py-2"><span className="text-sm font-medium text-brand-plum-900">{name}</span><div className="flex items-center gap-2"><Button aria-label={`Diminuir ${name}`} size="icon-xs" variant="outline" disabled={quantity === 0} onClick={() => onChange(-1)}><Minus /></Button><span aria-label={`Quantidade de ${name}`} className="w-4 text-center text-sm font-semibold tabular-nums">{quantity}</span><Button aria-label={`Adicionar ${name}`} size="icon-xs" variant="outline" onClick={() => onChange(1)}><Plus /></Button></div></div>;
}

export function OperationFeedback({ message, tone = "info" }: { message: string | null; tone?: "info" | "error" | "success" }) {
  if (!message) return null;
  const styles = tone === "error" ? "border-brand-rose bg-brand-surface-card text-brand-plum-900" : tone === "success" ? "border-brand-success bg-brand-surface-card text-brand-success" : "border-brand-border bg-brand-surface-muted text-brand-text-soft";
  return <p role={tone === "error" ? "alert" : "status"} className={`rounded-lg border px-3 py-2 text-sm ${styles}`}>{message}</p>;
}

export function PosDialog({ open, onOpenChange, title, description, children }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string; children: ReactNode }) {
  return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-brand-plum-950/45 data-[state=open]:animate-in data-[state=closed]:animate-out" /><Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-brand-border bg-brand-surface-card p-6 shadow-xl focus:outline-none"><Dialog.Title className="font-serif text-2xl font-semibold text-brand-plum-950">{title}</Dialog.Title><Dialog.Description className="mt-2 text-sm text-brand-text-soft">{description}</Dialog.Description><div className="mt-5">{children}</div></Dialog.Content></Dialog.Portal></Dialog.Root>;
}
