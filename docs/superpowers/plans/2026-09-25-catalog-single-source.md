# Catálogo único Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uma única fonte de dados (produtos, embalagens, complementos e itens de estoque) lida pelo caixa e pelo estoque, com validação de integridade e o consumo de estoque de cada produto registrado.

**Architecture:** Tipos e regras puras em `back/domain/catalog/catalog.ts` (sem React/Next/Firebase). Dados simulados num único `front/features/catalog/catalog-mocks.ts`. O caixa e o estoque trocam as listas próprias pela leitura do catálogo, sem mudar comportamento.

**Tech Stack:** TypeScript, Next.js 15 / React 19, Vitest + Testing Library. Comandos rodam em `apps/web`.

**Spec:** `docs/superpowers/specs/2026-09-25-catalog-single-source-design.md`

## Global Constraints

- `back/domain/**` não importa `next`, `react` nem `firebase-admin` (`back/architecture.test.ts`).
- Mensagens de erro exatamente como na spec, em português.
- Unicidade de id é por lista: embalagem `copo-300` e item de estoque `copo-300` com o mesmo id é válido.
- O caixa não muda de comportamento: mesmos produtos por unidade (Copo 300 ml R$ 14,90, Pote de sorvete 1 L R$ 29,90, Picolé cremoso R$ 6,50, nesta ordem), açaí a R$ 39,90/kg, mesmos 6 complementos com os mesmos preços e ordem.
- O estoque ganha só a Casquinha (13 itens); o alerta continua com 4 itens.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Não commitar `chefe.mp4` nem o trabalho não commitado da home.

## Review Focus

1. **Ordem e preços no caixa**: trocar a fonte não pode reordenar botões nem mudar preço; a lista de complementos vem de `CATALOG.complements` na ordem Banana, Granola, Leite condensado, Paçoca, Morango, Confete. Coberto pelos testes existentes do caixa e pelo teste de `unitProducts` (ordem).
2. **Id repetido entre listas diferentes**: não é erro (embalagem e item de estoque compartilham id). O catálogo válido do teste já tem `copo` nas duas listas e precisa dar `[]`.
3. **`NaN`/`Infinity` em campos numéricos**: um preço `NaN` precisa falhar como "O preço precisa ser maior que zero.", não passar em silêncio (teste na Task 1).
4. **`weighedProduct` sem produto `peso`**: lança erro com mensagem clara em vez de devolver `undefined` e quebrar depois com `cannot read pricePerKg` (teste na Task 1).
5. **Casquinha no estoque**: não pode entrar no alerta (saldo 60 ≥ mínimo 20); o teste existente "4 itens precisam de reposição" continua passando (Task 2).

---

### Task 1: Domínio do catálogo

**Files:**
- Create: `apps/web/back/domain/catalog/catalog.ts`
- Test: `apps/web/back/domain/catalog/catalog.test.ts`

**Interfaces:**
- Consumes: `InventoryItem` de `apps/web/back/domain/inventory/inventory.ts` (`{ id; name; category: "insumo" | "produto"; unit: "kg" | "un" | "L"; balance; minimum }`).
- Produces: tipos `StockUsage`, `Packaging`, `Complement`, `WeighedProduct`, `ReadyCupProduct`, `UnitProduct`, `SaleProduct`, `Catalog`, `CatalogError`; funções `validateCatalog(catalog: Catalog): CatalogError[]`, `unitProducts(catalog: Catalog): UnitProduct[]`, `weighedProduct(catalog: Catalog): WeighedProduct`.

- [ ] **Step 1: Write the failing test**

