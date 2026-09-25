# Tela Cardápio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tela `/configuracoes/cardapio` para editar e cadastrar produtos, complementos e embalagens, com o catálogo salvo no navegador e lido pelo caixa e pelo estoque.

**Architecture:** O domínio (`back/domain/catalog`) ganha `active`, três regras novas e edições puras que sempre revalidam. Um store (`front/features/catalog/catalog-store.ts`) guarda o catálogo no `localStorage` e o expõe via `useSyncExternalStore`. Caixa, estoque e a tela nova leem esse store.

**Tech Stack:** TypeScript, Next.js 15 / React 19, radix-ui Dialog, lucide-react, Tailwind v4 (tokens `brand-*`), Vitest + Testing Library (jsdom). Comandos rodam em `apps/web`.

**Spec:** `docs/superpowers/specs/2026-09-25-cardapio-editor-design.md`

## Global Constraints

- `back/domain/**` não importa `next`, `react` nem `firebase-admin`.
- Mensagens exatamente como na spec, em português.
- Todo acesso a `localStorage` dentro de `try/catch`.
- Números digitados passam por `parseQuantity` (`back/domain/inventory/inventory.ts`).
- Telas claras usam `.theme-light` na raiz e no `Dialog.Content`; foco com `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary`; hover dos botões secundários `hover:border-brand-primary hover:bg-brand-surface-muted hover:text-brand-primary`.
- Sem pontos médios (`·`) como separador em texto de interface.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Nunca commitar `chefe.mp4`.

## Review Focus

1. **Hidratação**: servidor e primeira renderização do cliente mostram os valores de exemplo; depois o cliente troca pelos guardados sem erro de hidratação, e o estoque remonta com a lista guardada (`catalogKey` muda sem nenhuma gravação). Coberto pelo teste de `catalogKey` e pela checagem no navegador (Task 7).
2. **`localStorage` corrompido ou com formato errado** (`"{nope"`, `{ "products": 1 }`, preço `"40"` como texto): o app usa os valores de exemplo e não apaga o que está guardado (teste na Task 4).
3. **Vírgula e campos vazios no formulário**: "39,90" salva 39.9; preço vazio mostra "O preço precisa ser maior que zero." e não salva (testes na Task 7).
4. **Desativar embalagem usada por produto ativo**: recusado com a mensagem da regra 12, com o painel aberto (teste de domínio na Task 3).
5. **Id novo que colide com um id de outra lista**: embalagem nova "Copo" com item de estoque `copo` já existente vira `copo-2` nas duas listas (teste na Task 3).

---

### Task 1: Commitar o trabalho pendente da home

O estoque e esta tela dependem de `front/features/home/brand-mark.tsx` e de `app/configuracoes/page.tsx`, que existem só no diretório de trabalho. Sem isso a branch não compila num clone limpo.

**Files:** os arquivos não commitados da home: `apps/web/.env.local.example`, `apps/web/app/dashboard/page.tsx`, `apps/web/front/features/pos/pdv-experience.tsx` (link "Início"), `apps/web/app/configuracoes/`, `apps/web/app/relatorios/`, `apps/web/back/actions/dev-preview-user.ts`, `apps/web/back/actions/dev-preview-user.test.ts`, `apps/web/front/features/home/`.

- [ ] **Step 1: Verificar a suíte com o trabalho da home**

Run: `pnpm test:unit && pnpm typecheck && pnpm lint`
Expected: suíte verde, `tsc` e `eslint` sem erros.

- [ ] **Step 2: Commit**

```bash
git add apps/web/.env.local.example apps/web/app/dashboard/page.tsx apps/web/front/features/pos/pdv-experience.tsx apps/web/app/configuracoes apps/web/app/relatorios apps/web/back/actions/dev-preview-user.ts apps/web/back/actions/dev-preview-user.test.ts apps/web/front/features/home
git status --short   # Expected: só "?? chefe.mp4"
git commit -m "feat(home): tela inicial com atalhos, telas em breve e acesso local sem login"
```

---

### Task 2: `active`, regras 11–13 e leitores de ativos

**Files:**
- Modify: `apps/web/back/domain/catalog/catalog.ts`
- Modify: `apps/web/back/domain/catalog/catalog.test.ts`
- Modify: `apps/web/front/features/catalog/catalog-mocks.ts`

**Interfaces:**
- Produces: `active: boolean` em `Packaging`, `Complement` e em todo `SaleProduct`; `activeComplements(catalog: Catalog): Complement[]`; `unitProducts` só ativos.

- [ ] **Step 1: Write the failing test**

Em `catalog.test.ts`, troque o import:

```ts
import { activeComplements, unitProducts, validateCatalog, weighedProduct, type Catalog, type SaleProduct, type UnitProduct } from "./catalog";
```

Em `validCatalog()`, acrescente `active: true` na embalagem, no complemento e nos três produtos:

```ts
    packagings: [{ id: "copo", name: "Copo", stockItemId: "copo", tareKg: 0.01, active: true }],
    complements: [{ id: "granola", name: "Granola", extraPrice: 2.5, stockItemId: "granola", active: true }],
    products: [
      { kind: "peso", id: "acai", name: "Açaí", active: true, pricePerKg: 40, packagingIds: ["copo"], consumesPerKg: [{ itemId: "polpa", quantity: 0.8 }] },
      { kind: "pronto", id: "pronto", name: "Pronto", active: true, price: 15, packagingId: "copo", includedComplements: 3, consumes: [{ itemId: "polpa", quantity: 0.35 }] },
      { kind: "unidade", id: "avulso", name: "Copo avulso", active: true, price: 10, consumes: [{ itemId: "copo", quantity: 1 }] },
    ],
```

No teste "unitProducts keeps only unit products, in catalog order", o produto `second` ganha `active: true`:

```ts
    const second: UnitProduct = { kind: "unidade", id: "picole", name: "Picolé", active: true, price: 6.5, consumes: [] };
```

Acrescente ao `describe("validateCatalog")`:

```ts
  it("rejects a blank name", () => {
    const catalog = validCatalog();
    expect(validateCatalog({ ...catalog, packagings: [{ ...catalog.packagings[0], name: "  " }] })).toContainEqual({
      path: "packagings[copo]",
      message: "Informe o nome.",
    });
    expect(validateCatalog(withProduct("avulso", { name: "" }))).toContainEqual({ path: "products[avulso]", message: "Informe o nome." });
  });

  it("rejects an active product using a disabled packaging, but not a disabled product", () => {
    const catalog = validCatalog();
    const disabledCopo = { ...catalog, packagings: [{ ...catalog.packagings[0], active: false }] };
    const errors = validateCatalog(disabledCopo);
    expect(errors).toContainEqual({ path: "products[pronto].packagingId", message: "A embalagem Copo está desativada." });
    expect(errors).toContainEqual({ path: "products[acai].packagingIds", message: "A embalagem Copo está desativada." });

    const inactivePronto = { ...disabledCopo, products: disabledCopo.products.map((product) => (product.id === "pronto" ? { ...product, active: false } : product)) };
    expect(validateCatalog(inactivePronto)).not.toContainEqual(expect.objectContaining({ path: "products[pronto].packagingId" }));
  });

  it("requires exactly one active weighed product", () => {
    const message = "O catálogo precisa de um açaí por peso ativo.";
    const catalog = validCatalog();
    expect(validateCatalog(withProduct("acai", { active: false }))).toContainEqual({ path: "products", message });
    expect(validateCatalog({ ...catalog, products: catalog.products.filter((product) => product.kind !== "peso") })).toContainEqual({ path: "products", message });
    const twoWeighed = { ...catalog, products: [...catalog.products, { ...catalog.products[0], id: "acai-2" } as SaleProduct] };
    expect(validateCatalog(twoWeighed)).toContainEqual({ path: "products", message });
  });
```

Acrescente ao `describe("catalog readers")`:

```ts
  it("unitProducts skips disabled products", () => {
    expect(unitProducts(withProduct("avulso", { active: false }))).toEqual([]);
  });

  it("activeComplements keeps only active complements, in catalog order", () => {
    const catalog = validCatalog();
    const disabled = { id: "banana", name: "Banana", extraPrice: 2, stockItemId: "granola", active: false };
    const mel = { id: "mel", name: "Mel", extraPrice: 1, stockItemId: "granola", active: true };
    expect(activeComplements({ ...catalog, complements: [...catalog.complements, disabled, mel] }).map((entry) => entry.id)).toEqual(["granola", "mel"]);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit -- back/domain/catalog`
Expected: FAIL — `activeComplements is not a function` (ou export ausente) e as regras novas sem erro.

- [ ] **Step 3: Write minimal implementation**

Em `catalog.ts`:

```ts
export type Packaging = { id: string; name: string; stockItemId: string; tareKg: number; active: boolean };
```

```ts
export type Complement = { id: string; name: string; extraPrice: number; stockItemId: string; active: boolean };
```

```ts
type ProductBase = { id: string; name: string; active: boolean };
```

Em `validateCatalog`, logo depois do laço de ids repetidos, acrescente o laço de nomes:

