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
