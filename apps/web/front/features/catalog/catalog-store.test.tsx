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

  it("re-reads the saved catalog when a screen mounts again after all readers left", () => {
    // e.g. the till tab navigated to the home page while the Cardápio was edited in another tab
    const first = render(<AcaiPrice />);
    expect(screen.getByText("preço 39.9")).toBeInTheDocument();
    first.unmount();

    localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(withAcaiPrice(47)));
    render(<AcaiPrice />);
    expect(screen.getByText("preço 47")).toBeInTheDocument();
  });

  it("gives each catalog object a stable key", () => {
    const sample = catalogKey(CATALOG);
    expect(catalogKey(CATALOG)).toBe(sample);
    expect(catalogKey(withAcaiPrice(45))).not.toBe(sample);
  });
});