```ts
  for (const [name, list] of lists) {
    for (const entry of list) {
      if (entry.name.trim() === "") report(`${name}[${entry.id}]`, "Informe o nome.");
    }
  }
```

Troque `const packagingIds = new Set(catalog.packagings.map((packaging) => packaging.id));` por:

```ts
  const packagings = new Map(catalog.packagings.map((packaging) => [packaging.id, packaging]));
```

Troque `checkPackaging` por:

```ts
  function checkPackaging(path: string, id: string, productActive: boolean) {
    const packaging = packagings.get(id);
    if (!packaging) report(path, `Embalagem não encontrada: ${id}.`);
    else if (productActive && !packaging.active) report(path, `A embalagem ${packaging.name} está desativada.`);
  }
```

Nas chamadas, passe `product.active`:

```ts
        for (const id of product.packagingIds) checkPackaging(`${path}.packagingIds`, id, product.active);
```

```ts
        checkPackaging(`${path}.packagingId`, product.packagingId, product.active);
```

Antes de `return errors;`:

```ts
  const weighed = catalog.products.filter((product) => product.kind === "peso");
  if (weighed.length !== 1 || !weighed[0].active) report("products", "O catálogo precisa de um açaí por peso ativo.");
```

Troque `unitProducts` e acrescente `activeComplements`:

```ts
export function unitProducts(catalog: Catalog): UnitProduct[] {
  return catalog.products.filter((product): product is UnitProduct => product.kind === "unidade" && product.active);
}

export function activeComplements(catalog: Catalog): Complement[] {
  return catalog.complements.filter((complement) => complement.active);
}
```

Em `catalog-mocks.ts`, acrescente `active: true` em cada uma das 3 embalagens, dos 6 complementos e dos 5 produtos (logo depois de `name`), por exemplo:

```ts
    { id: "copo-300", name: "Copo 300 ml", active: true, stockItemId: "copo-300", tareKg: 0.012 },
```

```ts
    { id: "banana", name: "Banana", active: true, extraPrice: 2, stockItemId: "banana" },
```

```ts
    { kind: "unidade", id: "picole", name: "Picolé cremoso", active: true, price: 6.5, consumes: [{ itemId: "picole", quantity: 1 }] },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:unit && pnpm typecheck`
Expected: suíte verde (incluindo `catalog-mocks.test.ts`), `tsc` sem erros.

- [ ] **Step 5: Commit**

```bash
git add apps/web/back/domain/catalog apps/web/front/features/catalog/catalog-mocks.ts
git commit -m "feat(catalogo): produtos, complementos e embalagens podem ser desativados"
```

---

### Task 3: Edições puras do catálogo

**Files:**
- Create: `apps/web/back/domain/catalog/catalog-edits.ts`
- Test: `apps/web/back/domain/catalog/catalog-edits.test.ts`

**Interfaces:**
- Consumes: `Catalog`, `CatalogError`, `Complement`, `Packaging`, `SaleProduct`, `UnitProduct`, `validateCatalog` (Task 2); `InventoryItem`, `InventoryUnit`.
- Produces: `EditResult`, `slugId(name, existingIds)`, `saveProduct(catalog, draft, { trackStock? })`, `saveComplement(catalog, draft, { stockUnit? })`, `savePackaging(catalog, draft)`, `setActive(catalog, list, id, active)`. Registro novo = `id: ""`; embalagem/complemento novos usam `stockItemId: ""`.

- [ ] **Step 1: Write the failing test**

`apps/web/back/domain/catalog/catalog-edits.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Catalog, ReadyCupProduct, UnitProduct } from "./catalog";
import { saveComplement, savePackaging, saveProduct, setActive, slugId, type EditResult } from "./catalog-edits";

function baseCatalog(): Catalog {
  return {
    stockItems: [
      { id: "polpa", name: "Polpa", category: "insumo", unit: "kg", balance: 1, minimum: 1 },
      { id: "copo", name: "Copo", category: "insumo", unit: "un", balance: 10, minimum: 1 },
      { id: "granola", name: "Granola", category: "insumo", unit: "kg", balance: 1, minimum: 1 },
    ],
    packagings: [{ id: "copo", name: "Copo", active: true, stockItemId: "copo", tareKg: 0.01 }],
    complements: [{ id: "granola", name: "Granola", active: true, extraPrice: 2.5, stockItemId: "granola" }],
    products: [
      { kind: "peso", id: "acai", name: "Açaí", active: true, pricePerKg: 40, packagingIds: ["copo"], consumesPerKg: [{ itemId: "polpa", quantity: 0.8 }] },
      { kind: "unidade", id: "avulso", name: "Copo avulso", active: true, price: 10, consumes: [{ itemId: "copo", quantity: 1 }] },
    ],
  };
}

function expectOk(result: EditResult): Catalog {
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result.errors)}`);
  return result.catalog;
}

describe("slugId", () => {
  it("builds a readable id and avoids the ones already taken", () => {
    expect(slugId("Copo 700 ml", [])).toBe("copo-700-ml");
    expect(slugId(" Açaí Grande! ", [])).toBe("acai-grande");
    expect(slugId("Copo", ["copo", "copo-2"])).toBe("copo-3");
    expect(slugId("  !!  ", [])).toBe("item");
  });
});

