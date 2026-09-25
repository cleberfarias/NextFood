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