`apps/web/back/domain/catalog/catalog.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { unitProducts, validateCatalog, weighedProduct, type Catalog, type SaleProduct, type UnitProduct } from "./catalog";

function validCatalog(): Catalog {
  return {
    stockItems: [
      { id: "polpa", name: "Polpa", category: "insumo", unit: "kg", balance: 1, minimum: 1 },
      { id: "copo", name: "Copo", category: "insumo", unit: "un", balance: 10, minimum: 1 },
      { id: "granola", name: "Granola", category: "insumo", unit: "kg", balance: 1, minimum: 1 },
    ],
    // Same id as the stock item on purpose: uniqueness is per list.
    packagings: [{ id: "copo", name: "Copo", stockItemId: "copo", tareKg: 0.01 }],
    complements: [{ id: "granola", name: "Granola", extraPrice: 2.5, stockItemId: "granola" }],
    products: [
      { kind: "peso", id: "acai", name: "Açaí", pricePerKg: 40, packagingIds: ["copo"], consumesPerKg: [{ itemId: "polpa", quantity: 0.8 }] },
      { kind: "pronto", id: "pronto", name: "Pronto", price: 15, packagingId: "copo", includedComplements: 3, consumes: [{ itemId: "polpa", quantity: 0.35 }] },
      { kind: "unidade", id: "avulso", name: "Copo avulso", price: 10, consumes: [{ itemId: "copo", quantity: 1 }] },
    ],
  };
}

function withProduct(id: string, patch: Record<string, unknown>): Catalog {
  const catalog = validCatalog();
  return { ...catalog, products: catalog.products.map((product) => (product.id === id ? ({ ...product, ...patch } as SaleProduct) : product)) };
}

describe("validateCatalog", () => {
  it("returns no errors for a valid catalog, even with the same id in different lists", () => {
    expect(validateCatalog(validCatalog())).toEqual([]);
  });

  it("rejects a repeated id inside one list", () => {
    const catalog = validCatalog();
    const errors = validateCatalog({ ...catalog, stockItems: [...catalog.stockItems, catalog.stockItems[0]] });
    expect(errors).toContainEqual({ path: "stockItems[polpa]", message: "Id repetido: polpa." });
  });

  it("rejects a reference to a missing stock item", () => {
    expect(validateCatalog(withProduct("avulso", { consumes: [{ itemId: "nada", quantity: 1 }] }))).toContainEqual({
      path: "products[avulso].consumes[0]",
      message: "Item de estoque não encontrado: nada.",
    });
  });

  it("rejects a reference to a missing packaging", () => {
    expect(validateCatalog(withProduct("pronto", { packagingId: "x" }))).toContainEqual({
      path: "products[pronto].packagingId",
      message: "Embalagem não encontrada: x.",
    });
    expect(validateCatalog(withProduct("acai", { packagingIds: ["copo", "y"] }))).toContainEqual({
      path: "products[acai].packagingIds",
      message: "Embalagem não encontrada: y.",
    });
  });

  it("rejects a price that is zero, negative or not a number", () => {
    const message = "O preço precisa ser maior que zero.";
    expect(validateCatalog(withProduct("acai", { pricePerKg: 0 }))).toContainEqual({ path: "products[acai]", message });
    expect(validateCatalog(withProduct("pronto", { price: -1 }))).toContainEqual({ path: "products[pronto]", message });
    expect(validateCatalog(withProduct("avulso", { price: Number.NaN }))).toContainEqual({ path: "products[avulso]", message });
  });

  it("rejects a negative extra price but accepts zero", () => {
    const catalog = validCatalog();
    const negative = { ...catalog, complements: [{ ...catalog.complements[0], extraPrice: -1 }] };
    expect(validateCatalog(negative)).toContainEqual({ path: "complements[granola]", message: "O adicional não pode ser negativo." });
    expect(validateCatalog({ ...catalog, complements: [{ ...catalog.complements[0], extraPrice: 0 }] })).toEqual([]);
  });

  it("rejects a negative tare", () => {
    const catalog = validCatalog();
    const errors = validateCatalog({ ...catalog, packagings: [{ ...catalog.packagings[0], tareKg: -0.01 }] });
    expect(errors).toContainEqual({ path: "packagings[copo]", message: "A tara não pode ser negativa." });
  });

  it("rejects a fractional or negative number of included complements", () => {
    const message = "Informe um número inteiro de complementos incluídos.";
    expect(validateCatalog(withProduct("pronto", { includedComplements: 1.5 }))).toContainEqual({ path: "products[pronto]", message });
    expect(validateCatalog(withProduct("pronto", { includedComplements: -1 }))).toContainEqual({ path: "products[pronto]", message });
  });

  it("rejects a consumption of zero", () => {
    expect(validateCatalog(withProduct("pronto", { consumes: [{ itemId: "polpa", quantity: 0 }] }))).toContainEqual({
      path: "products[pronto].consumes[0]",
      message: "O consumo precisa ser maior que zero.",
    });
  });

  it("rejects a fractional consumption of an item counted in units", () => {
    expect(validateCatalog(withProduct("avulso", { consumes: [{ itemId: "copo", quantity: 0.5 }] }))).toContainEqual({
      path: "products[avulso].consumes[0]",
      message: "Use um número inteiro para itens em unidades.",
    });
  });

  it("rejects a per-kg consumption of an item counted in units", () => {
    expect(validateCatalog(withProduct("acai", { consumesPerKg: [{ itemId: "copo", quantity: 1 }] }))).toContainEqual({
      path: "products[acai].consumesPerKg[0]",
      message: "Consumo por kg só vale para itens em kg ou L.",
    });
  });

  it("rejects a packaging whose stock item is not counted in units", () => {
    const catalog = validCatalog();
    const errors = validateCatalog({ ...catalog, packagings: [{ ...catalog.packagings[0], stockItemId: "polpa" }] });
    expect(errors).toContainEqual({ path: "packagings[copo]", message: "A embalagem precisa ser um item contado em unidades." });
  });

  it("rejects a weighed product without packaging", () => {
    expect(validateCatalog(withProduct("acai", { packagingIds: [] }))).toContainEqual({
      path: "products[acai]",
      message: "Informe ao menos uma embalagem.",
    });
  });
});

describe("catalog readers", () => {
  it("unitProducts keeps only unit products, in catalog order", () => {
    const catalog = validCatalog();
    const second: UnitProduct = { kind: "unidade", id: "picole", name: "Picolé", price: 6.5, consumes: [] };
    const products = unitProducts({ ...catalog, products: [second, ...catalog.products] });
    expect(products.map((product) => product.id)).toEqual(["picole", "avulso"]);
  });

  it("weighedProduct finds the weighed product and throws when there is none", () => {
    const catalog = validCatalog();
    expect(weighedProduct(catalog).pricePerKg).toBe(40);
    expect(() => weighedProduct({ ...catalog, products: catalog.products.filter((product) => product.kind !== "peso") })).toThrow(
      "O catálogo não tem produto vendido por peso.",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit -- back/domain/catalog`