describe("saveProduct", () => {
  it("appends a new ready cup with a generated id and a trimmed name", () => {
    const draft: ReadyCupProduct = { kind: "pronto", id: "", name: " Copo pronto 700 ml ", active: true, price: 20, packagingId: "copo", includedComplements: 4, consumes: [] };
    const catalog = expectOk(saveProduct(baseCatalog(), draft));
    expect(catalog.products.map((product) => product.id)).toEqual(["acai", "avulso", "copo-pronto-700-ml"]);
    expect(catalog.products[2].name).toBe("Copo pronto 700 ml");
  });

  it("creates a stock item for a new unit product when asked to track its stock", () => {
    const draft: UnitProduct = { kind: "unidade", id: "", name: "Picolé de uva", active: true, price: 7, consumes: [] };
    const catalog = expectOk(saveProduct(baseCatalog(), draft, { trackStock: true }));
    expect(catalog.stockItems).toContainEqual({ id: "picole-de-uva", name: "Picolé de uva", category: "produto", unit: "un", balance: 0, minimum: 0 });
    expect(catalog.products.find((product) => product.id === "picole-de-uva")).toMatchObject({ consumes: [{ itemId: "picole-de-uva", quantity: 1 }] });
  });

  it("does not create a stock item when stock tracking is off", () => {
    const draft: UnitProduct = { kind: "unidade", id: "", name: "Água", active: true, price: 3, consumes: [] };
    expect(expectOk(saveProduct(baseCatalog(), draft)).stockItems).toHaveLength(3);
  });

  it("refuses a second product sold by weight", () => {
    const draft = { ...baseCatalog().products[0], id: "" };
    expect(saveProduct(baseCatalog(), draft)).toEqual({ ok: false, errors: [{ path: "products", message: "Só pode existir um açaí por peso." }] });
  });

  it("refuses to change the kind of an existing product", () => {
    const draft: ReadyCupProduct = { kind: "pronto", id: "avulso", name: "Copo avulso", active: true, price: 10, packagingId: "copo", includedComplements: 1, consumes: [] };
    expect(saveProduct(baseCatalog(), draft)).toEqual({ ok: false, errors: [{ path: "products[avulso]", message: "O tipo do produto não pode mudar." }] });
  });

  it("replaces an existing product in place", () => {
    const base = baseCatalog();
    const catalog = expectOk(saveProduct(base, { ...(base.products[1] as UnitProduct), price: 12 }));
    expect(catalog.products.map((product) => product.id)).toEqual(["acai", "avulso"]);
    expect(catalog.products[1]).toMatchObject({ price: 12 });
  });

  it("returns the errors and leaves the catalog untouched when the edit is invalid", () => {
    const base = baseCatalog();
    const result = saveProduct(base, { ...base.products[0], pricePerKg: 0 } as typeof base.products[0]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContainEqual({ path: "products[acai]", message: "O preço precisa ser maior que zero." });
    expect(base.products[0]).toMatchObject({ pricePerKg: 40 });
  });
});

describe("saveComplement", () => {
  it("creates the stock item of a new complement with the chosen unit", () => {
    const catalog = expectOk(saveComplement(baseCatalog(), { id: "", name: "Mel", active: true, extraPrice: 1.5, stockItemId: "" }, { stockUnit: "L" }));
    expect(catalog.complements.at(-1)).toEqual({ id: "mel", name: "Mel", active: true, extraPrice: 1.5, stockItemId: "mel" });
    expect(catalog.stockItems).toContainEqual({ id: "mel", name: "Mel", category: "insumo", unit: "L", balance: 0, minimum: 0 });
  });

  it("uses kg for the stock item when no unit is chosen", () => {
    const catalog = expectOk(saveComplement(baseCatalog(), { id: "", name: "Aveia", active: true, extraPrice: 1, stockItemId: "" }));
    expect(catalog.stockItems.find((item) => item.id === "aveia")?.unit).toBe("kg");
  });

  it("renames a complement without renaming its stock item", () => {
    const base = baseCatalog();
    const catalog = expectOk(saveComplement(base, { ...base.complements[0], name: "Granola crocante" }));
    expect(catalog.complements[0].name).toBe("Granola crocante");
    expect(catalog.stockItems.find((item) => item.id === "granola")?.name).toBe("Granola");
  });

  it("refuses a new complement without a name", () => {
    const result = saveComplement(baseCatalog(), { id: "", name: "  ", active: true, extraPrice: 1, stockItemId: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContainEqual(expect.objectContaining({ message: "Informe o nome." }));
  });
});

describe("savePackaging", () => {
  it("creates a stock item counted in units for a new packaging", () => {
    const catalog = expectOk(savePackaging(baseCatalog(), { id: "", name: "Copo 700 ml", active: true, stockItemId: "", tareKg: 0.02 }));
    expect(catalog.packagings.at(-1)).toEqual({ id: "copo-700-ml", name: "Copo 700 ml", active: true, stockItemId: "copo-700-ml", tareKg: 0.02 });
    expect(catalog.stockItems).toContainEqual({ id: "copo-700-ml", name: "Copo 700 ml", category: "insumo", unit: "un", balance: 0, minimum: 0 });
  });

  it("gives the new packaging and its stock item ids that are free in each list", () => {
    const catalog = expectOk(savePackaging(baseCatalog(), { id: "", name: "Copo", active: true, stockItemId: "", tareKg: 0.01 }));
    expect(catalog.packagings.at(-1)).toMatchObject({ id: "copo-2", stockItemId: "copo-2" });
  });
});

describe("setActive", () => {
  it("refuses to disable the product sold by weight", () => {
    const result = setActive(baseCatalog(), "products", "acai", false);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContainEqual({ path: "products", message: "O catálogo precisa de um açaí por peso ativo." });
  });

  it("refuses to disable a packaging an active product still uses", () => {
    const result = setActive(baseCatalog(), "packagings", "copo", false);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContainEqual({ path: "products[acai].packagingIds", message: "A embalagem Copo está desativada." });
  });

  it("disables a complement", () => {
    expect(expectOk(setActive(baseCatalog(), "complements", "granola", false)).complements[0].active).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit -- back/domain/catalog`
Expected: FAIL — `Failed to resolve import "./catalog-edits"`.

- [ ] **Step 3: Write minimal implementation**

`apps/web/back/domain/catalog/catalog-edits.ts`:

```ts
import type { InventoryCategory, InventoryItem, InventoryUnit } from "../inventory/inventory";
import { validateCatalog, type Catalog, type CatalogError, type Complement, type Packaging, type SaleProduct, type UnitProduct } from "./catalog";

export type EditResult = { ok: true; catalog: Catalog } | { ok: false; errors: CatalogError[] };

/** "Copo 700 ml" → "copo-700-ml"; adds -2, -3… when the id is taken. */
export function slugId(name: string, existingIds: Iterable<string>): string {
  const taken = new Set(existingIds);
  const base =
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "item";
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

function finish(catalog: Catalog): EditResult {
  const errors = validateCatalog(catalog);
  return errors.length === 0 ? { ok: true, catalog } : { ok: false, errors };
}

function fail(path: string, message: string): EditResult {
  return { ok: false, errors: [{ path, message }] };
}

function ids(list: readonly { id: string }[]): string[] {
  return list.map((entry) => entry.id);
}

function replaceById<T extends { id: string }>(list: readonly T[], entry: T): T[] {
  return list.map((current) => (current.id === entry.id ? entry : current));
}

function newStockItem(catalog: Catalog, name: string, category: InventoryCategory, unit: InventoryUnit): InventoryItem {
  return { id: slugId(name, ids(catalog.stockItems)), name, category, unit, balance: 0, minimum: 0 };
}

export function saveProduct(catalog: Catalog, draft: SaleProduct, options: { trackStock?: boolean } = {}): EditResult {
  const name = draft.name.trim();
  if (draft.id === "") {
    if (draft.kind === "peso") return fail("products", "Só pode existir um açaí por peso.");
    const id = slugId(name, ids(catalog.products));
    if (draft.kind === "unidade" && options.trackStock) {
      const item = newStockItem(catalog, name, "produto", "un");
      const product: UnitProduct = { ...draft, id, name, consumes: [{ itemId: item.id, quantity: 1 }, ...draft.consumes] };
      return finish({ ...catalog, stockItems: [...catalog.stockItems, item], products: [...catalog.products, product] });
    }
    return finish({ ...catalog, products: [...catalog.products, { ...draft, id, name }] });
  }

  const existing = catalog.products.find((product) => product.id === draft.id);
  if (!existing) return fail(`products[${draft.id}]`, `Produto não encontrado: ${draft.id}.`);
  if (existing.kind !== draft.kind) return fail(`products[${draft.id}]`, "O tipo do produto não pode mudar.");
  return finish({ ...catalog, products: replaceById(catalog.products, { ...draft, name }) });
}

export function saveComplement(catalog: Catalog, draft: Complement, options: { stockUnit?: InventoryUnit } = {}): EditResult {
  const name = draft.name.trim();
  if (draft.id === "") {
    const item = newStockItem(catalog, name, "insumo", options.stockUnit ?? "kg");
    const complement: Complement = { ...draft, id: slugId(name, ids(catalog.complements)), name, stockItemId: item.id };
    return finish({ ...catalog, stockItems: [...catalog.stockItems, item], complements: [...catalog.complements, complement] });
  }
  if (!catalog.complements.some((complement) => complement.id === draft.id)) {
    return fail(`complements[${draft.id}]`, `Complemento não encontrado: ${draft.id}.`);
  }
  return finish({ ...catalog, complements: replaceById(catalog.complements, { ...draft, name }) });
}

export function savePackaging(catalog: Catalog, draft: Packaging): EditResult {
  const name = draft.name.trim();
  if (draft.id === "") {
    const item = newStockItem(catalog, name, "insumo", "un");
    const packaging: Packaging = { ...draft, id: slugId(name, ids(catalog.packagings)), name, stockItemId: item.id };
    return finish({ ...catalog, stockItems: [...catalog.stockItems, item], packagings: [...catalog.packagings, packaging] });
  }
  if (!catalog.packagings.some((packaging) => packaging.id === draft.id)) {
    return fail(`packagings[${draft.id}]`, `Embalagem não encontrada: ${draft.id}.`);
  }
  return finish({ ...catalog, packagings: replaceById(catalog.packagings, { ...draft, name }) });
}

export function setActive(catalog: Catalog, list: "products" | "complements" | "packagings", id: string, active: boolean): EditResult {
  const entries: readonly { id: string; active: boolean }[] = catalog[list];
  if (!entries.some((entry) => entry.id === id)) return fail(`${list}[${id}]`, `Registro não encontrado: ${id}.`);
  return finish({ ...catalog, [list]: entries.map((entry) => (entry.id === id ? { ...entry, active } : entry)) } as Catalog);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:unit -- back/domain/catalog && pnpm typecheck`
Expected: PASS (todos os testes de `catalog-edits.test.ts`), `tsc` sem erros.

- [ ] **Step 5: Commit**

```bash
git add apps/web/back/domain/catalog/catalog-edits.ts apps/web/back/domain/catalog/catalog-edits.test.ts
git commit -m "feat(catalogo): edições do catálogo com id automático e itens de estoque criados junto"
```

---

### Task 4: Store do catálogo no navegador

**Files:**
- Create: `apps/web/front/features/catalog/catalog-store.ts`
- Test: `apps/web/front/features/catalog/catalog-store.test.tsx`
- Modify: `apps/web/vitest.setup.ts`

**Interfaces:**
- Consumes: `validateCatalog`, `Catalog`; `CATALOG`.
- Produces: `CATALOG_STORAGE_KEY`, `loadCatalog(): Catalog`, `saveCatalog(next: Catalog): void`, `resetCatalog(): void`, `useCatalog(): Catalog`, `catalogKey(catalog: Catalog): number`.

- [ ] **Step 1: Write the failing test**

`apps/web/front/features/catalog/catalog-store.test.tsx`:

```tsx
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Catalog } from "@/back/domain/catalog/catalog";
import { CATALOG } from "./catalog-mocks";
import { CATALOG_STORAGE_KEY, catalogKey, loadCatalog, resetCatalog, saveCatalog, useCatalog } from "./catalog-store";

afterEach(cleanup);

function withAcaiPrice(pricePerKg: number): Catalog {
  return { ...CATALOG, products: CATALOG.products.map((product) => (product.kind === "peso" ? { ...product, pricePerKg } : product)) };
}

function AcaiPrice() {
  const catalog = useCatalog();
  const weighed = catalog.products.find((product) => product.kind === "peso");
  return <p>{weighed?.kind === "peso" ? `preço ${weighed.pricePerKg}` : "sem açaí"}</p>;
}

describe("catalog store", () => {
  it("uses the sample catalog when nothing is stored", () => {
    expect(loadCatalog()).toBe(CATALOG);
  });

  it("uses the sample catalog when the stored value is corrupt, without deleting it", () => {
    localStorage.setItem(CATALOG_STORAGE_KEY, "{nope");
    expect(loadCatalog()).toBe(CATALOG);
    localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify({ products: 1 }));
    expect(loadCatalog()).toBe(CATALOG);
    expect(localStorage.getItem(CATALOG_STORAGE_KEY)).toBe(JSON.stringify({ products: 1 }));
  });

  it("uses the sample catalog when the stored catalog breaks a rule", () => {
    localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(withAcaiPrice(0)));
    expect(loadCatalog()).toBe(CATALOG);
    const textPrice = { ...CATALOG, products: CATALOG.products.map((product) => (product.kind === "peso" ? { ...product, pricePerKg: "40" } : product)) };
    localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(textPrice));
    expect(loadCatalog()).toBe(CATALOG);
  });

  it("persists a saved catalog", () => {
    saveCatalog(withAcaiPrice(45));
    expect(loadCatalog()).toEqual(withAcaiPrice(45));
  });

  it("reset removes the saved catalog", () => {
    saveCatalog(withAcaiPrice(45));
    resetCatalog();
    expect(localStorage.getItem(CATALOG_STORAGE_KEY)).toBeNull();
    expect(loadCatalog()).toBe(CATALOG);
  });

  it("re-renders readers after a save and after a change in another tab", () => {
    render(<AcaiPrice />);
    expect(screen.getByText("preço 39.9")).toBeInTheDocument();

    act(() => saveCatalog(withAcaiPrice(45)));
    expect(screen.getByText("preço 45")).toBeInTheDocument();

    localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(withAcaiPrice(50)));
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: CATALOG_STORAGE_KEY }));
    });
    expect(screen.getByText("preço 50")).toBeInTheDocument();
  });

  it("gives each catalog object a stable key", () => {
    const sample = catalogKey(CATALOG);
    expect(catalogKey(CATALOG)).toBe(sample);
    expect(catalogKey(withAcaiPrice(45))).not.toBe(sample);
  });
});
```

Em `apps/web/vitest.setup.ts`, o arquivo inteiro fica:

```ts
import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';
import { resetCatalog } from './front/features/catalog/catalog-store';

// Every test starts from the sample catalog with nothing saved in the browser.
beforeEach(() => {
  if (typeof window !== 'undefined') window.localStorage.clear();
  resetCatalog();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit`
Expected: FAIL — `Failed to resolve import "./front/features/catalog/catalog-store"` (o setup quebra todas as suítes).

- [ ] **Step 3: Write minimal implementation**

`apps/web/front/features/catalog/catalog-store.ts`:

```ts
import { useSyncExternalStore } from "react";
import { validateCatalog, type Catalog } from "@/back/domain/catalog/catalog";
import { CATALOG } from "./catalog-mocks";

export const CATALOG_STORAGE_KEY = "nextfood:catalog:v1";

const listeners = new Set<() => void>();
let snapshot: Catalog | null = null;

/** The saved catalog, or the sample one when nothing valid is saved. Never overwrites what is stored. */
export function loadCatalog(): Catalog {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(CATALOG_STORAGE_KEY);
  } catch {
    return CATALOG;
  }
  if (raw === null) return CATALOG;
  try {
    const parsed = JSON.parse(raw) as Catalog;
    return validateCatalog(parsed).length === 0 ? parsed : CATALOG;
  } catch {
    // Corrupt JSON or a shape validateCatalog cannot walk.
    return CATALOG;
  }
}

function getSnapshot(): Catalog {
  snapshot ??= loadCatalog();
  return snapshot;
}

// The server never sees localStorage: it and the first client render show the sample catalog.
function getServerSnapshot(): Catalog {
  return CATALOG;
}

function publish(next: Catalog) {
  snapshot = next;
  for (const listener of listeners) listener();
}

function onStorage(event: StorageEvent) {
  if (event.key === CATALOG_STORAGE_KEY || event.key === null) publish(loadCatalog());
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

/** Only call with a catalog that already passed validation (an ok EditResult). */
export function saveCatalog(next: Catalog) {
  try {
    window.localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable (private mode, blocked): keep the change in memory only.
  }
  publish(next);
}

export function resetCatalog() {
  try {
    window.localStorage.removeItem(CATALOG_STORAGE_KEY);
  } catch {
    // Storage unavailable: there is nothing saved to remove.
  }
  publish(CATALOG);
}

export function useCatalog(): Catalog {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

const keys = new WeakMap<Catalog, number>();
let nextKey = 0;

/** Stable number per catalog object; as a React key it remounts a screen when the catalog is replaced. */
export function catalogKey(catalog: Catalog): number {
  let key = keys.get(catalog);
  if (key === undefined) {
    key = nextKey++;
    keys.set(catalog, key);
  }
  return key;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:unit && pnpm typecheck && pnpm lint`
Expected: suíte verde (incluindo `back/architecture.test.ts`, que roda em ambiente node), `tsc` e `eslint` sem erros.

- [ ] **Step 5: Commit**

```bash
git add apps/web/front/features/catalog/catalog-store.ts apps/web/front/features/catalog/catalog-store.test.tsx apps/web/vitest.setup.ts
git commit -m "feat(catalogo): catálogo salvo no navegador e compartilhado entre as telas"
```

---

### Task 5: Caixa e estoque leem o store

**Files:**
- Modify: `apps/web/front/features/pos/pdv-experience.tsx`
- Modify: `apps/web/front/features/pos/pdv-experience.test.tsx`
- Create: `apps/web/front/features/inventory/inventory-screen.tsx`
- Test: `apps/web/front/features/inventory/inventory-screen.test.tsx`
- Modify: `apps/web/app/estoque/page.tsx`

**Interfaces:**
- Consumes: `useCatalog`, `saveCatalog`, `catalogKey` (Task 4); `unitProducts`, `activeComplements`, `weighedProduct`, `UnitProduct` (Task 2).
- Produces: `InventoryScreen()`.

- [ ] **Step 1: Write the failing test**

Em `pdv-experience.test.tsx`, acrescente aos imports:

```ts
import { CATALOG } from "@/front/features/catalog/catalog-mocks";
import { saveCatalog } from "@/front/features/catalog/catalog-store";
```

e ao `describe("PdvExperience")`:

```ts
  it("sells with the prices saved in the Cardápio and hides disabled complements", () => {
    saveCatalog({
      ...CATALOG,
      products: CATALOG.products.map((product) => (product.kind === "unidade" && product.id === "copo-300" ? { ...product, price: 16.5 } : product)),
      complements: CATALOG.complements.map((complement) => (complement.id === "confete" ? { ...complement, active: false } : complement)),
    });
    render(<PdvExperience />);
    expect(screen.getByRole("button", { name: /Copo 300 ml.*R\$\s16,50/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adicionar Confete" })).not.toBeInTheDocument();
  });
```

`apps/web/front/features/inventory/inventory-screen.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CATALOG } from "@/front/features/catalog/catalog-mocks";
import { saveCatalog } from "@/front/features/catalog/catalog-store";
import { InventoryScreen } from "./inventory-screen";

afterEach(cleanup);

describe("InventoryScreen", () => {
  it("lists stock items created through the Cardápio", () => {
    saveCatalog({
      ...CATALOG,
      stockItems: [...CATALOG.stockItems, { id: "copo-700-ml", name: "Copo 700 ml", category: "insumo", unit: "un", balance: 0, minimum: 0 }],
    });
    render(<InventoryScreen />);
    expect(screen.getByRole("listitem", { name: "Copo 700 ml" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit -- front/features/pos front/features/inventory`
Expected: FAIL — o botão do Copo 300 ml ainda mostra R$ 14,90, e `Failed to resolve import "./inventory-screen"`.

- [ ] **Step 3: Write minimal implementation**

Em `pdv-experience.tsx`, troque os dois imports do catálogo:

```ts
import { unitProducts, weighedProduct } from "@/back/domain/catalog/catalog";
import { CATALOG } from "@/front/features/catalog/catalog-mocks";
```

por:

```ts
import { activeComplements, unitProducts, weighedProduct, type UnitProduct } from "@/back/domain/catalog/catalog";
import { useCatalog } from "@/front/features/catalog/catalog-store";
```

Apague as cinco linhas de módulo:

```ts
const UNIT_PRODUCTS = unitProducts(CATALOG);
const AÇAI_PRICE_PER_KG = weighedProduct(CATALOG).pricePerKg;
// Until the till adopts ready cups, a complement is still charged per portion at its extra price.
const AÇAI_COMPLEMENTS = CATALOG.complements.map((complement) => ({ id: complement.id, name: complement.name, price: complement.extraPrice }));
const AÇAÍ_COMPLEMENTS = AÇAI_COMPLEMENTS;
```

Logo depois de `export function PdvExperience() {`, acrescente:

```ts
  const catalog = useCatalog();
  const UNIT_PRODUCTS = useMemo(() => unitProducts(catalog), [catalog]);
  const AÇAI_PRICE_PER_KG = weighedProduct(catalog).pricePerKg;
  // Until the till adopts ready cups, a complement is still charged per portion at its extra price.
  const AÇAÍ_COMPLEMENTS = useMemo(
    () => activeComplements(catalog).map((complement) => ({ id: complement.id, name: complement.name, price: complement.extraPrice })),
    [catalog],
  );
```

Troque a lista de dependências de `activeComplementCounts` (única no arquivo):

```ts
  }, [cart, activeAcaiGroupId, needsGroupSelection]);
```

por:

```ts
  }, [AÇAÍ_COMPLEMENTS, cart, activeAcaiGroupId, needsGroupSelection]);
```

Troque `function addProduct(product: (typeof UNIT_PRODUCTS)[number])` por `function addProduct(product: UnitProduct)` e `function changeComplement(complement: (typeof AÇAI_COMPLEMENTS)[number], delta: number)` por `function changeComplement(complement: (typeof AÇAÍ_COMPLEMENTS)[number], delta: number)`.

`apps/web/front/features/inventory/inventory-screen.tsx`:

```tsx
"use client";

import { catalogKey, useCatalog } from "@/front/features/catalog/catalog-store";
import { InventoryExperience } from "./inventory-experience";

/** Remounts the stock screen when the saved catalog replaces the sample one (hydration or another tab). */
export function InventoryScreen() {
  const catalog = useCatalog();
  return <InventoryExperience key={catalogKey(catalog)} initialItems={catalog.stockItems} />;
}
```

`apps/web/app/estoque/page.tsx`:

```tsx
import { InventoryScreen } from "@/front/features/inventory/inventory-screen";

export default function EstoquePage() {
  return <InventoryScreen />;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:unit && pnpm typecheck && pnpm lint`
Expected: suíte verde, `tsc` e `eslint` sem erros.

- [ ] **Step 5: Commit**

```bash
git add apps/web/front/features/pos apps/web/front/features/inventory apps/web/app/estoque/page.tsx
git commit -m "feat(catalogo): caixa e estoque usam o catálogo salvo no navegador"
```

---

### Task 6: Página de Configurações

**Files:**
- Create: `apps/web/front/features/settings/settings-hub.tsx`
- Test: `apps/web/front/features/settings/settings-hub.test.tsx`
- Modify: `apps/web/app/configuracoes/page.tsx`

**Interfaces:**
- Consumes: `BrandMark` de `@/front/features/home/brand-mark` (`{ subtitle: string }`).
- Produces: `SettingsHub()`.

- [ ] **Step 1: Write the failing test**

`apps/web/front/features/settings/settings-hub.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SettingsHub } from "./settings-hub";

afterEach(cleanup);

describe("SettingsHub", () => {
  it("links to the Cardápio and marks the other areas as coming soon", () => {
    render(<SettingsHub />);
    expect(screen.getByRole("heading", { name: "Configurações" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Cardápio/ })).toHaveAttribute("href", "/configuracoes/cardapio");
    expect(screen.queryByRole("link", { name: /Usuários/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Dados da loja/ })).not.toBeInTheDocument();
    expect(screen.getAllByText("Em breve")).toHaveLength(2);
    expect(screen.getByRole("link", { name: /Início/ })).toHaveAttribute("href", "/dashboard");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit -- front/features/settings`
Expected: FAIL — `Failed to resolve import "./settings-hub"`.

- [ ] **Step 3: Write minimal implementation**

`apps/web/front/features/settings/settings-hub.tsx`:

```tsx
import Link from "next/link";
import { ArrowRight, House, Store, UsersRound, UtensilsCrossed, type LucideIcon } from "lucide-react";
import { BrandMark } from "@/front/features/home/brand-mark";

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary";

type Area = { title: string; description: string; icon: LucideIcon; href?: string };

const AREAS: readonly Area[] = [
  { title: "Cardápio", description: "Preços, copos, complementos e embalagens.", icon: UtensilsCrossed, href: "/configuracoes/cardapio" },
  { title: "Usuários", description: "Quem acessa o sistema e o que cada pessoa pode fazer.", icon: UsersRound },
  { title: "Dados da loja", description: "Nome, CNPJ, endereço e dados fiscais.", icon: Store },
];

function AreaBody({ area }: { area: Area }) {
  const Icon = area.icon;
  return (
    <>
      <span className="grid size-12 place-items-center rounded-xl bg-brand-surface-muted text-brand-primary">
        <Icon className="size-6" strokeWidth={1.75} />
      </span>
      <span className="block">
        <span className="block font-serif text-xl font-semibold text-brand-plum-950">{area.title}</span>
        <span className="mt-1 block text-sm text-brand-text-soft">{area.description}</span>
      </span>
      {area.href ? (
        <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-brand-primary">
          Abrir <ArrowRight className="size-4" />
        </span>
      ) : (
        <span className="mt-auto inline-flex w-fit rounded-full bg-brand-surface-muted px-2.5 py-1 text-xs font-semibold text-brand-text-soft">Em breve</span>
      )}
    </>
  );
}

export function SettingsHub() {
  return (
    <main className="theme-light min-h-dvh bg-brand-surface px-3 py-3 text-brand-plum-900 sm:px-5">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-3 rounded-2xl border border-brand-border bg-brand-surface-card px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <BrandMark subtitle="Configurações" />
          <Link
            href="/dashboard"
            className={`inline-flex h-9 w-fit items-center gap-1.5 rounded-lg border border-brand-border bg-brand-surface-card px-3 text-sm font-medium text-brand-text-soft transition-colors hover:border-brand-primary hover:bg-brand-surface-muted hover:text-brand-primary ${focusRing}`}
          >
            <House className="size-4" /> Início
          </Link>
        </header>

        <h1 className="px-1 font-serif text-3xl font-semibold text-brand-plum-950">Configurações</h1>

        <ul aria-label="Áreas de configuração" className="grid gap-4 md:grid-cols-3">
          {AREAS.map((area) => (
            <li key={area.title}>
              {area.href ? (
                <Link
                  href={area.href}
                  className={`flex h-full min-h-48 flex-col gap-4 rounded-2xl border border-brand-border bg-brand-surface-card p-5 transition-colors hover:border-brand-primary hover:bg-brand-surface-muted ${focusRing}`}
                >
                  <AreaBody area={area} />
                </Link>
              ) : (
                <div className="flex h-full min-h-48 flex-col gap-4 rounded-2xl border border-dashed border-brand-border bg-brand-surface-card p-5 opacity-80">
                  <AreaBody area={area} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
```

`apps/web/app/configuracoes/page.tsx`:

```tsx
import { SettingsHub } from "@/front/features/settings/settings-hub";

export default function ConfiguracoesPage() {
  return <SettingsHub />;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:unit -- front/features/settings && pnpm typecheck`
Expected: PASS 1/1; `tsc` sem erros.

- [ ] **Step 5: Commit**

```bash
git add apps/web/front/features/settings apps/web/app/configuracoes/page.tsx
git commit -m "feat(configuracoes): página de configurações com acesso ao cardápio"
```

---

### Task 7: Tela Cardápio

**Files:**
- Create: `apps/web/front/features/catalog/catalog-edit-panel.tsx`
- Create: `apps/web/front/features/catalog/cardapio-editor.tsx`
- Test: `apps/web/front/features/catalog/cardapio-editor.test.tsx`
- Create: `apps/web/app/configuracoes/cardapio/page.tsx`

**Interfaces:**
- Consumes: `saveProduct`, `saveComplement`, `savePackaging` (Task 3); `useCatalog`, `saveCatalog`, `resetCatalog` (Task 4); `parseQuantity`; `BrandMark`.
- Produces: `CardapioEditor()`; `CatalogEditPanel({ open, onOpenChange, catalog, target, onSaved })`; `EditTarget = { list: "products" | "complements" | "packagings"; id: string | null }`.

- [ ] **Step 1: Write the failing test**

`apps/web/front/features/catalog/cardapio-editor.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CardapioEditor } from "./cardapio-editor";
import { CATALOG } from "./catalog-mocks";
import { loadCatalog } from "./catalog-store";

afterEach(cleanup);

function openEdit(name: string) {
  fireEvent.click(screen.getByRole("button", { name: `Editar ${name}` }));
  return screen.getByRole("dialog");
}

function save(dialog: HTMLElement) {
  fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
}

function row(name: string) {
  return screen.getByRole("listitem", { name });
}

describe("CardapioEditor", () => {
  it("edits the açaí price per kg, shows it in the list and saves it in the browser", () => {
    render(<CardapioEditor />);
    const dialog = openEdit("Açaí por peso");
    fireEvent.change(within(dialog).getByLabelText("Preço por kg (R$)"), { target: { value: "45,50" } });
    save(dialog);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(within(row("Açaí por peso")).getByText("R$ 45,50/kg")).toBeInTheDocument();
    expect(screen.getByText("Alterações salvas.")).toBeInTheDocument();
    expect(loadCatalog().products.find((product) => product.id === "acai-peso")).toMatchObject({ pricePerKg: 45.5 });
  });

  it("keeps the panel open with the message when the price is empty", () => {
    render(<CardapioEditor />);
    const dialog = openEdit("Copo 300 ml");
    fireEvent.change(within(dialog).getByLabelText("Preço (R$)"), { target: { value: "" } });
    save(dialog);

    expect(within(screen.getByRole("dialog")).getByText("O preço precisa ser maior que zero.")).toBeInTheDocument();
    expect(loadCatalog()).toBe(CATALOG);
  });

  it("reopens the panel clean after a failed save", () => {
    render(<CardapioEditor />);
    const failed = openEdit("Copo 300 ml");
    fireEvent.change(within(failed).getByLabelText("Preço (R$)"), { target: { value: "0" } });
    save(failed);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));

    const dialog = openEdit("Copo 300 ml");
    expect(within(dialog).queryByText("O preço precisa ser maior que zero.")).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText("Preço (R$)")).toHaveValue("14,90");
  });

  it("creates a ready cup with a stock consumption", () => {
    render(<CardapioEditor />);
    fireEvent.click(screen.getByRole("button", { name: "Novo produto" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("radio", { name: "Copo pronto" })).toBeChecked();
    fireEvent.change(within(dialog).getByLabelText("Nome"), { target: { value: "Copo pronto 700 ml" } });
    fireEvent.change(within(dialog).getByLabelText("Preço (R$)"), { target: { value: "20" } });
    fireEvent.change(within(dialog).getByLabelText("Complementos incluídos"), { target: { value: "4" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Adicionar consumo" }));
    fireEvent.change(within(dialog).getByLabelText("Quantidade (kg)"), { target: { value: "0,5" } });
    save(dialog);

    expect(row("Copo pronto 700 ml")).toBeInTheDocument();
    expect(loadCatalog().products.find((product) => product.id === "copo-pronto-700-ml")).toMatchObject({
      kind: "pronto",
      price: 20,
      includedComplements: 4,
      consumes: [{ itemId: "polpa-acai", quantity: 0.5 }],
    });
  });

  it("creates a packaging and its stock item", () => {
    render(<CardapioEditor />);
    fireEvent.click(screen.getByRole("tab", { name: "Embalagens" }));
    fireEvent.click(screen.getByRole("button", { name: "Nova embalagem" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Nome"), { target: { value: "Copo 700 ml" } });
    fireEvent.change(within(dialog).getByLabelText("Tara (g)"), { target: { value: "20" } });
    save(dialog);

    expect(within(screen.getByRole("list", { name: "Embalagens" })).getByRole("listitem", { name: "Copo 700 ml" })).toBeInTheDocument();
    expect(within(row("Copo 700 ml")).getByText("Tara 20 g")).toBeInTheDocument();
    expect(loadCatalog().stockItems.find((item) => item.id === "copo-700-ml")).toMatchObject({ unit: "un", balance: 0, minimum: 0 });
  });

  it("disables a complement and marks it in the list", () => {
    render(<CardapioEditor />);
    fireEvent.click(screen.getByRole("tab", { name: "Complementos" }));
    const dialog = openEdit("Confete");
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Ativo" }));
    save(dialog);

    expect(within(row("Confete")).getByText("Desativado")).toBeInTheDocument();
  });

  it("does not offer to disable the açaí sold by weight", () => {
    render(<CardapioEditor />);
    const dialog = openEdit("Açaí por peso");
    expect(within(dialog).queryByRole("checkbox", { name: "Ativo" })).not.toBeInTheDocument();
  });

  it("restores the sample values after confirming", () => {
    render(<CardapioEditor />);
    const dialog = openEdit("Açaí por peso");
    fireEvent.change(within(dialog).getByLabelText("Preço por kg (R$)"), { target: { value: "45" } });
    save(dialog);

    fireEvent.click(screen.getByRole("button", { name: "Restaurar valores de exemplo" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Restaurar" }));

    expect(within(row("Açaí por peso")).getByText("R$ 39,90/kg")).toBeInTheDocument();
    expect(loadCatalog()).toBe(CATALOG);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit -- front/features/catalog`
Expected: FAIL — `Failed to resolve import "./cardapio-editor"`.

- [ ] **Step 3: Write minimal implementation**

`apps/web/front/features/catalog/catalog-edit-panel.tsx`:

```tsx
"use client";

import { Dialog } from "radix-ui";
import { useState, type FormEvent, type ReactNode } from "react";
import type { Catalog, CatalogError, SaleProduct, StockUsage } from "@/back/domain/catalog/catalog";
import { saveComplement, savePackaging, saveProduct, type EditResult } from "@/back/domain/catalog/catalog-edits";
import { parseQuantity, type InventoryItem, type InventoryUnit } from "@/back/domain/inventory/inventory";

export type EditTarget = { list: "products" | "complements" | "packagings"; id: string | null };

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary";
const fieldClass = `h-10 w-full rounded-lg border border-brand-border bg-brand-surface-card px-3 text-sm text-brand-plum-900 ${focusRing}`;
const labelClass = "grid gap-1.5 text-sm font-medium text-brand-plum-900";
const secondaryButton = `h-9 rounded-lg border border-brand-border bg-brand-surface-card px-3 text-sm font-medium text-brand-text-soft transition-colors hover:border-brand-primary hover:bg-brand-surface-muted hover:text-brand-primary ${focusRing}`;

/** 39.9 → "39,90" (no thousands separator, so parseQuantity reads it back). */
export function moneyInput(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });
}

function quantityInput(value: number): string {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 3, useGrouping: false });
}

type UsageRow = { key: number; itemId: string; quantityRaw: string };
let rowSeq = 0;

function toRows(usages: readonly StockUsage[]): UsageRow[] {
  return usages.map((usage) => ({ key: rowSeq++, itemId: usage.itemId, quantityRaw: quantityInput(usage.quantity) }));
}

function toUsages(rows: readonly UsageRow[], items: readonly InventoryItem[]): StockUsage[] {
  const units = new Map(items.map((item) => [item.id, item.unit]));
  return rows.map((row) => ({ itemId: row.itemId, quantity: parseQuantity(row.quantityRaw, units.get(row.itemId)) }));
}

function StockUsageEditor({ legend, rows, onChange, items }: { legend: string; rows: UsageRow[]; onChange: (rows: UsageRow[]) => void; items: readonly InventoryItem[] }) {
  const update = (key: number, patch: Partial<UsageRow>) => onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  return (
    <fieldset className="grid gap-3">
      <legend className="text-sm font-medium text-brand-plum-900">{legend}</legend>
      {rows.map((row, index) => {
        const unit = items.find((item) => item.id === row.itemId)?.unit ?? "un";
        return (
          <div key={row.key} className="grid grid-cols-[1fr_7rem_auto] items-end gap-2">
            <label className={labelClass}>
              Item do estoque
              <select value={row.itemId} onChange={(event) => update(row.key, { itemId: event.target.value })} className={fieldClass}>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.unit})
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              {`Quantidade (${unit})`}
              <input inputMode="decimal" value={row.quantityRaw} onChange={(event) => update(row.key, { quantityRaw: event.target.value })} className={fieldClass} />
            </label>
            <button type="button" aria-label={`Remover consumo ${index + 1}`} onClick={() => onChange(rows.filter((entry) => entry.key !== row.key))} className={`${secondaryButton} h-10`}>
              Remover
            </button>
          </div>
        );
      })}
      <button
        type="button"
        disabled={items.length === 0}
        onClick={() => onChange([...rows, { key: rowSeq++, itemId: items[0].id, quantityRaw: "" }])}
        className={`${secondaryButton} w-fit disabled:opacity-50`}
      >
        Adicionar consumo
      </button>
    </fieldset>
  );
}

function ErrorList({ errors }: { errors: readonly CatalogError[] }) {
  const messages = [...new Set(errors.map((error) => error.message))];
  if (messages.length === 0) return null;
  return (
    <ul role="alert" className="grid gap-1 rounded-lg border border-brand-rose/40 bg-brand-surface-muted px-3 py-2 text-sm text-brand-rose">
      {messages.map((message) => (
        <li key={message}>{message}</li>
      ))}
    </ul>
  );
}

function FormShell({ onSubmit, errors, children }: { onSubmit: () => void; errors: readonly CatalogError[]; children: ReactNode }) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }
  return (
    <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-1 flex-col gap-5">
      {children}
      <ErrorList errors={errors} />
      <div className="mt-auto flex justify-end gap-2 pt-2">
        <Dialog.Close className={`${secondaryButton} h-10 px-4`}>Cancelar</Dialog.Close>
        <button type="submit" className={`h-10 rounded-lg bg-brand-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-primary-dark ${focusRing}`}>
          Salvar
        </button>
      </div>
    </form>
  );
}

function ActiveCheckbox({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-brand-plum-900">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-4 accent-brand-primary" />
      Ativo
    </label>
  );
}

type FormProps = { catalog: Catalog; id: string | null; onSaved: (catalog: Catalog) => void };

function useResult(onSaved: (catalog: Catalog) => void) {
  const [errors, setErrors] = useState<CatalogError[]>([]);
  return {
    errors,
    apply(result: EditResult) {
      if (result.ok) onSaved(result.catalog);
      else setErrors(result.errors);
    },
  };
}

const NEW_KINDS: readonly { value: "pronto" | "unidade"; label: string }[] = [
  { value: "pronto", label: "Copo pronto" },
  { value: "unidade", label: "Unidade" },
];

function ProductForm({ catalog, id, onSaved }: FormProps) {
  const existing = id ? catalog.products.find((product) => product.id === id) : undefined;
  const firstActivePackaging = catalog.packagings.find((packaging) => packaging.active)?.id ?? "";
  const [kind, setKind] = useState<SaleProduct["kind"]>(existing?.kind ?? "pronto");
  const [name, setName] = useState(existing?.name ?? "");
  const [active, setActive] = useState(existing?.active ?? true);
  const [priceRaw, setPriceRaw] = useState(existing ? moneyInput(existing.kind === "peso" ? existing.pricePerKg : existing.price) : "");
  const [packagingIds, setPackagingIds] = useState<string[]>(existing?.kind === "peso" ? existing.packagingIds : []);
  const [packagingId, setPackagingId] = useState(existing?.kind === "pronto" ? existing.packagingId : firstActivePackaging);
  const [includedRaw, setIncludedRaw] = useState(existing?.kind === "pronto" ? String(existing.includedComplements) : "3");
  const [rows, setRows] = useState<UsageRow[]>(() => toRows(existing ? (existing.kind === "peso" ? existing.consumesPerKg : existing.consumes) : []));
  const [trackStock, setTrackStock] = useState(true);
  const { errors, apply } = useResult(onSaved);

  const usageItems = kind === "peso" ? catalog.stockItems.filter((item) => item.unit !== "un") : catalog.stockItems;
  const selectablePackagings = catalog.packagings.filter((packaging) => packaging.active || packaging.id === packagingId || packagingIds.includes(packaging.id));

  function submit() {
    const price = parseQuantity(priceRaw);
    const usages = toUsages(rows, catalog.stockItems);
    const base = { id: existing?.id ?? "", name, active };
    const draft: SaleProduct =
      kind === "peso"
        ? { ...base, kind, pricePerKg: price, packagingIds, consumesPerKg: usages }
        : kind === "pronto"
          ? { ...base, kind, price, packagingId, includedComplements: parseQuantity(includedRaw), consumes: usages }
          : { ...base, kind, price, consumes: usages };
    apply(saveProduct(catalog, draft, { trackStock: !existing && kind === "unidade" && trackStock }));
  }

  return (
    <FormShell onSubmit={submit} errors={errors}>
      {!existing ? (
        <div>
          <p id="product-kind-label" className="text-sm font-medium text-brand-plum-900">
            Tipo
          </p>
          <div role="radiogroup" aria-labelledby="product-kind-label" className="mt-1.5 grid grid-cols-2 gap-2">
            {NEW_KINDS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={kind === option.value}
                onClick={() => setKind(option.value)}
                className={`h-9 rounded-lg border text-sm font-medium transition-colors ${focusRing} ${
                  kind === option.value
                    ? "border-brand-primary bg-brand-primary text-white"
                    : "border-brand-border bg-brand-surface-card text-brand-text-soft hover:border-brand-primary hover:bg-brand-surface-muted hover:text-brand-primary"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <label className={labelClass}>
        Nome
        <input value={name} onChange={(event) => setName(event.target.value)} className={fieldClass} />
      </label>

      <label className={labelClass}>
        {kind === "peso" ? "Preço por kg (R$)" : "Preço (R$)"}
        <input inputMode="decimal" value={priceRaw} onChange={(event) => setPriceRaw(event.target.value)} className={fieldClass} />
      </label>

      {kind === "peso" ? (
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium text-brand-plum-900">Embalagens aceitas</legend>
          {selectablePackagings.map((packaging) => (
            <label key={packaging.id} className="inline-flex items-center gap-2 text-sm text-brand-plum-900">
              <input
                type="checkbox"
                checked={packagingIds.includes(packaging.id)}
                onChange={(event) =>
                  setPackagingIds((current) => (event.target.checked ? [...current, packaging.id] : current.filter((entry) => entry !== packaging.id)))
                }
                className="size-4 accent-brand-primary"
              />
              {packaging.name}
            </label>
          ))}
        </fieldset>
      ) : null}

      {kind === "pronto" ? (
        <>
          <label className={labelClass}>
            Embalagem
            <select value={packagingId} onChange={(event) => setPackagingId(event.target.value)} className={fieldClass}>
              {selectablePackagings.map((packaging) => (
                <option key={packaging.id} value={packaging.id}>
                  {packaging.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Complementos incluídos
            <input inputMode="numeric" value={includedRaw} onChange={(event) => setIncludedRaw(event.target.value)} className={fieldClass} />
          </label>
        </>
      ) : null}

      <StockUsageEditor
        legend={kind === "peso" ? "Consumo por kg vendido" : kind === "pronto" ? "Consumo por copo" : "Consumo por unidade"}
        rows={rows}
        onChange={setRows}
        items={usageItems}
      />

      {!existing && kind === "unidade" ? (
        <label className="inline-flex items-center gap-2 text-sm text-brand-plum-900">
          <input type="checkbox" checked={trackStock} onChange={(event) => setTrackStock(event.target.checked)} className="size-4 accent-brand-primary" />
          Controlar estoque deste produto
        </label>
      ) : null}

      {existing && existing.kind !== "peso" ? <ActiveCheckbox checked={active} onChange={setActive} /> : null}
    </FormShell>
  );
}

const STOCK_UNITS: readonly InventoryUnit[] = ["kg", "L", "un"];

function ComplementForm({ catalog, id, onSaved }: FormProps) {
  const existing = id ? catalog.complements.find((complement) => complement.id === id) : undefined;
  const [name, setName] = useState(existing?.name ?? "");
  const [extraRaw, setExtraRaw] = useState(existing ? moneyInput(existing.extraPrice) : "");
  const [active, setActive] = useState(existing?.active ?? true);
  const [stockUnit, setStockUnit] = useState<InventoryUnit>("kg");
  const { errors, apply } = useResult(onSaved);

  function submit() {
    const draft = { id: existing?.id ?? "", name, active, extraPrice: parseQuantity(extraRaw), stockItemId: existing?.stockItemId ?? "" };
    apply(saveComplement(catalog, draft, { stockUnit }));
  }

  return (
    <FormShell onSubmit={submit} errors={errors}>
      <label className={labelClass}>
        Nome
        <input value={name} onChange={(event) => setName(event.target.value)} className={fieldClass} />
      </label>
      <label className={labelClass}>
        Adicional (R$)
        <input inputMode="decimal" value={extraRaw} onChange={(event) => setExtraRaw(event.target.value)} className={fieldClass} />
      </label>
      {!existing ? (
        <label className={labelClass}>
          Unidade no estoque
          <select value={stockUnit} onChange={(event) => setStockUnit(event.target.value as InventoryUnit)} className={fieldClass}>
            {STOCK_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <ActiveCheckbox checked={active} onChange={setActive} />
      )}
    </FormShell>
  );
}

function PackagingForm({ catalog, id, onSaved }: FormProps) {
  const existing = id ? catalog.packagings.find((packaging) => packaging.id === id) : undefined;
  const [name, setName] = useState(existing?.name ?? "");
  const [tareRaw, setTareRaw] = useState(existing ? quantityInput(Math.round(existing.tareKg * 1_000_000) / 1000) : "");
  const [active, setActive] = useState(existing?.active ?? true);
  const { errors, apply } = useResult(onSaved);

  function submit() {
    const draft = { id: existing?.id ?? "", name, active, tareKg: parseQuantity(tareRaw) / 1000, stockItemId: existing?.stockItemId ?? "" };
    apply(savePackaging(catalog, draft));
  }

  return (
    <FormShell onSubmit={submit} errors={errors}>
      <label className={labelClass}>
        Nome
        <input value={name} onChange={(event) => setName(event.target.value)} className={fieldClass} />
      </label>
      <label className={labelClass}>
        Tara (g)
        <input inputMode="decimal" value={tareRaw} onChange={(event) => setTareRaw(event.target.value)} className={fieldClass} />
      </label>
      {existing ? <ActiveCheckbox checked={active} onChange={setActive} /> : null}
    </FormShell>
  );
}

const NEW_TITLE: Record<EditTarget["list"], string> = { products: "Novo produto", complements: "Novo complemento", packagings: "Nova embalagem" };

function panelTitle(catalog: Catalog, target: EditTarget): string {
  if (target.id === null) return NEW_TITLE[target.list];
  const entries: readonly { id: string; name: string }[] = catalog[target.list];
  return `Editar ${entries.find((entry) => entry.id === target.id)?.name ?? ""}`;
}

/** Mount a fresh instance (new `key`) on every open, so a cancelled or failed attempt never leaks into the next one. */
export function CatalogEditPanel({
  open,
  onOpenChange,
  catalog,
  target,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalog: Catalog;
  target: EditTarget;
  onSaved: (catalog: Catalog) => void;
}) {
  const formProps = { catalog, id: target.id, onSaved };
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-brand-plum-950/45" />
        <Dialog.Content className="theme-light fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-y-auto border-l border-brand-border bg-brand-surface-card p-6 shadow-xl focus:outline-none">
          <Dialog.Title className="font-serif text-2xl font-semibold text-brand-plum-950">{panelTitle(catalog, target)}</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-brand-text-soft">As mudanças valem para o caixa assim que forem salvas.</Dialog.Description>
          {target.list === "products" ? <ProductForm {...formProps} /> : target.list === "complements" ? <ComplementForm {...formProps} /> : <PackagingForm {...formProps} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

`apps/web/front/features/catalog/cardapio-editor.tsx`:

```tsx
"use client";

import Link from "next/link";
import { House, Plus, RotateCcw, Settings } from "lucide-react";
import { Dialog } from "radix-ui";
import { useState } from "react";
import type { Catalog, SaleProduct } from "@/back/domain/catalog/catalog";
import { BrandMark } from "@/front/features/home/brand-mark";
import { CatalogEditPanel, type EditTarget } from "./catalog-edit-panel";
import { resetCatalog, saveCatalog, useCatalog } from "./catalog-store";

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary";
const secondaryButton = `inline-flex h-9 items-center gap-1.5 rounded-lg border border-brand-border bg-brand-surface-card px-3 text-sm font-medium text-brand-text-soft transition-colors hover:border-brand-primary hover:bg-brand-surface-muted hover:text-brand-primary ${focusRing}`;
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

type List = EditTarget["list"];
const TABS: readonly { list: List; label: string; newLabel: string }[] = [
  { list: "products", label: "Produtos", newLabel: "Novo produto" },
  { list: "complements", label: "Complementos", newLabel: "Novo complemento" },
  { list: "packagings", label: "Embalagens", newLabel: "Nova embalagem" },
];

const KIND_LABEL: Record<SaleProduct["kind"], string> = { peso: "Por peso", pronto: "Copo pronto", unidade: "Unidade" };

type Row = { id: string; name: string; detail?: string; value: string; active: boolean };

function rowsFor(catalog: Catalog, list: List): Row[] {
  if (list === "products") {
    return catalog.products.map((product) => ({
      id: product.id,
      name: product.name,
      detail: KIND_LABEL[product.kind],
      value: product.kind === "peso" ? `${money.format(product.pricePerKg)}/kg` : money.format(product.price),
      active: product.active,
    }));
  }
  if (list === "complements") {
    return catalog.complements.map((complement) => ({ id: complement.id, name: complement.name, value: `Adicional ${money.format(complement.extraPrice)}`, active: complement.active }));
  }
  return catalog.packagings.map((packaging) => ({
    id: packaging.id,
    name: packaging.name,
    value: `Tara ${(Math.round(packaging.tareKg * 1_000_000) / 1000).toLocaleString("pt-BR")} g`,
    active: packaging.active,
  }));
}

export function CardapioEditor() {
  const catalog = useCatalog();
  const [tab, setTab] = useState<List>("products");
  const [panel, setPanel] = useState<{ open: boolean; target: EditTarget; key: number }>({ open: false, target: { list: "products", id: null }, key: 0 });
  const [confirmReset, setConfirmReset] = useState(false);
  const [status, setStatus] = useState("");

  const current = TABS.find((entry) => entry.list === tab) ?? TABS[0];

  function openPanel(target: EditTarget) {
    setStatus("");
    setPanel((state) => ({ open: true, target, key: state.key + 1 }));
  }

  function handleSaved(next: Catalog) {
    saveCatalog(next);
    setPanel((state) => ({ ...state, open: false }));
    setStatus("Alterações salvas.");
  }

  function handleReset() {
    resetCatalog();
    setConfirmReset(false);
    setStatus("Valores de exemplo restaurados.");
  }

  return (
    <main className="theme-light min-h-dvh bg-brand-surface px-3 py-3 text-brand-plum-900 sm:px-5">
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <header className="flex flex-col gap-3 rounded-2xl border border-brand-border bg-brand-surface-card px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <BrandMark subtitle="Cardápio" />
          <nav aria-label="Navegação" className="flex items-center gap-2">
            <Link href="/configuracoes" className={secondaryButton}>
              <Settings className="size-4" /> Configurações
            </Link>
            <Link href="/dashboard" className={secondaryButton}>
              <House className="size-4" /> Início
            </Link>
          </nav>
        </header>

        <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-serif text-3xl font-semibold text-brand-plum-950">Cardápio</h1>
            <p className="mt-1 text-sm text-brand-text-soft">As mudanças ficam salvas neste navegador.</p>
          </div>
          <button type="button" onClick={() => setConfirmReset(true)} className={`${secondaryButton} w-fit`}>
            <RotateCcw className="size-4" /> Restaurar valores de exemplo
          </button>
        </div>

        <p role="status" aria-live="polite" className="px-1 text-sm font-medium text-brand-success">
          {status}
        </p>

        <section className="rounded-2xl border border-brand-border bg-brand-surface-card shadow-sm">
          <div className="flex flex-col gap-3 border-b border-brand-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div role="tablist" aria-label="Partes do cardápio" className="flex flex-wrap gap-2">
              {TABS.map((entry) => (
                <button
                  key={entry.list}
                  type="button"
                  role="tab"
                  id={`tab-${entry.list}`}
                  aria-selected={tab === entry.list}
                  aria-controls={`panel-${entry.list}`}
                  onClick={() => setTab(entry.list)}
                  className={`h-9 rounded-lg border px-3 text-sm font-medium transition-colors ${focusRing} ${
                    tab === entry.list
                      ? "border-brand-primary bg-brand-primary text-white"
                      : "border-brand-border bg-brand-surface-card text-brand-text-soft hover:border-brand-primary hover:bg-brand-surface-muted hover:text-brand-primary"
                  }`}
                >
                  {entry.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => openPanel({ list: tab, id: null })}
              className={`inline-flex h-9 w-fit items-center gap-1.5 rounded-lg bg-brand-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-primary-dark ${focusRing}`}
            >
              <Plus className="size-4" /> {current.newLabel}
            </button>
          </div>

          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            <ul aria-label={current.label} className="divide-y divide-brand-border">
              {rowsFor(catalog, tab).map((row) => (
                <li key={row.id} aria-label={row.name} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className={`font-medium ${row.active ? "text-brand-plum-950" : "text-brand-text-muted"}`}>{row.name}</p>
                    {row.detail ? <p className="text-sm text-brand-text-soft">{row.detail}</p> : null}
                  </div>
                  <div className="flex items-center gap-3">
                    {!row.active ? <span className="rounded-full bg-brand-surface-muted px-2.5 py-1 text-xs font-semibold text-brand-text-soft">Desativado</span> : null}
                    <span className="text-sm font-semibold tabular-nums text-brand-plum-900">{row.value}</span>
                    <button type="button" aria-label={`Editar ${row.name}`} onClick={() => openPanel({ list: tab, id: row.id })} className={secondaryButton}>
                      Editar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      <CatalogEditPanel
        key={panel.key}
        open={panel.open}
        onOpenChange={(open) => setPanel((state) => ({ ...state, open }))}
        catalog={catalog}
        target={panel.target}
        onSaved={handleSaved}
      />

      <Dialog.Root open={confirmReset} onOpenChange={setConfirmReset}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-brand-plum-950/45" />
          <Dialog.Content className="theme-light fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-brand-border bg-brand-surface-card p-6 shadow-xl focus:outline-none">
            <Dialog.Title className="font-serif text-2xl font-semibold text-brand-plum-950">Restaurar valores de exemplo?</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-brand-text-soft">As mudanças salvas neste navegador serão apagadas.</Dialog.Description>
            <div className="mt-6 flex justify-end gap-2">
              <Dialog.Close className={`${secondaryButton} h-10 px-4`}>Cancelar</Dialog.Close>
              <button type="button" onClick={handleReset} className={`h-10 rounded-lg bg-brand-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-primary-dark ${focusRing}`}>
                Restaurar
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </main>
  );
}
```

`apps/web/app/configuracoes/cardapio/page.tsx`:

```tsx
import { CardapioEditor } from "@/front/features/catalog/cardapio-editor";

export default function CardapioPage() {
  return <CardapioEditor />;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:unit && pnpm typecheck && pnpm lint`
Expected: suíte verde (8 testes novos do editor), `tsc` e `eslint` sem erros.

- [ ] **Step 5: Browser check**

Com o servidor de dev do usuário em http://localhost:3000:
- `/configuracoes`: três cartões; Cardápio abre `/configuracoes/cardapio`.
- `/configuracoes/cardapio`: mudar o açaí para 42,00 e salvar; recarregar a página: continua R$ 42,00/kg, sem erro de hidratação no console.
- `/pdv`: pesar 0,450 kg → linha "0,450 kg × R$ 42,00/kg" = R$ 18,90.
- Cardápio → Embalagens → Nova embalagem "Copo 700 ml", tara 20; `/estoque` lista "Copo 700 ml" com 0 un.
- Mobile (390 px): sem rolagem horizontal no Cardápio e no painel.
- Hover em Editar, abas, Configurações, Início e Cancelar: fundo `rgb(243, 233, 228)`, texto/borda `rgb(113, 20, 91)`.
- Restaurar valores de exemplo no fim, para deixar o navegador limpo.
Expected: tudo como descrito.

- [ ] **Step 6: Commit**

```bash
git add apps/web/front/features/catalog apps/web/app/configuracoes/cardapio
git commit -m "feat(cardapio): tela para editar e cadastrar produtos, complementos e embalagens"
```