Expected: FAIL — `Failed to resolve import "./catalog"` (o arquivo ainda não existe).

- [ ] **Step 3: Write minimal implementation**

`apps/web/back/domain/catalog/catalog.ts`:

```ts
import type { InventoryItem } from "../inventory/inventory";

/** How much leaves stock item `itemId`, in that item's own unit. */
export type StockUsage = { itemId: string; quantity: number };

/** A cup or cone: consumes one unit of `stockItemId`; `tareKg` is its empty weight, taken off the scale. */
export type Packaging = { id: string; name: string; stockItemId: string; tareKg: number };

/** No automatic stock usage (it goes inside the weight); stock is corrected by the physical count. */
export type Complement = { id: string; name: string; extraPrice: number; stockItemId: string };

type ProductBase = { id: string; name: string };
/** Built by the customer and weighed; `consumesPerKg` is per net kg sold. */
export type WeighedProduct = ProductBase & { kind: "peso"; pricePerKg: number; packagingIds: string[]; consumesPerKg: StockUsage[] };
/** Fixed price with `includedComplements`; `consumes` is per cup, on top of the packaging. */
export type ReadyCupProduct = ProductBase & { kind: "pronto"; price: number; packagingId: string; includedComplements: number; consumes: StockUsage[] };
export type UnitProduct = ProductBase & { kind: "unidade"; price: number; consumes: StockUsage[] };
export type SaleProduct = WeighedProduct | ReadyCupProduct | UnitProduct;

export type Catalog = {
  stockItems: readonly InventoryItem[];
  packagings: readonly Packaging[];
  complements: readonly Complement[];
  products: readonly SaleProduct[];
};

export type CatalogError = { path: string; message: string };

const PRICE_MESSAGE = "O preço precisa ser maior que zero.";

function isPositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function isNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

export function validateCatalog(catalog: Catalog): CatalogError[] {
  const errors: CatalogError[] = [];
  const report = (path: string, message: string) => errors.push({ path, message });

  const lists = [
    ["stockItems", catalog.stockItems],
    ["packagings", catalog.packagings],
    ["complements", catalog.complements],
    ["products", catalog.products],
  ] as const;
  for (const [name, list] of lists) {
    const seen = new Set<string>();
    for (const entry of list) {
      if (seen.has(entry.id)) report(`${name}[${entry.id}]`, `Id repetido: ${entry.id}.`);
      seen.add(entry.id);
    }
  }

  const stock = new Map(catalog.stockItems.map((item) => [item.id, item]));
  const packagingIds = new Set(catalog.packagings.map((packaging) => packaging.id));

  function stockItem(path: string, itemId: string): InventoryItem | undefined {
    const item = stock.get(itemId);
    if (!item) report(path, `Item de estoque não encontrado: ${itemId}.`);
    return item;
  }

  function checkPackaging(path: string, id: string) {
    if (!packagingIds.has(id)) report(path, `Embalagem não encontrada: ${id}.`);
  }

  function checkUsages(basePath: string, usages: readonly StockUsage[], perKg: boolean) {
    usages.forEach((usage, index) => {
      const path = `${basePath}[${index}]`;
      const item = stockItem(path, usage.itemId);
      if (!isPositive(usage.quantity)) {
        report(path, "O consumo precisa ser maior que zero.");
        return;
      }
      if (item?.unit !== "un") return;
      if (perKg) report(path, "Consumo por kg só vale para itens em kg ou L.");
      else if (!Number.isInteger(usage.quantity)) report(path, "Use um número inteiro para itens em unidades.");
    });
  }

  for (const packaging of catalog.packagings) {
    const path = `packagings[${packaging.id}]`;
    const item = stockItem(path, packaging.stockItemId);
    if (item && item.unit !== "un") report(path, "A embalagem precisa ser um item contado em unidades.");
    if (!isNonNegative(packaging.tareKg)) report(path, "A tara não pode ser negativa.");
  }

  for (const complement of catalog.complements) {
    const path = `complements[${complement.id}]`;
    stockItem(path, complement.stockItemId);
    if (!isNonNegative(complement.extraPrice)) report(path, "O adicional não pode ser negativo.");
  }

  for (const product of catalog.products) {
    const path = `products[${product.id}]`;
    switch (product.kind) {
      case "peso":
        if (!isPositive(product.pricePerKg)) report(path, PRICE_MESSAGE);
        if (product.packagingIds.length === 0) report(path, "Informe ao menos uma embalagem.");
        for (const id of product.packagingIds) checkPackaging(`${path}.packagingIds`, id);
        checkUsages(`${path}.consumesPerKg`, product.consumesPerKg, true);
        break;
      case "pronto":
        if (!isPositive(product.price)) report(path, PRICE_MESSAGE);
        checkPackaging(`${path}.packagingId`, product.packagingId);
        if (!(Number.isInteger(product.includedComplements) && product.includedComplements >= 0)) {
          report(path, "Informe um número inteiro de complementos incluídos.");
        }
        checkUsages(`${path}.consumes`, product.consumes, false);
        break;
      case "unidade":
        if (!isPositive(product.price)) report(path, PRICE_MESSAGE);
        checkUsages(`${path}.consumes`, product.consumes, false);
        break;
    }
  }

  return errors;
}

export function unitProducts(catalog: Catalog): UnitProduct[] {
  return catalog.products.filter((product): product is UnitProduct => product.kind === "unidade");
}

export function weighedProduct(catalog: Catalog): WeighedProduct {
  const product = catalog.products.find((entry): entry is WeighedProduct => entry.kind === "peso");
  if (!product) throw new Error("O catálogo não tem produto vendido por peso.");
  return product;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:unit -- back/domain/catalog`
Expected: PASS — 15 tests.

Run: `pnpm test:unit -- back/architecture && pnpm typecheck`
Expected: PASS; `tsc --noEmit` sem erros.

- [ ] **Step 5: Commit**

```bash
git add apps/web/back/domain/catalog
git commit -m "feat(catalogo): modelo de produtos, embalagens e complementos com validação"
```

---

### Task 2: Dados simulados únicos e leitura pelo caixa e estoque

**Files:**
- Create: `apps/web/front/features/catalog/catalog-mocks.ts`
- Test: `apps/web/front/features/catalog/catalog-mocks.test.ts`
- Modify: `apps/web/front/features/pos/pos-mocks.ts` (remove `AÇAI_PRICE_PER_KG`, `UNIT_PRODUCTS`, `AÇAI_COMPLEMENTS`)
- Modify: `apps/web/front/features/pos/pdv-experience.tsx:11` (import) e antes da linha 15 (constantes derivadas)
- Modify: `apps/web/front/features/inventory/inventory-mocks.ts` (remove `INVENTORY_ITEMS`)
- Modify: `apps/web/front/features/inventory/inventory-experience.tsx:18,40` (lista inicial do catálogo)
- Modify: `apps/web/front/features/inventory/inventory-experience.test.tsx:48` (12 → 13)

**Interfaces:**
- Consumes: `Catalog`, `validateCatalog`, `unitProducts`, `weighedProduct` da Task 1.
- Produces: `CATALOG: Catalog` exportado de `@/front/features/catalog/catalog-mocks`.

- [ ] **Step 1: Write the failing test**

`apps/web/front/features/catalog/catalog-mocks.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { validateCatalog } from "@/back/domain/catalog/catalog";
import { CATALOG } from "./catalog-mocks";

describe("CATALOG", () => {
  it("passes every catalog rule", () => {
    expect(validateCatalog(CATALOG)).toEqual([]);
  });

  it("keeps the unit products, prices and complements the till sells today", () => {
    expect(CATALOG.products.filter((product) => product.kind === "unidade").map((product) => [product.name, product.price])).toEqual([
      ["Copo 300 ml", 14.9],
      ["Pote de sorvete 1 L", 29.9],
      ["Picolé cremoso", 6.5],
    ]);
    expect(CATALOG.complements.map((complement) => [complement.name, complement.extraPrice])).toEqual([
      ["Banana", 2],
      ["Granola", 2.5],
      ["Leite condensado", 2.5],
      ["Paçoca", 2.5],
      ["Morango", 3.5],
      ["Confete", 2],
    ]);
  });
});
```

E em `apps/web/front/features/inventory/inventory-experience.test.tsx`, linha 48, a lista completa passa a ter a Casquinha:

```ts
    expect(within(screen.getByRole("list", { name: "Itens do estoque" })).getAllByRole("listitem")).toHaveLength(13);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit -- front/features/catalog front/features/inventory`
Expected: FAIL — `Failed to resolve import "./catalog-mocks"`, e `expected [ …(12) ] to have a length of 13`.

- [ ] **Step 3: Write minimal implementation**

`apps/web/front/features/catalog/catalog-mocks.ts`:

```ts
import type { Catalog } from "@/back/domain/catalog/catalog";

// Tare, pulp factors and portions are simulated estimates; the owner tunes them in Cardápio.
// Morango starts empty and three items start at or under their minimum, so
// the low-stock banner is visible on first load.
export const CATALOG: Catalog = {
  stockItems: [
    { id: "polpa-acai", name: "Polpa de açaí", category: "insumo", unit: "kg", balance: 1.2, minimum: 5 },
    { id: "granola", name: "Granola", category: "insumo", unit: "kg", balance: 3.5, minimum: 2 },
    { id: "leite-condensado", name: "Leite condensado", category: "insumo", unit: "un", balance: 4, minimum: 6 },
    { id: "pacoca", name: "Paçoca", category: "insumo", unit: "un", balance: 30, minimum: 10 },
    { id: "banana", name: "Banana", category: "insumo", unit: "kg", balance: 2, minimum: 1.5 },
    { id: "morango", name: "Morango", category: "insumo", unit: "kg", balance: 0, minimum: 1 },
    { id: "confete", name: "Confete", category: "insumo", unit: "kg", balance: 0.8, minimum: 0.5 },
    { id: "copo-300", name: "Copo 300 ml", category: "insumo", unit: "un", balance: 180, minimum: 50 },
    { id: "copo-500", name: "Copo 500 ml", category: "insumo", unit: "un", balance: 40, minimum: 50 },
    { id: "casquinha", name: "Casquinha", category: "insumo", unit: "un", balance: 60, minimum: 20 },
    { id: "colher", name: "Colheres", category: "insumo", unit: "un", balance: 500, minimum: 100 },
    { id: "pote-1l", name: "Pote 1 L", category: "insumo", unit: "un", balance: 12, minimum: 10 },
    { id: "picole", name: "Picolé cremoso", category: "produto", unit: "un", balance: 25, minimum: 20 },
  ],
  packagings: [
    { id: "copo-300", name: "Copo 300 ml", stockItemId: "copo-300", tareKg: 0.012 },
    { id: "copo-500", name: "Copo 500 ml", stockItemId: "copo-500", tareKg: 0.018 },
    { id: "casquinha", name: "Casquinha", stockItemId: "casquinha", tareKg: 0.01 },
  ],
  complements: [
    { id: "banana", name: "Banana", extraPrice: 2, stockItemId: "banana" },
    { id: "granola", name: "Granola", extraPrice: 2.5, stockItemId: "granola" },
    { id: "leite-condensado", name: "Leite condensado", extraPrice: 2.5, stockItemId: "leite-condensado" },
    { id: "pacoca", name: "Paçoca", extraPrice: 2.5, stockItemId: "pacoca" },
    { id: "morango", name: "Morango", extraPrice: 3.5, stockItemId: "morango" },
    { id: "confete", name: "Confete", extraPrice: 2, stockItemId: "confete" },
  ],
  products: [
    {
      kind: "peso",
      id: "acai-peso",
      name: "Açaí por peso",
      pricePerKg: 39.9,
      packagingIds: ["copo-300", "copo-500", "casquinha"],
      consumesPerKg: [{ itemId: "polpa-acai", quantity: 0.8 }],
    },
    {
      kind: "pronto",
      id: "copo-pronto-500",
      name: "Copo pronto 500 ml",
      price: 15,
      packagingId: "copo-500",
      includedComplements: 3,
      consumes: [
        { itemId: "polpa-acai", quantity: 0.35 },
        { itemId: "colher", quantity: 1 },
      ],
    },
    {
      kind: "unidade",
      id: "copo-300",
      name: "Copo 300 ml",
      price: 14.9,
      consumes: [
        { itemId: "copo-300", quantity: 1 },
        { itemId: "colher", quantity: 1 },
      ],
    },
    { kind: "unidade", id: "pote-1l", name: "Pote de sorvete 1 L", price: 29.9, consumes: [{ itemId: "pote-1l", quantity: 1 }] },
    { kind: "unidade", id: "picole", name: "Picolé cremoso", price: 6.5, consumes: [{ itemId: "picole", quantity: 1 }] },
  ],
};
```

`apps/web/front/features/pos/pos-mocks.ts` fica assim (as três listas de produto saem):

```ts
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
```

Em `apps/web/front/features/pos/pdv-experience.tsx`, troque a linha 11:

```ts
import { AÇAI_COMPLEMENTS, AÇAI_PRICE_PER_KG, MOCK_SCALE, type CartItem, type PaymentMethod, UNIT_PRODUCTS } from "./pos-mocks";
```

por:

```ts
import { unitProducts, weighedProduct } from "@/back/domain/catalog/catalog";
import { CATALOG } from "@/front/features/catalog/catalog-mocks";
import { MOCK_SCALE, type CartItem, type PaymentMethod } from "./pos-mocks";
```

e, logo depois de `const money = …` (antes de `const AÇAÍ_COMPLEMENTS = AÇAI_COMPLEMENTS;`), adicione as constantes com os mesmos nomes que o resto do arquivo já usa:

```ts
const UNIT_PRODUCTS = unitProducts(CATALOG);
const AÇAI_PRICE_PER_KG = weighedProduct(CATALOG).pricePerKg;
// Until the till adopts ready cups, a complement is still charged per portion at its extra price.
const AÇAI_COMPLEMENTS = CATALOG.complements.map((complement) => ({ id: complement.id, name: complement.name, price: complement.extraPrice }));
```

`apps/web/front/features/inventory/inventory-mocks.ts` fica só com:

```ts
export const MOVEMENT_AUTHOR = "Usuário local (simulação)";
```

Em `apps/web/front/features/inventory/inventory-experience.tsx`, troque a linha 18:

```ts
import { INVENTORY_ITEMS, MOVEMENT_AUTHOR } from "./inventory-mocks";
```

por:

```ts
import { CATALOG } from "@/front/features/catalog/catalog-mocks";
import { MOVEMENT_AUTHOR } from "./inventory-mocks";
```

e a linha 40:

```ts
export function InventoryExperience({ initialItems = INVENTORY_ITEMS }: { initialItems?: readonly InventoryItem[] }) {
```

por:

```ts
export function InventoryExperience({ initialItems = CATALOG.stockItems }: { initialItems?: readonly InventoryItem[] }) {
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:unit -- front/features/catalog front/features/inventory front/features/pos`
Expected: PASS — catálogo 2/2, estoque e caixa todos verdes (incluindo "4 itens precisam de reposição").

Run: `pnpm test:unit && pnpm typecheck && pnpm lint`
Expected: suíte toda verde; `tsc` e `eslint` sem erros.

- [ ] **Step 5: Browser check**

Com `pnpm run dev` (já rodando em http://localhost:3000):
- `/estoque`: 13 itens, Casquinha "60 un" com status ok, alerta "4 itens precisam de reposição".
- `/pdv` (ou a rota atual do caixa): botões Copo 300 ml R$ 14,90, Pote de sorvete 1 L R$ 29,90, Picolé cremoso R$ 6,50; açaí a R$ 39,90/kg; os 6 complementos com os mesmos preços.
Expected: iguais a antes, exceto a Casquinha no estoque.

- [ ] **Step 6: Commit**

```bash
git add apps/web/front/features/catalog apps/web/front/features/pos/pos-mocks.ts apps/web/front/features/pos/pdv-experience.tsx apps/web/front/features/inventory
git commit -m "feat(catalogo): caixa e estoque leem o catálogo único"
```

Atenção: `pdv-experience.tsx` tem uma mudança anterior não commitada (link "Início" da home). `git add -p` é interativo e não está disponível; em vez disso, gere um patch só com os hunks deste plano (`git diff apps/web/front/features/pos/pdv-experience.tsx > p.diff`, remova os hunks do link "Início", `git apply --cached p.diff`), confira com `git diff --cached`, e registre no ledger o que foi feito.
